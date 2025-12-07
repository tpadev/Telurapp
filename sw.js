self.addEventListener('install', e=>{
  self.skipWaiting();
  e.waitUntil(
    caches.open('egg-order-cache-v2').then(cache=>{
      return cache.addAll(['./','./index.html','./style.css','./app.js','./manifest.json']);
    })
  );
});
self.addEventListener('fetch', e=>{
  e.respondWith(caches.match(e.request).then(resp=>resp || fetch(e.request)));
});
