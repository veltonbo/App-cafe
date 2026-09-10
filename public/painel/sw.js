const CACHE='fazenda2e-painel-v1';
const SHELL=['/','/app.css?v=1','/app.js?v=1','/manifest.webmanifest','/icon.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>null));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(u.pathname.startsWith('/api/'))return;
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put('/',copy)).catch(()=>null);return r}).catch(()=>caches.match('/')));
    return;
  }
  if(u.origin===self.location.origin)e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});