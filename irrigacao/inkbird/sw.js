const CACHE='fazenda2e-cafe-v3';
const SHELL=[
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/cafe-ui-v2.css'
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
      caches.match(event.request).then(cached=>cached||fetch(event.request))
    );
  }
});