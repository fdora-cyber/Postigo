// Postigo · service worker: guarda la app en el móvil para que abra rápido y sin conexión.
const VERSION = 'postigo-v3';
const ARCHIVOS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // "Compartir → Postigo": guarda el archivo y abre la app con el formulario de gasto
  if (e.request.method === 'POST' && url.pathname.endsWith('/compartir')) {
    e.respondWith((async () => {
      try {
        const datos = await e.request.formData();
        const f = datos.get('factura');
        if (f && f.size) {
          const c = await caches.open('postigo-compartido');
          await c.put('compartido-archivo', new Response(f, { headers: {
            'Content-Type': f.type || 'application/octet-stream', 'X-Nombre': encodeURIComponent(f.name || 'factura') } }));
        }
      } catch (err) { /* sin archivo */ }
      return Response.redirect('./?compartido=1', 303);
    })());
    return;
  }
  // Solo los archivos propios de la app; las llamadas a la hoja (script.google.com) van siempre por red.
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Red primero (para recibir actualizaciones); si no hay conexión, la copia guardada.
  e.respondWith(
    fetch(e.request)
      .then(r => { const copia = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
