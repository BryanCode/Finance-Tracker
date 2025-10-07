const CACHE_NAME = 'finance-tracker-v1';
const NOTIFICATION_TIME = '18:00'; // Horário desejado (6 PM)

const urlsToCache = [
  '/finance-tracker/',
  '/finance-tracker/index.html',
  '/finance-tracker/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/js/bootstrap.bundle.min.js',
  'https://fonts.googleapis.com/css2?family=Georama:wght@300;400;600;700&display=swap'
];

// Função para calcular o tempo até a próxima notificação
function getTimeUntilNotification() {
  const now = new Date();
  const [targetHour, targetMinute] = NOTIFICATION_TIME.split(':').map(Number);
  
  const targetTime = new Date();
  targetTime.setHours(targetHour, targetMinute, 0, 0);
  
  // Se o horário já passou hoje, agenda para amanhã
  if (now > targetTime) {
    targetTime.setDate(targetTime.getDate() + 1);
  }
  
  return targetTime.getTime() - now.getTime();
}

// Função para agendar notificação diária
async function scheduleDailyNotification() {
  const timeUntilNotification = getTimeUntilNotification();
  
  // Agenda a notificação
  setTimeout(() => {
    showScheduledNotification();
    // Reagenda para o próximo dia
    scheduleDailyNotification();
  }, timeUntilNotification);
}

// Função para mostrar notificação agendada
async function showScheduledNotification() {
  const title = '💸 Controle de Finanças';
  const options = {
    body: 'Hora de atualizar seus gastos de hoje!',
    icon: '/finance-tracker/icons/icon-192x192.png',
    badge: '/finance-tracker/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    tag: 'daily-reminder',
    requireInteraction: true,
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 2,
      url: '/finance-tracker/'
    },
    actions: [
      {
        action: 'open',
        title: 'Registrar Gastos',
        icon: '/finance-tracker/icons/icon-72x72.png'
      },
      {
        action: 'snooze',
        title: 'Lembrar mais tarde',
        icon: '/finance-tracker/icons/icon-72x72.png'
      }
    ]
  };

  await self.registration.showNotification(title, options);
}

// Instalar Service Worker e iniciar agendamento
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

// Ativar Service Worker e iniciar agendamento de notificações
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      // Limpar caches antigos
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('Removendo cache antigo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Iniciar agendamento de notificações
      self.registration.getNotifications().then(notifications => {
        notifications.forEach(notification => notification.close());
      })
    ])
  );
  
  // Iniciar o agendamento de notificações
  scheduleDailyNotification();
  self.clients.claim();
});

// ⭐⭐ ADICIONE AQUI O LISTENER DE MENSAGENS ⭐⭐
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SET_NOTIFICATION_TIME') {
    NOTIFICATION_TIME = event.data.time;
    // Reiniciar o agendamento com novo horário
    scheduleDailyNotification();
  }
});


// Interceptar requisições (mantenha o código original)
self.addEventListener('fetch', event => {
  if (event.request.url.includes('firebaseio.com')) {
    return event.respondWith(fetch(event.request));
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          return response;
        });
      })
      .catch(() => {
        return caches.match('/finance-tracker/index.html');
      })
  );
});

// Listener para notificações push (mantenha o original)
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  
  const title = data.title || 'Controle de Finanças';
  const options = {
    body: data.body || 'Atualize seus dados financeiros',
    icon: '/finance-tracker/icons/icon-192x192.png',
    badge: '/finance-tracker/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    tag: 'finance-update',
    requireInteraction: false,
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
      url: data.url || '/finance-tracker/'
    },
    actions: [
      {
        action: 'open',
        title: 'Abrir App',
        icon: '/finance-tracker/icons/icon-72x72.png'
      },
      {
        action: 'close',
        title: 'Fechar',
        icon: '/finance-tracker/icons/icon-72x72.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Listener para cliques em notificações (atualizado)
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  } else if (event.action === 'snooze') {
    // Reagendar notificação para 1 hora depois
    event.waitUntil(
      new Promise(resolve => {
        setTimeout(() => {
          showScheduledNotification();
          resolve();
        }, 60 * 60 * 100); // 1 hora
      })
    );
  } else if (event.action === 'close') {
    // Simplesmente fecha a notificação
    console.log('Notificação fechada');
  }
});

// Sincronização periódica em background
self.addEventListener('periodicsync', event => {
  if (event.tag === 'sync-finances') {
    event.waitUntil(syncFinancesData());
  }
});

async function syncFinancesData() {
  try {
    const response = await fetch('https://teste-geocode-7f072-default-rtdb.firebaseio.com/assets.json');
    const data = await response.json();
    
    if (data) {
      await self.registration.showNotification('Dados Atualizados', {
        body: 'Seus dados financeiros foram sincronizados',
        icon: '/finance-tracker/icons/icon-192x192.png',
        badge: '/finance-tracker/icons/icon-72x72.png',
        tag: 'finance-sync'
      });
    }
  } catch (error) {
    console.error('Erro ao sincronizar dados:', error);
  }
}