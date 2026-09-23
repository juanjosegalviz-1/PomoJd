self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });
// Al tocar el aviso, vuelve al foco (la página que ya estaba abierta)
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) { try { await w.focus(); return; } catch {} }
    await self.clients.openWindow('./index.html');
  })());
});
self.addEventListener('fetch', () => {});
