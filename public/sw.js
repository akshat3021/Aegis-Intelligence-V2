// public/sw.js
// Aegis Intelligence Service Worker — Push Notifications

const CACHE_NAME = 'aegis-v2';
const ASSETS = ['/', '/manifest.json'];

// ── INSTALL ───────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// ── ACTIVATE ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── PUSH NOTIFICATION ─────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'Aegis Intelligence', body: 'Your companion is waiting!', icon: '/aegis-logo.svg', badge: '/aegis-logo.svg', tag: 'aegis-reminder' };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch (_) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:  data.body,
      icon:  data.icon,
      badge: data.badge,
      tag:   data.tag,
      vibrate: [200, 100, 200],
      actions: [
        { action: 'open',    title: '🚀 Open Aegis' },
        { action: 'dismiss', title: '✕ Dismiss'     },
      ],
      data: { url: '/' },
    })
  );
});

// ── NOTIFICATION CLICK ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      const existing = clientList.find(c => c.url.includes(self.location.origin) && 'focus' in c);
      if (existing) return existing.focus();
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});

// ── SCHEDULED LOCAL REMINDERS (via postMessage) ───────────────────────────────
// The app sends a message to schedule daily check-in reminders.
// Bug #21 fix: declared as a proper variable instead of `self.reminderConfig`
// which was an undeclared dynamic property on the SW global scope.
let reminderConfig = null;

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SCHEDULE_REMINDER') {
    const { companionName, userName, reminderHour } = event.data;
    // Store reminder config for use when push events arrive
    reminderConfig = { companionName, userName, reminderHour };
  }
});