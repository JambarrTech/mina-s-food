/**
 * Service Worker Mina's Food - Notifications Push Web (PWA)
 * Reçoit les push du serveur même en arrière-plan / onglet fermé,
 * puis affiche les notifications natives du système.
 */

const APP_TITLE = "Mina's Food Mbour";
const ICON_URL = '/logo.jpeg';

self.addEventListener('install', () => {
  // Force l'activation immédiate du nouveau SW (skip waiting).
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Affichage d'une notification native à partir d'un push serveur.
 * Le payload JSON contient : { title, message, type, orderNumber, url }
 */
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? JSON.parse(event.data.text()) : {};
  } catch {
    payload = { message: event.data ? event.data.text() : '' };
  }

  const title = payload.title || APP_TITLE;
  const options = {
    body: payload.message || 'Une nouvelle information vous attend.',
    icon: payload.icon || ICON_URL,
    badge: ICON_URL,
    tag: `minas-food-${payload.orderNumber || payload.type || 'info'}`,
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      url: payload.url || '/',
      orderNumber: payload.orderNumber || null,
      dateOfArrival: Date.now()
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * Clic sur la notification : focus la fenêtre existante ou ouvre l'URL.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

/**
 * Changement d'abonnement push (ex: expiration par le navigateur).
 * On l'abonne à nouveau et on notifie toutes les fenêtres ouvertes
 * pour qu'elles re-synchronisent le nouvel abonnement sur le serveur.
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (event.oldSubscription && event.oldSubscription.options && event.oldSubscription.options.applicationServerKey
      ? self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: event.oldSubscription.options.applicationServerKey
        })
      : self.registration.pushManager.subscribe({ userVisibleOnly: true })
    ).then((subscription) => {
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED', subscription });
        }
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});