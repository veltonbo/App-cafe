self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json?.()||{}}catch{data={body:event.data?.text?.()||''}}
  const level=String(data.level||'info');
  const title=String(data.title||'Fazenda 2E');
  const options={
    body:String(data.body||'Atualização da Fazenda 2E.'),
    tag:String(data.tag||'fazenda2e'),
    renotify:level==='critical',
    requireInteraction:level==='critical',
    data:{url:String(data.url||'/irrigacao/'),level,ts:data.ts||Date.now()},
    icon:'/irrigacao/icon-192.svg',
    badge:'/irrigacao/icon-192.svg'
  };
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'/f2e/',self.location.origin).href;
  event.waitUntil((async()=>{
    const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){if('focus'in client){await client.focus();if('navigate'in client)await client.navigate(target);return}}
    if(clients.openWindow)return clients.openWindow(target);
  })());
});
