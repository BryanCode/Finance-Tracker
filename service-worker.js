const CACHE_NAME = 'finance-tracker-v1';
const urlsToCache = [
  '/finance-tracker/',
  '/finance-tracker/index.html',
  '/finance-tracker/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/js/bootstrap.bundle.min.js',
  'https://fonts.googleapis.com/css2?family=Georama:wght@300;400;600;700&display=swap'
];

// Instalar Service Worker e fazer cache dos recursos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Ativar Service Worker e limpar caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interceptar requisições e servir do cache quando possível
self.addEventListener('fetch', event => {
  // Não fazer cache de requisições para o Firebase
  if (event.request.url.includes('firebaseio.com')) {
    return event.respondWith(fetch(event.request));
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retorna do cache se encontrado
        if (response) {
          return response;
        }

        // Caso contrário, busca da rede
        return fetch(event.request).then(response => {
          // Verifica se recebeu uma resposta válida
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clona a resposta
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
      .catch(() => {
        // Retorna uma página offline personalizada se necessário
        return caches.match('/finance-tracker/index.html');
      })
  );
});