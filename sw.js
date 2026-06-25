// ══════════════════════════════════════
//  SERVICE WORKER — Journal de Travaux
//  Version : 1.0.0
//  À incrémenter à chaque mise à jour de l'app
// ══════════════════════════════════════

const CACHE_NAME = 'jt-cache-v1';

// Fichiers à mettre en cache pour fonctionner hors ligne
const FICHIERS_A_CACHER = [
  '/',
  '/index.html',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
];

// ── Installation : mise en cache initiale ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Mise en cache initiale');
        // On tente de cacher chaque fichier individuellement
        // pour ne pas bloquer si un CDN est inaccessible
        return Promise.allSettled(
          FICHIERS_A_CACHER.map(url =>
            cache.add(url).catch(err => console.warn('[SW] Impossible de cacher:', url, err))
          )
        );
      })
      .then(() => self.skipWaiting()) // Activer immédiatement sans attendre
  );
});

// ── Activation : nettoyage des anciens caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Suppression ancien cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim()) // Prendre le contrôle immédiatement
  );
});

// ── Interception des requêtes ──
self.addEventListener('fetch', event => {
  // Ne pas intercepter les requêtes non-GET
  if (event.request.method !== 'GET') return;

  // Stratégie : Cache d'abord, réseau en fallback
  // Si hors ligne et en cache → sert le cache
  // Si en ligne → sert le réseau ET met à jour le cache en arrière-plan
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request)
        .then(response => {
          // Mettre à jour le cache avec la nouvelle version
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Réseau inaccessible — on retourne ce qu'on a en cache
          return cached;
        });

      // Retourner le cache immédiatement si disponible,
      // sinon attendre le réseau
      return cached || networkFetch;
    })
  );
});
