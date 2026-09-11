const CACHE='fazenda2e-viveiro-clean-v10';
const SHELL=[
  '/irrigacao/',
  '/irrigacao/app.css?v=20260911-6',
  '/irrigacao/app.js?v=20260911-6',
  '/irrigacao/manifest.webmanifest',
  '/irrigacao/icon.svg'
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
      fetch(event.request,{cache:'no-store'}).then(response=>{
        if(url.pathname==='/irrigacao/'||url.pathname==='/irrigacao'){
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put('/irrigacao/',copy)).catch(()=>null);
        }
        return response;
      }).catch(()=>caches.match('/irrigacao/'))
    );
    return;
  }

  if(url.origin===self.location.origin&&url.pathname.startsWith('/irrigacao/')){
    event.respondWith(
      fetch(event.request,{cache:'no-store'}).then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>null);
        return response;
      }).catch(()=>caches.match(event.request))
    );
  }
});
