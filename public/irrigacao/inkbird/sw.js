const CACHE='fazenda2e-irrigacao-v1';
const SHELL=[
  '/irrigacao/inkbird/',
  '/irrigacao/inkbird/manifest.webmanifest',
  '/irrigacao/inkbird/icon.svg'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).catch(()=>null));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.pathname.startsWith('/api/'))return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put('/irrigacao/inkbird/',copy)).catch(()=>null);
      return response;
    }).catch(()=>caches.match('/irrigacao/inkbird/')));
    return;
  }
  if(url.origin===self.location.origin&&url.pathname.startsWith('/irrigacao/inkbird/')){
    event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
  }
});