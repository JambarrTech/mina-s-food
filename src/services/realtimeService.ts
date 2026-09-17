/**
 * @license
 * Service Temps Réel (WebSocket + SSE) & Notifications Push - Mina's Food Mbour
 * 
 * Coordonne :
 * - La connexion WebSocket bidirectionnelle (dev / VPS) sur /api/ws
 * - La bascule automatique vers le flux Server-Sent Events /api/events/stream
 *   en serverless (Vercel : pas de WebSocket global entre instances)
 * - L'abonnement au Push API (Service Worker + clés VAPID) pour les
 *   notifications natives du système reçues même en arrière-plan / onglet fermé
 * - L'écoute d'événements : nouvelle commande, progression atelier, paiement Wave
 * - La synchronisation temps réel sans rechargement de page.
 */

import { soundManager } from './soundService.ts';

export interface RealtimeEventData {
  event: string;
  data: any;
  timestamp: string;
}

export interface AppPushNotification {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'status' | 'wave' | 'info';
  timestamp: string;
  orderNumber?: string;
  read?: boolean;
}

type Listener = (data: any) => void;

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string) || '';

/**
 * Convertit une clé VAPID (base64url) en Uint8Array pour pushManager.subscribe()
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

class RealtimeService {
  private ws: WebSocket | null = null;
  private sse: EventSource | null = null;
  private wsOpenTimer: any = null;
  private reconnectTimer: any = null;
  private isConnected: boolean = false;
  private listeners: Map<string, Set<Listener>> = new Map();
  private notificationHistory: AppPushNotification[] = [];
  private historyListeners: Set<(history: AppPushNotification[]) => void> = new Set();
  private pushPermissionState: NotificationPermission | 'unsupported' = 'default';
  private pushSubscriptionState: 'unknown' | 'subscribed' | 'not-subscribed' = 'unknown';
  private subscriptionListeners: Set<(state: 'unknown' | 'subscribed' | 'not-subscribed') => void> = new Set();
  // Identifiants d'événements déjà vus : une reconnexion SSE rejoue les derniers
  // événements (serveur), sans ce déduplicateur chaque replay re-déclenche
  // notification/son → boucle. Plafonné pour rester borné en mémoire.
  private seenEventIds = new Map<string, number>();
  private static readonly SEEN_EVENTS_MAX = 200;
  private static readonly SEEN_EVENTS_TTL_MS = 10 * 60_000;

  constructor() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.pushPermissionState = Notification.permission;
    } else {
      this.pushPermissionState = 'unsupported';
    }
  }

  /**
   * Initialise la connexion temps réel : WebSocket d'abord, puis bascule SSE
   * si le WebSocket n'est pas disponible (mode serverless Vercel).
   */
  public connect(): void {
    if (typeof window === 'undefined') return;
    if (this.sse) return; // mode SSE déjà actif
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.startWebSocket();
  }

  private startWebSocket(): void {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/ws`;
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      // En serverless (Vercel) l'upgrade WebSocket n'est pas toujours servi :
      // si le WS n'est pas ouvert sous 6 s, on bascule sur le flux SSE.
      this.wsOpenTimer = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          this.teardownWs();
          this.fallbackToSse();
        }
      }, 6000);

      ws.onopen = () => {
        if (this.wsOpenTimer) {
          clearTimeout(this.wsOpenTimer);
          this.wsOpenTimer = null;
        }
        this.isConnected = true;
        this.emit('connection:status', { connected: true, mode: 'websocket' });
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const payload: RealtimeEventData = JSON.parse(event.data);
          this.handleIncomingEvent(payload);
        } catch (err) {
          console.error('[WebSocket] Erreur décodage message :', err);
        }
      };

      ws.onclose = () => {
        if (this.sse) return; // bascule SSE déjà effectuée
        this.isConnected = false;
        this.emit('connection:status', { connected: false });
        this.scheduleReconnect();
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (err) {
      console.warn('[WebSocket] Connexion non disponible, bascule sur SSE...', err);
      this.teardownWs();
      this.fallbackToSse();
    }
  }

  private fallbackToSse(): void {
    if (typeof window === 'undefined' || !('EventSource' in window)) return;
    if (this.sse) return;
    try {
      const sse = new EventSource('/api/events/stream');
      this.sse = sse;

      sse.onopen = () => {
        this.isConnected = true;
        this.emit('connection:status', { connected: true, mode: 'sse' });
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      sse.onerror = () => {
        this.isConnected = false;
        this.emit('connection:status', { connected: false, mode: 'sse' });
      };

      const namedEvents = ['order:created', 'order:status_updated', 'payment:verified', 'payment:declared', 'notification:broadcast', 'connection:established'];
      for (const eventName of namedEvents) {
        sse.addEventListener(eventName, (raw: Event) => {
          try {
            const payload = JSON.parse((raw as MessageEvent).data) as RealtimeEventData & { id?: string };
            // Identité de l'événement (ligne "id:" du flux SSE) : indispensable
            // pour ignorer les replays à chaque reconnexion (boucle notifications).
            const lastEventId = (raw as MessageEvent).lastEventId;
            if (lastEventId && !payload.id) payload.id = lastEventId;
            this.handleIncomingEvent(payload);
          } catch (err) {
            console.error('[SSE] Erreur décodage message :', err);
          }
        });
      }
    } catch (err) {
      console.warn('[SSE] Flux indisponible, tentative ultérieure...', err);
      this.sse = null;
    }
  }

  private teardownWs(): void {
    if (this.wsOpenTimer) {
      clearTimeout(this.wsOpenTimer);
      this.wsOpenTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 4000);
  }

  /**
   * Traitement des événements reçus du serveur
   */
  private handleIncomingEvent(payload: RealtimeEventData & { id?: string }): void {
    const { event, data, timestamp } = payload;

    // Déduplication des replays (reconnexion SSE après ~50 s sur Vercel, ou
    // double abonnement). Un même identifiant d'événement n'est traité qu'une
    // fois : c'est ce qui supprimait la boucle de notifications.
    const eventId = payload.id;
    if (eventId) {
      const now = Date.now();
      if (this.seenEventIds.has(eventId)) return;
      this.seenEventIds.set(eventId, now);
      if (this.seenEventIds.size > RealtimeService.SEEN_EVENTS_MAX) {
        const toEvict = [...this.seenEventIds.entries()]
          .filter(([, t]) => now - t > RealtimeService.SEEN_EVENTS_TTL_MS)
          .map(([k]) => k);
        for (const key of toEvict) this.seenEventIds.delete(key);
        const remaining = [...this.seenEventIds.entries()].sort((a, b) => a[1] - b[1]);
        const overflow = this.seenEventIds.size - RealtimeService.SEEN_EVENTS_MAX;
        for (let i = 0; i < overflow; i++) this.seenEventIds.delete(remaining[i][0]);
      }
    }

    if (event === 'order:created') {
      soundManager.playOrderChime();
      this.addNotification({
        id: `notif-${Date.now()}`,
        title: 'Nouvelle Commande Reçue',
        message: data.message || `Commande ${data.orderNumber} enregistrée.`,
        type: 'order',
        timestamp: timestamp || new Date().toISOString(),
        orderNumber: data.orderNumber
      });
    } else if (event === 'order:status_updated') {
      soundManager.playOrderChime();
      const statusLabel = 
        data.status === 'preparing' ? 'Gâteau en préparation au labo' :
        data.status === 'ready_or_out' ? 'Commande prête / en livraison 🛵' :
        data.status === 'delivered' ? 'Commande livrée & dégustée 😋' : 'Commande reçue 📥';

      this.addNotification({
        id: `notif-${Date.now()}`,
        title: `Suivi Commande ${data.orderNumber}`,
        message: statusLabel,
        type: 'status',
        timestamp: timestamp || new Date().toISOString(),
        orderNumber: data.orderNumber
      });
    } else if (event === 'payment:verified') {
      soundManager.playPaymentChime();
      this.addNotification({
        id: `notif-${Date.now()}`,
        title: 'Paiement Wave Confirmé',
        message: data.message || `Transaction Wave ${data.waveTransactionRef} certifiée.`,
        type: 'wave',
        timestamp: timestamp || new Date().toISOString(),
        orderNumber: data.orderId
      });
    } else if (event === 'payment:declared') {
      soundManager.playPaymentChime();
      this.addNotification({
        id: `notif-${Date.now()}`,
        title: 'Paiement Wave à valider',
        message: data.message || `Référence ${data.waveTransactionRef} déclarée pour vérification.`,
        type: 'wave',
        timestamp: timestamp || new Date().toISOString(),
        orderNumber: data.orderNumber
      });
    } else if (event === 'notification:broadcast') {
      soundManager.playOrderChime();
      this.addNotification({
        id: `notif-${Date.now()}`,
        title: data.title || 'Annonce Mina\'s Food',
        message: data.message,
        type: 'info',
        timestamp: timestamp || new Date().toISOString()
      });
    }

    this.emit(event, data);
  }

  // ============================================================================
  // NOTIFICATIONS PUSH (Service Worker + VAPID)
  // ============================================================================

  /**
   * Vérifie l'abonnement push existant et le synchronise avec le serveur.
   * Appeler au démarrage : si l'utilisateur a déjà activé les notifications,
   * on reprend l'abonnement pour ne pas recevoir de doublon.
   */
  public async syncPushSubscription(): Promise<boolean> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      this.setPushSubscriptionState('not-subscribed');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        this.pushPermissionState = Notification.permission;
        await this.registerSubscriptionOnServer(subscription);
        this.setPushSubscriptionState('subscribed');
        return true;
      }
      this.setPushSubscriptionState('not-subscribed');
      return false;
    } catch (err) {
      console.warn('[Push] Synchronisation indisponible :', err);
      this.setPushSubscriptionState('not-subscribed');
      return false;
    }
  }

  /**
   * Active les notifications push natives : permission + souscription VAPID.
   */
  public async enablePushNotifications(): Promise<boolean> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      this.setPushSubscriptionState('not-subscribed');
      return false;
    }
    if (!('Notification' in window)) {
      this.pushPermissionState = 'unsupported';
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.pushPermissionState = permission;
      if (permission !== 'granted') {
        this.setPushSubscriptionState('not-subscribed');
        return false;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        if (!VAPID_PUBLIC_KEY) {
          console.warn('[Push] Clé VAPID publique manquante (VITE_VAPID_PUBLIC_KEY).');
          this.setPushSubscriptionState('not-subscribed');
          return false;
        }
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }

      await this.registerSubscriptionOnServer(subscription);
      this.setPushSubscriptionState('subscribed');
      return true;
    } catch (err) {
      console.warn('[Push] Activation impossible :', err);
      this.setPushSubscriptionState('not-subscribed');
      return false;
    }
  }

  /**
   * Désactive les notifications push et désabonne du serveur.
   */
  public async disablePushNotifications(): Promise<boolean> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      this.setPushSubscriptionState('not-subscribed');
      return true;
    }
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        this.sendUnregister(subscription.endpoint).catch(() => {});
        await subscription.unsubscribe();
      }
      this.setPushSubscriptionState('not-subscribed');
      return true;
    } catch (err) {
      console.warn('[Push] Désactivation impossible :', err);
      return false;
    }
  }

  private async registerSubscriptionOnServer(subscription: PushSubscription): Promise<void> {
    try {
      await fetch('/api/push/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() })
      });
    } catch (err) {
      console.warn('[Push] Enregistrement serveur impossible :', err);
    }
  }

  private async sendUnregister(endpoint: string): Promise<void> {
    try {
      await fetch('/api/push/unregister', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint })
      });
    } catch {
      // Hors ligne : ignoré, l'endpoint expirera côté serveur.
    }
  }

  // ============================================================================
  // ÉTAT PUSH
  // ============================================================================

  public async requestPushPermission(): Promise<boolean> {
    return this.enablePushNotifications();
  }

  public getPushPermissionState(): NotificationPermission | 'unsupported' {
    return this.pushPermissionState;
  }

  public getPushSubscriptionState(): 'unknown' | 'subscribed' | 'not-subscribed' {
    return this.pushSubscriptionState;
  }

  public isPushActive(): boolean {
    return this.pushSubscriptionState === 'subscribed' && this.pushPermissionState === 'granted';
  }

  public onPushSubscriptionChange(callback: (state: 'unknown' | 'subscribed' | 'not-subscribed') => void): () => void {
    this.subscriptionListeners.add(callback);
    callback(this.pushSubscriptionState);
    return () => {
      this.subscriptionListeners.delete(callback);
    };
  }

  private setPushSubscriptionState(state: 'unknown' | 'subscribed' | 'not-subscribed'): void {
    this.pushSubscriptionState = state;
    this.subscriptionListeners.forEach(listener => listener(state));
  }

  // ============================================================================
  // GESTION DE L'HISTORIQUE IN-APP
  // ============================================================================

  private addNotification(notif: AppPushNotification): void {
    this.notificationHistory = [notif, ...this.notificationHistory].slice(0, 30);
    this.historyListeners.forEach(listener => listener(this.notificationHistory));
  }

  public getNotifications(): AppPushNotification[] {
    return this.notificationHistory;
  }

  public onNotificationsChange(callback: (history: AppPushNotification[]) => void): () => void {
    this.historyListeners.add(callback);
    callback(this.notificationHistory);
    return () => {
      this.historyListeners.delete(callback);
    };
  }

  public markAllAsRead(): void {
    this.notificationHistory = this.notificationHistory.map(n => ({ ...n, read: true }));
    this.historyListeners.forEach(listener => listener(this.notificationHistory));
  }

  public clearNotifications(): void {
    this.notificationHistory = [];
    this.historyListeners.forEach(listener => listener([]));
  }

  /**
   * Abonnement aux événements du WebSocket
   */
  public on(event: string, callback: Listener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  public emit(event: string, data: any): void {
    const list = this.listeners.get(event);
    if (list) {
      list.forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`[WebSocket] Erreur handler ${event} :`, err);
        }
      });
    }
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }
}

export const realtimeService = new RealtimeService();