// DersTakip Pro - Service Worker (Çevrimdışı / Offline PWA Motoru)
const CACHE_NAME = 'derstakip-pro-v1';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './initial_data.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.png'
];

// 1. Kurulum ve Dosyaları Hafızaya Alma
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// 2. Aktifleşme ve Eski Önbellekleri Temizleme
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// 3. İstekleri Yakalama (Önce Önbellek, Sonra Ağ)
self.addEventListener('fetch', (event) => {
  // Yalnızca GET isteklerini yakala
  if (event.request.method !== 'GET') return;

  // Harici Google veya iframe çağrılarını pas geç
  if (!event.request.url.startsWith(self.location.origin) && !event.request.url.startsWith('file://')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Arka planda güncelleme dene (Stale-while-revalidate)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {
          // Çevrimdışıyken hata fırlatmasını engelle
        });
        return cachedResponse;
      }

      // Önbellekte yoksa ağdan çek
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Çevrimdışıyken ve önbellekte yoksa index.html döndür
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
