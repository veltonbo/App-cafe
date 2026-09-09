const CACHE='fazenda2e-viveiro-v1';
const SHELL=['/irrigacao/','/irrigacao/manifest.webmanifest','/irrigacao/icon.svg'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>null));
  self.skipWaiting();
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(u.pathname.startsWith('/api/'))return;
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request).catch(()=>caches.match('/irrigacao/')));
    return;
  }
  if(u.origin===location.origin&&u.pathname.startsWith('/irrigacao/')){
    e.respondWith(caches.match(e.request).then(x=>x||fetch(e.request)));
  }
});
