(()=>{
  'use strict';
  const runtime=window.__viveiroRuntime;
  if(!runtime)return;

  let stopped=false;
  let connecting=false;
  let reconnectDelay=1000;
  let dashboardTimer=0;

  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const getData=()=>runtime.getData?.()||{};

  function markLive(patch={}){
    const data=getData();
    data.live={...(data.live||{}),...patch};
    runtime.save?.();
    window.dispatchEvent(new CustomEvent('viveiro-live-update',{detail:data.live}));
  }

  function scheduleDashboardRefresh(){
    clearTimeout(dashboardTimer);
    dashboardTimer=setTimeout(()=>runtime.syncDashboard?.(false),350);
  }

  function applyEvent(event){
    if(!event||typeof event!=='object')return;
    const data=getData();
    const payload=event.payload||{};
    const at=Number(event.at||Date.now());

    markLive({connected:true,lastEventAt:at,lastType:String(event.type||'message')});

    if(event.type==='seconds'&&payload.state){
      const st=payload.state;
      data.secondsMode={...(data.secondsMode||{}),...st};
      if(typeof st.device_relay==='boolean')data.relay=st.device_relay;
      data.live={...(data.live||{}),secondsAt:at};
      runtime.markSecondsFresh?.(Number(st.server_read_at||at));
      runtime.syncSecondsEditorFromState?.(data.secondsMode,false);
      runtime.save?.();
      runtime.renderSecondsControlsOnly?.();
      runtime.renderSecondsRuntimeOnly?.();
      runtime.renderConnectionRuntimeOnly?.();
      runtime.renderDashboard?.();
    }

    if(event.type==='weather'&&payload.weather){
      data.weatherProtection={
        ...(data.weatherProtection||{}),
        state:payload.state||data.weatherProtection?.state||{},
        config:payload.config||data.weatherProtection?.config||{},
        weather:payload.weather
      };
      if(data.dashboard){
        data.dashboard={
          ...data.dashboard,
          current_weather:payload.weather,
          weather:{
            ...(data.dashboard.weather||{}),
            state:payload.state||data.dashboard.weather?.state||{},
            config:payload.config||data.dashboard.weather?.config||{}
          }
        };
      }
      data.live={...(data.live||{}),weatherAt:at};
      runtime.save?.();
      runtime.renderWeatherRuntimeOnly?.();
      runtime.renderDashboard?.();
    }

    if(event.type==='confirmation'){
      data.live={
        ...(data.live||{}),
        confirmationAt:at,
        lastConfirmation:payload
      };
      if(payload.command==='on')data.relay=true;
      if(payload.command==='off')data.relay=false;
      runtime.save?.();
      runtime.renderConnectionRuntimeOnly?.();
      runtime.renderDashboard?.();
    }

    if(event.type==='watchdog'){
      data.live={...(data.live||{}),watchdogAt:at,watchdog:payload};
      runtime.save?.();
      runtime.renderDashboard?.();
    }

    if(event.type==='event'){
      data.live={...(data.live||{}),eventAt:at};
      runtime.save?.();
      scheduleDashboardRefresh();
    }

    if(event.type==='server'){
      data.live={...(data.live||{}),serverAt:at};
      runtime.save?.();
    }
  }

  function parseSseBlock(block){
    const rows=String(block||'').split(/\r?\n/);
    const dataRows=rows
      .filter(line=>line.startsWith('data:'))
      .map(line=>line.slice(5).trimStart());
    if(!dataRows.length)return;
    try{applyEvent(JSON.parse(dataRows.join('\n')))}catch{}
  }

  async function openStream(){
    const data=getData();
    const token=String(data.settings?.token||'');
    const base=String(data.settings?.apiUrl||location.origin).replace(/\/$/,'');
    if(!token||!base||!navigator.onLine)return false;

    const response=await fetch(base+'/api/viveiro/live',{
      method:'GET',
      headers:{Authorization:'Bearer '+token,Accept:'text/event-stream'},
      cache:'no-store',
      credentials:'same-origin'
    });
    if(!response.ok||!response.body)throw new Error('Tempo real indisponível ('+response.status+').');

    markLive({connected:true,connectedAt:Date.now(),lastError:null});
    reconnectDelay=1000;

    const reader=response.body.getReader();
    const decoder=new TextDecoder();
    let buffer='';
    while(!stopped){
      const {done,value}=await reader.read();
      if(done)break;
      buffer+=decoder.decode(value,{stream:true});
      let cut;
      while((cut=buffer.indexOf('\n\n'))>=0){
        const block=buffer.slice(0,cut);
        buffer=buffer.slice(cut+2);
        parseSseBlock(block);
      }
    }
    return true;
  }

  async function loop(){
    if(connecting)return;
    connecting=true;
    while(!stopped){
      try{
        await openStream();
      }catch(error){
        markLive({connected:false,disconnectedAt:Date.now(),lastError:String(error?.message||error)});
      }
      if(stopped)break;
      markLive({connected:false,disconnectedAt:Date.now()});
      await sleep(reconnectDelay);
      reconnectDelay=Math.min(10000,Math.round(reconnectDelay*1.6));
    }
    connecting=false;
  }

  window.addEventListener('online',()=>{reconnectDelay=500;loop()});
  window.addEventListener('offline',()=>markLive({connected:false,disconnectedAt:Date.now(),lastError:'Sem internet'}));
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'){
      markLive({resumedAt:Date.now()});
      runtime.syncSecondsMode?.(false);
      runtime.syncDashboard?.(false);
    }
  });

  window.__viveiroLive={
    start:loop,
    stop:()=>{stopped=true},
    connected:()=>Boolean(getData().live?.connected),
    ageMs:key=>{
      const at=Number(getData().live?.[key]||0);
      return at?Math.max(0,Date.now()-at):Infinity;
    }
  };

  loop();
})();
