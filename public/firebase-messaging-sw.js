importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Must aggressively match your src/lib/firebase.js configuration
const firebaseConfig = {
  apiKey: "AIzaSyAaPTIOqw_cstCglnEqedLWGgl1QWhAZDs",
  authDomain: "gym-saas-7b525.firebaseapp.com",
  projectId: "gym-saas-7b525",
  storageBucket: "gym-saas-7b525.firebasestorage.app",
  messagingSenderId: "253347451905",
  appId: "1:253347451905:web:cca6ab8638add063c9dc00"
};

// Initialize Firebase in the service worker
firebase.initializeApp(firebaseConfig);

// Retrieve firebase messaging
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'GymFlow Alert';
  const notificationOptions = {
    body: payload.notification?.body || 'Members expiring soon.',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [200, 100, 200],
    data: {
      url: payload.data?.click_action || '/'
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        // If so, just focus it
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // If none, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
