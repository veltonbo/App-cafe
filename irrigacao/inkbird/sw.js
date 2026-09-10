const CACHE='fazenda2e-cafe-clean-v3';
const SHELL=[
  '/',
  '/app.css?v=20260909-3',
  '/app.js?v=20260909-3',
  '/manifest.webmanifest',
  '/icon.svg'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).catch(()=>null));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.pathname.startsWith('/api/'))return;

  if(event.request.mode==='navigate'){
    event.respondWith(
      fetch(event.request).then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put('/',copy)).catch(()=>null);
        return response;
      }).catch(()=>caches.match('/'))
    );
    return;
  }

  if(url.origin===self.location.origin){
    event.respondWith(
      fetch(event.request).then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>null);
        return response;
      }).catch(()=>caches.match(event.request))
    );
  }
});