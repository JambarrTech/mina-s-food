/**
 * @license
 * Centre de Notifications Temps Réel & Push - Mina's Food Mbour
 * 
 * Composant interactif qui permet :
 * - D'activer les notifications Push du navigateur
 * - D'activer/désactiver le carillon sonore
 * - De consulter l'historique des alertes en temps réel reçues par WebSocket
 * - D'afficher des toasts animés lors d'une nouvelle commande ou paiement.
 */

import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Volume2, 
  VolumeX, 
  X, 
  Wifi, 
  WifiOff, 
  Sparkles,
  Bike,
  Trash2,
  Cake,
  BellOff
} from 'lucide-react';
import { 
  realtimeService, 
  AppPushNotification 
} from '../services/realtimeService.ts';
import { soundManager } from '../services/soundService.ts';
import { WaveLogo } from './WaveLogo.tsx';

interface Props {
  onOpenTracking?: (orderNumber: string) => void;
}

export const NotificationCenter: React.FC<Props> = ({ onOpenTracking }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<AppPushNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isSoundOn, setIsSoundOn] = useState<boolean>(soundManager.isEnabled());
  const [pushPermission, setPushPermission] = useState<string>(realtimeService.getPushPermissionState());
  const [pushSubscribed, setPushSubscribed] = useState<boolean>(realtimeService.isPushActive());
  const [isPushBusy, setIsPushBusy] = useState<boolean>(false);
  const [latestToast, setLatestToast] = useState<AppPushNotification | null>(null);

  useEffect(() => {
    // Connexion WebSocket
    realtimeService.connect();
    setIsConnected(realtimeService.getIsConnected());

    const unsubStatus = realtimeService.on('connection:status', (data: { connected: boolean }) => {
      setIsConnected(data.connected);
    });

    // Reprise automatique de l'abonnement push existant (si déjà activé)
    realtimeService.syncPushSubscription().then((active) => {
      setPushSubscribed(active || realtimeService.isPushActive());
    });

    const unsubPush = realtimeService.onPushSubscriptionChange((state) => {
      setPushPermission(realtimeService.getPushPermissionState());
      setPushSubscribed(state === 'subscribed' && realtimeService.isPushActive());
    });

    // Re-souscription après changement d'abonnement (expiration navigateur)
    const resumeAfterChange = (event: MessageEvent) => {
      if (event.data && event.data.type === 'PUSH_SUBSCRIPTION_CHANGED') {
        realtimeService.syncPushSubscription();
      }
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', resumeAfterChange);
    }

    // Écoute de l'historique des notifications
    const unsubHistory = realtimeService.onNotificationsChange((list) => {
      setNotifications(list);
      const unread = list.filter(n => !n.read).length;
      setUnreadCount(unread);

      // Toast flash pour le dernier élément reçu
      if (list.length > 0 && !list[0].read) {
        setLatestToast(list[0]);
        const timer = setTimeout(() => {
          setLatestToast(null);
        }, 5000);
        return () => clearTimeout(timer);
      }
    });

    return () => {
      unsubStatus();
      unsubPush();
      unsubHistory();
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', resumeAfterChange);
      }
    };
  }, []);

  const handleToggleSound = () => {
    const newState = soundManager.toggleSound();
    setIsSoundOn(newState);
  };

  const handleTogglePush = async () => {
    setIsPushBusy(true);
    try {
      if (realtimeService.isPushActive()) {
        await realtimeService.disablePushNotifications();
        setPushPermission(realtimeService.getPushPermissionState());
        setPushSubscribed(false);
      } else {
        const enabled = await realtimeService.enablePushNotifications();
        setPushPermission(realtimeService.getPushPermissionState());
        setPushSubscribed(enabled || realtimeService.isPushActive());
      }
    } finally {
      setIsPushBusy(false);
    }
  };

  const handleOpenDropdown = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      realtimeService.markAllAsRead();
    }
  };

  const handleNotificationClick = (notif: AppPushNotification) => {
    if (notif.orderNumber && onOpenTracking) {
      onOpenTracking(notif.orderNumber);
      setIsOpen(false);
      setLatestToast(null);
    }
  };

  return (
    <div className="relative">
      {/* Bouton cloche dans la barre d'action */}
      <button
        type="button"
        onClick={handleOpenDropdown}
        aria-label="Centre de notifications temps réel"
        className="relative p-2 rounded-xl text-stone-700 hover:text-amber-900 hover:bg-amber-50 border border-stone-200 transition-colors cursor-pointer"
        title="Notifications en temps réel WebSocket"
      >
        <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
        
        {/* Pastille badge non lu */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white animate-bounce">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}

        {/* Témoin lumineux WebSocket */}
        <span 
          className={`absolute bottom-1 right-1 w-2 h-2 rounded-full ring-1 ring-white ${
            isConnected ? 'bg-emerald-500' : 'bg-stone-400 animate-pulse'
          }`}
          title={isConnected ? 'Connecté au flux WebSocket Mina\'s Food' : 'Tentative de connexion WebSocket...'}
        />
      </button>

      {/* Popover / Volet des notifications */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />

          <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-stone-200 shadow-xl z-50 overflow-hidden text-xs animate-in fade-in zoom-in-95 duration-150">
            {/* En-tête */}
            <div className="p-3.5 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-sm">Notifications Directes</span>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Statut WebSocket */}
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  isConnected ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-stone-800 text-stone-400'
                }`}>
                  {isConnected ? <Wifi className="w-3 h-3 text-emerald-400" /> : <WifiOff className="w-3 h-3 text-stone-400" />}
                  <span>{isConnected ? 'WebSocket Actif' : 'Hors-ligne'}</span>
                </span>

                {/* Bouton Muet / Son */}
                <button
                  type="button"
                  onClick={handleToggleSound}
                  className="p-1 rounded-lg hover:bg-stone-800 text-stone-300 hover:text-white transition-colors cursor-pointer"
                  title={isSoundOn ? 'Désactiver le son' : 'Activer le carillon'}
                >
                  {isSoundOn ? <Volume2 className="w-3.5 h-3.5 text-amber-400" /> : <VolumeX className="w-3.5 h-3.5 text-stone-500" />}
                </button>
              </div>
            </div>

            {/* Bannière de notifications Push natives */}
            {pushPermission === 'unsupported' ? (
              <div className="p-2.5 bg-stone-50 border-b border-stone-200 flex items-center gap-1.5 text-[11px] text-stone-500">
                <BellOff className="w-3.5 h-3.5 shrink-0" />
                <span>Push natif non pris en charge par ce navigateur (WebSocket actif).</span>
              </div>
            ) : pushSubscribed ? (
              <div className="p-2.5 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between text-[11px] text-emerald-900">
                <div className="flex items-center gap-1.5 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Alertes push activées, même en arrière-plan.</span>
                </div>
                <button
                  type="button"
                  onClick={handleTogglePush}
                  disabled={isPushBusy}
                  className="px-2 py-1 rounded-md bg-emerald-800 text-white font-bold text-[10px] hover:bg-emerald-900 transition-colors shrink-0 disabled:opacity-50"
                  title="Désactiver les notifications push"
                >
                  Désactiver
                </button>
              </div>
            ) : (
              <div className="p-2.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-[11px] text-amber-900">
                <div className="flex items-center gap-1.5 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Recevoir les alertes même en arrière-plan ?</span>
                </div>
                <button
                  type="button"
                  onClick={handleTogglePush}
                  disabled={isPushBusy}
                  className="px-2 py-1 rounded-md bg-amber-800 text-white font-bold text-[10px] hover:bg-amber-900 transition-colors shrink-0 disabled:opacity-50"
                >
                  {isPushBusy ? 'Activation...' : 'Activer'}
                </button>
              </div>
            )}

            {/* Liste des notifications */}
            <div className="max-h-80 overflow-y-auto divide-y divide-stone-100">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-stone-400 space-y-1">
                  <Bell className="w-6 h-6 mx-auto text-stone-300 mb-1" />
                  <p className="font-semibold text-stone-600">Aucune notification</p>
                  <p className="text-[11px]">Les commandes et mises à jour en direct s'afficheront ici.</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-3 transition-colors hover:bg-stone-50 cursor-pointer flex gap-3 items-start ${
                      !n.read ? 'bg-amber-50/40' : ''
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {n.type === 'order' && (
                        <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                          <Cake className="w-3.5 h-3.5 text-amber-700" />
                        </div>
                      )}
                      {n.type === 'status' && (
                        <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
                          <Bike className="w-3.5 h-3.5 text-blue-700" />
                        </div>
                      )}
                      {n.type === 'wave' && (
                        <div className="w-7 h-7 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center">
                          <WaveLogo size="xs" />
                        </div>
                      )}
                      {n.type === 'info' && (
                        <div className="w-7 h-7 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-stone-900 truncate">
                          {n.title}
                        </span>
                        <span className="text-[10px] text-stone-400 whitespace-nowrap ml-2">
                          {new Date(n.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-stone-600 text-[11px] leading-snug line-clamp-2">
                        {n.message}
                      </p>
                      {n.orderNumber && (
                        <div className="pt-1">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-stone-100 text-stone-700">
                            {n.orderNumber}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pied de volet */}
            {notifications.length > 0 && (
              <div className="p-2 bg-stone-50 border-t border-stone-200 flex justify-between items-center text-[11px]">
                <button
                  type="button"
                  onClick={() => realtimeService.clearNotifications()}
                  className="text-stone-500 hover:text-red-600 flex items-center gap-1 font-medium transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Effacer l'historique</span>
                </button>
                <span className="text-stone-400">
                  {notifications.length} notification{notifications.length > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Toast flottant d'alerte en direct */}
      {latestToast && !isOpen && (
        <div 
          onClick={() => handleNotificationClick(latestToast)}
          className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-stone-900 text-white p-3.5 rounded-2xl shadow-2xl border border-amber-500/40 flex items-start gap-3 cursor-pointer hover:bg-stone-850 transition-transform transform hover:-translate-y-0.5 animate-in slide-in-from-bottom-5"
        >
          <div className="shrink-0 mt-0.5">
            {latestToast.type === 'order' && <Cake className="w-4 h-4 text-amber-400" />}
            {latestToast.type === 'wave' && <WaveLogo size="sm" />}
            {latestToast.type === 'status' && <Bike className="w-4 h-4 text-amber-400" />}
            {latestToast.type === 'info' && <Sparkles className="w-4 h-4 text-amber-400" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-amber-200 truncate">
                {latestToast.title}
              </span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setLatestToast(null);
                }}
                className="text-stone-400 hover:text-white ml-2"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-stone-300 mt-0.5 line-clamp-2">
              {latestToast.message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
