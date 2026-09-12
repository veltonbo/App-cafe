const CACHE='fazenda2e-viveiro-live-v12';
const FALLBACK='/irrigacao/';

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.add(FALLBACK)).catch(()=>null));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.pathname.startsWith('/api/'))return;
  if(url.origin!==self.location.origin||!url.pathname.startsWith('/irrigacao/'))return;
  event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{
    if(event.request.mode==='navigate'&&response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(FALLBACK,copy)).catch(()=>null);}
    return response;
  }).catch(()=>event.request.mode==='navigate'?caches.match(FALLBACK):caches.match(event.request)));
});
