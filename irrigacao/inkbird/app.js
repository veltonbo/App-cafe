(()=>{
'use strict';

const APP_KEY='fazenda2eCafeIrrigacaoV1';
const LEGACY_KEY='fazenda2eCentralIrrigacaoV3';
const DEFAULT_API=location.origin;
const DAYS=[['D',1],['S',2],['T',4],['Q',8],['Q',16],['S',32],['S',64]];
const $=id=>document.getElementById(id);
const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));

let store={};
try{store=JSON.parse(localStorage.getItem(APP_KEY)||'null')||JSON.parse(localStorage.getItem(LEGACY_KEY)||'null')||{}}catch{store={}}
store.settings=store.settings||{apiUrl:DEFAULT_API,token:''};
store.zonePrefs=store.zonePrefs||{};
store.selectedControllerId=store.selectedControllerId||null;
if(location.hostname.endsWith('.up.railway.app'))store.settings.apiUrl=DEFAULT_API;
if(!store.settings.apiUrl)store.settings.apiUrl=DEFAULT_API;

const app={
  dashboard:null,
  history:[],
  schedules:{},
  activeView:'summary',
  loading:false,
  pollTimer:null,
  historyTimer:null,
  lastDashboardAt:0,
  selectedZoneForSchedule:0
};

function saveStore(){try{localStorage.setItem(APP_KEY,JSON.stringify(store))}catch{}}
function toast(msg){
  const el=$('toast');el.textContent=String(msg||'');el.classList.add('show');
  clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2600);
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function num(v,d=0){const n=Number(v);return Number.isFinite(n)?n:d}
function pad(v){return String(Math.max(0,Math.round(num(v)))).padStart(2,'0')}
function apiBase(){return String(store.settings.apiUrl||DEFAULT_API).replace(/\/$/,'')}
async function api(path,opt={}){
  if(!store.settings.token)throw new Error('Token de controle não configurado.');
  const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),14000);
  try{
    const r=await fetch(apiBase()+path,{
      ...opt,signal:ctl.signal,
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+store.settings.token,...(opt.headers||{})}
    });
    const body=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(body?.error||body?.detail||('HTTP '+r.status));
    return body;
  }finally{clearTimeout(timer)}
}
function fmtAge(ts){
  const ms=Date.now()-num(ts);
  if(!ts||ms<0)return'—';
  if(ms<1000)return'agora';
  if(ms<60000)return Math.round(ms/1000)+' s';
  if(ms<3600000)return Math.round(ms/60000)+' min';
  return Math.round(ms/3600000)+' h';
}
function fmtClock(ts){
  if(!ts)return'—';
  return new Date(num(ts)).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
}
function fmtDateTime(ts){
  if(!ts)return'—';
  return new Date(num(ts)).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
}
function fmtMinutes(v){
  const m=Math.max(0,Math.round(num(v)));
  if(m<60)return m+' min';
  const h=Math.floor(m/60),r=m%60;
  return r?h+' h '+r+' min':h+' h';
}
function setDot(id,state){
  const el=$(id);if(!el)return;el.className=state===true?'ok':state===false?'bad':'warn';
}
function setBadge(id,text,tone=''){
  const el=$(id);if(!el)return;el.textContent=text;el.className='badge'+(tone?' '+tone:'');
}
function controllers(){return app.dashboard?.controllers||[]}
function selectedController(){
  const rows=controllers();
  return rows.find(c=>c.id===store.selectedControllerId)||rows[0]||null;
}
function selectedRuntime(){return app.dashboard?.runtime||{}}
function selectedActive(){return app.dashboard?.active_session||null}
function sectorStart(c){return num(c?.sector_start,(num(c?.controller_index,1)-1)*8+1)}
function ensurePrefs(c){
  if(!c)return[];
  let prefs=Array.isArray(store.zonePrefs[c.id])?store.zonePrefs[c.id]:[];
  if(prefs.length!==8){
    const start=sectorStart(c);
    prefs=Array.from({length:8},(_,i)=>({
      name:prefs[i]?.name||('Setor '+pad(start+i)),
      duration:num(prefs[i]?.duration,10)||10
    }));
    store.zonePrefs[c.id]=prefs;saveStore();
  }
  return prefs;
}
function activeMask(){
  const rt=selectedRuntime();
  return num(rt.active_mask)||num(rt.pending_mask);
}
function zoneIsOn(zone){return Boolean(activeMask()&(1<<(zone-1)))}
function weatherMetrics(){return app.dashboard?.weather?.metrics||{}}
function currentSchedule(zone){
  const c=selectedController();
  const channels=app.schedules[c?.id]?.channels||[];
  return channels.find(ch=>num(ch.zone)===num(zone))||null;
}

function showView(name){
  app.activeView=name;
  qsa('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+name));
  qsa('.bottomNav button').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  window.scrollTo({top:0,behavior:'smooth'});
  if(name==='sectors')loadSchedule(false);
  if(name==='system')loadHistory(false);
}
qsa('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));

function renderHeader(){
  const ok=Boolean(app.dashboard?.ok);
  const ctrl=selectedController();
  const ctrlOk=ctrl?.online===true;
  const audit=app.dashboard?.audit||{};
  const auditStatus=String(audit.status||'checking');
  $('headerText').textContent=!store.settings.token
    ?'Configurar'
    :!ok?'Reconectando'
    :auditStatus==='critical'?'Atenção'
    :auditStatus==='warning'?'Alerta'
    :ctrlOk?'Online':'Atenção';
  setDot('headerDot',
    !store.settings.token?null
    :!ok?false
    :auditStatus==='critical'?false
    :auditStatus==='warning'?null
    :ctrlOk?true:null
  );
  $('offlineBar').hidden=navigator.onLine&&ok;
}
function renderHero(){
  const d=app.dashboard||{},c=selectedController(),active=selectedActive(),mask=activeMask();
  let title='AGUARDANDO',detail='Nenhum controlador disponível.';
  if(c){
    if(c.online===false){title='CONTROLADOR OFFLINE';detail='O IIC-800 não está respondendo pelo Smart Life.'}
    else if(mask||active){
      if(active?.kind==='group'){
        title='IRRIGANDO GRUPO';
        detail=(active.name||'Grupo de setores')+' • sequência em andamento.';
      }else{
        const sector=num(active?.sector)||sectorStart(c)+Math.max(0,Math.floor(Math.log2(mask||1)));
        title='IRRIGANDO';
        detail='Setor '+pad(sector)+' em execução pelo IIC-800.';
      }
    }else{
      title='PRONTO';
      detail='IIC-800 online e disponível para irrigação.';
    }
  }
  $('heroTitle').textContent=title;$('heroDetail').textContent=detail;
  $('heroMark').textContent=mask||active?'ON':'C';

  const next=d.next_schedule;
  if(next){
    const day=next.day_offset===0?'Hoje':next.day_offset===1?'Amanhã':'Em '+next.day_offset+' dias';
    $('nextSchedule').textContent='Setor '+pad(next.sector)+' • '+next.time;
    $('nextScheduleSub').textContent=day+' • '+fmtMinutes(next.duration_minutes);
  }else{
    $('nextSchedule').textContent='Nenhuma';
    $('nextScheduleSub').textContent='programação encontrada';
  }

  setDot('controllerDot',c?c.online!==false:null);
  setDot('weatherDot',d.weather?.linked&&d.weather?.device?.online!==false&&!d.weather?.error);
  setDot('serverDot',Boolean(d.server?.online));
  $('controllerFresh').textContent=c?.online===false?'offline':'online';
  $('weatherFresh').textContent=fmtAge(d.weather?.checked_at);
  $('serverFresh').textContent=fmtAge(d.server?.at);
}
function renderSummary(){
  const t=app.dashboard?.summary?.today||{};
  $('todaySessions').textContent=String(num(t.sessions));
  $('todayCompleted').textContent=num(t.completed)+' concluídas';
  $('todaySectors').textContent=String(num(t.sectors));
  $('todayMinutes').textContent=fmtMinutes(t.completed_minutes);
  $('todayBlocked').textContent=String(num(t.blocked));
  $('todayErrors').textContent=num(t.errors)+' falhas';

  const m=weatherMetrics();
  const temp=m.temperature?.value,hum=m.humidity?.value;
  const rain=m.rainGeneric?.value??m.rain24h?.value??m.rainToday?.value;
  $('sumTemp').textContent=Number.isFinite(Number(temp))?Number(temp).toFixed(1)+' °C':'—';
  $('sumHumidity').textContent=Number.isFinite(Number(hum))?Math.round(Number(hum))+'%':'—';
  $('sumRain').textContent=m.rainDetected?'Detectada':Number.isFinite(Number(rain))?Number(rain).toFixed(1)+' mm':'0.0 mm';
  const policy=app.dashboard?.config?.weather||{};
  $('sumProtection').textContent=policy.enabled===false?'Desligada':m.rainDetected?'Bloqueando':'Ativa';

  const audit=app.dashboard?.audit||{};
  const auditIssues=Array.isArray(audit.issues)?audit.issues:[];
  const auditStatus=String(audit.status||'checking');
  $('auditSummaryIcon').textContent=auditStatus==='critical'?'!':auditStatus==='warning'?'•':'✓';
  $('auditSummaryTitle').textContent=
    auditStatus==='critical'?'Atenção necessária':
    auditStatus==='warning'?'Há um alerta':
    auditStatus==='checking'?'Verificando':'Tudo coerente';
  $('auditSummaryDetail').textContent=audit.message||(
    auditIssues.length?auditIssues[0]?.message:'Nenhuma anomalia detectada.'
  );
  $('auditSummaryCard').className='auditSummaryCard'+(
    auditStatus==='critical'?' critical':auditStatus==='warning'?' warning':''
  );

  const reportStatus=String(app.dashboard?.reports?.status_today||'normal');
  $('cafeDayStatusTitle').textContent=reportStatus==='critical'?'CRÍTICO':reportStatus==='warning'?'ATENÇÃO':'NORMAL';
  $('cafeDayStatusDetail').textContent=reportStatus==='critical'
    ?'Existe uma falha ou incidente crítico registrado hoje.'
    :reportStatus==='warning'
      ?'Há uma ocorrência ou bloqueio que merece acompanhamento.'
      :'Irrigações, programações e clima sem ocorrência crítica hoje.';
  $('cafeDayStatusCard').className='dayStatusCard '+reportStatus;
  setBadge('cafeDayStatusBadge',reportStatus==='critical'?'CRÍTICO':reportStatus==='warning'?'ATENÇÃO':'NORMAL',reportStatus==='critical'?'bad':reportStatus==='warning'?'warn':'');

  const c=selectedController(),prefs=ensurePrefs(c),mask=activeMask();
  $('controllerLabel').textContent=c?'CONTROLADOR '+num(c.controller_index,1):'IIC-800';
  $('controllerName').textContent=c?.name||'Nenhum controlador';
  setBadge('controllerBadge',!c?'SEM CONTROLADOR':c.online===false?'OFFLINE':'ONLINE',c?.online===false?'bad':'');
  $('sectorMiniGrid').innerHTML=c?prefs.map((p,i)=>{
    const zone=i+1,sector=sectorStart(c)+i,on=Boolean(mask&(1<<i));
    return '<div class="sectorMini'+(on?' on':'')+'"><small>'+esc(p.name||('Setor '+pad(sector)))+'</small><strong>'+(on?'ON':pad(sector))+'</strong></div>';
  }).join(''):'<div class="eventItem"><div class="eventIcon">!</div><div><b>Nenhum IIC-800</b><small>Conecte o controlador no Smart Life.</small></div></div>';

  renderRecent();
}
function eventLabel(h){
  const sector=num(h.sector);
  if(h.type==='start')return sector?'Setor '+pad(sector)+' iniciado':'Irrigação iniciada';
  if(h.type==='complete')return sector?'Setor '+pad(sector)+' concluído':(h.detail||'Irrigação concluída');
  if(h.type==='stop')return sector?'Setor '+pad(sector)+' parado':'Irrigação parada';
  if(h.type==='group_start')return h.detail||'Grupo iniciado';
  if(h.type==='group_blocked')return'Grupo bloqueado';
  if(h.type==='blocked')return sector?'Setor '+pad(sector)+' bloqueado':'Irrigação bloqueada';
  if(h.type==='schedule')return sector?'Programação do Setor '+pad(sector):'Programação atualizada';
  if(h.type==='mode')return'Modo automático restaurado';
  return h.detail||'Evento do Café';
}
function eventIcon(h){
  if(h.type==='start'||h.type==='group_start')return'▶';
  if(h.type==='complete')return'✓';
  if(h.type==='stop'||h.type==='mode')return'■';
  if(String(h.type||'').includes('blocked'))return'!';
  if(h.type==='schedule')return'P';
  return'•';
}
function renderRecent(){
  const rows=(app.history.length?app.history:app.dashboard?.recent_history||[]).slice(0,8);
  $('recentList').innerHTML=rows.length?rows.map(h=>{
    const detail=h.duration_minutes?fmtMinutes(h.duration_minutes):(h.status||h.source||'');
    return '<div class="eventItem"><div class="eventIcon">'+esc(eventIcon(h))+'</div><div><b>'+esc(eventLabel(h))+'</b><small>'+esc(detail)+'</small></div><span class="eventTime">'+esc(fmtDateTime(h.ts||Date.parse(h.at||0)))+'</span></div>';
  }).join(''):'<div class="eventItem"><div class="eventIcon">•</div><div><b>Sem eventos recentes</b><small>As irrigações do Café aparecerão aqui.</small></div></div>';
}
function renderSectors(){
  const c=selectedController();
  $('controllerSelect').innerHTML=controllers().length?controllers().map(ctrl=>
    '<option value="'+esc(ctrl.id)+'"'+(ctrl.id===c?.id?' selected':'')+'>Controlador '+num(ctrl.controller_index,1)+' • Setores '+pad(ctrl.sector_start)+'–'+pad(ctrl.sector_end)+'</option>'
  ).join(''):'<option value="">Nenhum controlador</option>';
  const health=$('selectedControllerHealth');
  health.querySelector('span').textContent=!c?'Sem controlador':c.online===false?'Offline':'Online';
  health.querySelector('i').className=!c?'warn':c.online===false?'bad':'ok';

  if(!c){
    $('sectorGrid').innerHTML='<article class="sectorCard"><div class="sectorName">Nenhum controlador disponível</div><div class="sectorMeta">Adicione o IIC-800 ao Smart Life e atualize.</div></article>';
    return;
  }
  const prefs=ensurePrefs(c),mask=activeMask(),active=selectedActive();
  $('sectorGrid').innerHTML=prefs.map((p,i)=>{
    const zone=i+1,sector=sectorStart(c)+i,on=Boolean(mask&(1<<i));
    const mins=Math.max(1,Math.round(num(p.duration,10)));
    const schedule=currentSchedule(zone);
    const schedText=schedule?.enabled&&schedule.start_times?.length
      ?schedule.start_times.map(x=>typeof x==='string'?x:x?.value).filter(Boolean).join(', ')
      :'Sem programação';
    const activity=app.dashboard?.sector_activity?.[c.id]?.[zone]||{};
    const lastText=activity.last_start_at
      ?'Última: '+fmtDateTime(activity.last_start_at)
      :'Última: sem registro';
    const sevenText='7 dias: '+num(activity.starts_7d)+' irrigações • '+fmtMinutes(activity.planned_minutes_7d);
    return '<article class="sectorCard'+(on?' on':'')+'" data-zone="'+zone+'">'+
      '<div class="sectorTop"><div><div class="sectorName">'+esc(p.name||('Setor '+pad(sector)))+'</div><div class="sectorMeta">Setor '+pad(sector)+' • Zona '+zone+'</div></div><span class="sectorState'+(on?' on':'')+'">'+(on?'IRRIGANDO':'PRONTO')+'</span></div>'+
      '<div class="durationRow"><button data-step="-1" type="button">−</button><input data-duration type="number" min="1" max="1440" value="'+mins+'" inputmode="numeric"><button data-step="1" type="button">+</button></div>'+
      '<div class="quickTimes">'+[5,10,15,20,30].map(v=>'<button data-quick="'+v+'" type="button">'+v+'m</button>').join('')+'</div>'+
      '<div class="sectorMeta" style="margin-top:7px">'+esc(schedText)+'</div>'+
      '<div class="sectorActivity"><span>'+esc(lastText)+'</span><span>'+esc(sevenText)+'</span></div>'+
      '<div class="sectorActions">'+
        '<button class="'+(on?'dangerBtn':'primaryBtn')+'" data-action="'+(on?'stop':'start')+'" type="button">'+(on?'Parar':'Irrigar')+'</button>'+
        '<button class="secondaryBtn" data-action="schedule" type="button">Programar</button>'+
        '<button class="secondaryBtn" data-action="rename" type="button">Renomear</button>'+
      '</div></article>';
  }).join('');

  qsa('.sectorCard').forEach(card=>{
    const zone=num(card.dataset.zone),input=card.querySelector('[data-duration]');
    card.querySelectorAll('[data-step]').forEach(btn=>btn.addEventListener('click',()=>{
      input.value=Math.max(1,Math.min(1440,num(input.value,10)+num(btn.dataset.step)));
      updateDuration(zone,input.value);
    }));
    card.querySelectorAll('[data-quick]').forEach(btn=>btn.addEventListener('click',()=>{
      input.value=num(btn.dataset.quick);updateDuration(zone,input.value);
    }));
    input.addEventListener('change',()=>updateDuration(zone,input.value));
    card.querySelector('[data-action="start"]')?.addEventListener('click',()=>startSector(zone));
    card.querySelector('[data-action="stop"]')?.addEventListener('click',()=>stopSector(zone));
    card.querySelector('[data-action="schedule"]').addEventListener('click',()=>openSchedule(zone));
    card.querySelector('[data-action="rename"]').addEventListener('click',()=>renameSector(zone));
  });
}
function updateDuration(zone,value){
  const c=selectedController();if(!c)return;
  const prefs=ensurePrefs(c),v=Math.max(1,Math.min(1440,Math.round(num(value,10))));
  prefs[zone-1]={...prefs[zone-1],duration:v};store.zonePrefs[c.id]=prefs;saveStore();
}
async function startSector(zone){
  const c=selectedController();if(!c||c.online===false)return toast('Controlador indisponível.');
  const prefs=ensurePrefs(c),duration=Math.max(1,Math.round(num(prefs[zone-1]?.duration,10))),sector=sectorStart(c)+zone-1;
  if(!confirm('IRRIGAR o Setor '+pad(sector)+' por '+duration+' min?'))return;
  try{
    const r=await api('/api/inkbird/zone',{method:'POST',body:JSON.stringify({device_id:c.id,action:'start',zone,duration_minutes:duration})});
    toast('Confirmado: Setor '+pad(sector)+' irrigando.');
    await refreshAll(true);
  }catch(e){toast(e.message)}
}
async function stopSector(zone){
  const c=selectedController();if(!c)return;
  const sector=sectorStart(c)+zone-1;
  if(!confirm('PARAR a irrigação do Setor '+pad(sector)+'?'))return;
  try{
    await api('/api/inkbird/zone',{method:'POST',body:JSON.stringify({device_id:c.id,action:'stop',zone})});
    toast('Irrigação parada.');
    await refreshAll(true);
  }catch(e){toast(e.message)}
}
async function stopAll(){
  const c=selectedController();if(!c)return;
  if(!confirm('PARAR a irrigação manual atual deste IIC-800?'))return;
  try{
    await api('/api/inkbird/zone',{method:'POST',body:JSON.stringify({device_id:c.id,action:'stop'})});
    toast('Irrigação manual parada.');
    await refreshAll(true);
  }catch(e){toast(e.message)}
}
function renameSector(zone){
  const c=selectedController();if(!c)return;
  const prefs=ensurePrefs(c),sector=sectorStart(c)+zone-1;
  const name=prompt('Nome do Setor '+pad(sector),prefs[zone-1]?.name||('Setor '+pad(sector)));
  if(name===null)return;
  prefs[zone-1]={...prefs[zone-1],name:name.trim()||('Setor '+pad(sector))};
  store.zonePrefs[c.id]=prefs;saveStore();renderSectors();renderSummary();
}

function initDays(containerId){
  const el=$(containerId);el.innerHTML=DAYS.map(([label,bit])=>'<button type="button" data-bit="'+bit+'">'+label+'</button>').join('');
  qsa('button',el).forEach(b=>b.addEventListener('click',()=>b.classList.toggle('active')));
}
function setDays(containerId,mask){
  qsa('#'+containerId+' button').forEach(b=>b.classList.toggle('active',Boolean(num(mask)&num(b.dataset.bit))));
}
function readDays(containerId){return qsa('#'+containerId+' button.active').reduce((m,b)=>m|num(b.dataset.bit),0)}
function openSchedule(zone){
  const c=selectedController();if(!c)return;
  app.selectedZoneForSchedule=zone;
  const sector=sectorStart(c)+zone-1,ch=currentSchedule(zone),prefs=ensurePrefs(c);
  $('scheduleTitle').textContent='Setor '+pad(sector);
  $('scheduleEnabled').checked=ch?.enabled===true;
  $('scheduleDuration').value=Math.max(1,Math.round(num(ch?.duration_minutes,prefs[zone-1]?.duration||10)));
  const times=(ch?.start_times||[]).map(x=>typeof x==='string'?x:x?.value).filter(Boolean);
  $('scheduleTime1').value=times[0]||'';
  $('scheduleTime2').value=times[1]||'';
  $('scheduleTime3').value=times[2]||'';
  setDays('scheduleDays',num(ch?.days_mask,127));
  $('scheduleDlg').showModal();
}
async function saveSchedule(enabledOverride=null){
  const c=selectedController(),zone=app.selectedZoneForSchedule;if(!c||!zone)return;
  const enabled=enabledOverride===null?$('scheduleEnabled').checked:Boolean(enabledOverride);
  const times=[$('scheduleTime1').value,$('scheduleTime2').value,$('scheduleTime3').value].filter(Boolean);
  const duration=Math.max(1,Math.min(255,Math.round(num($('scheduleDuration').value,10))));
  const mask=readDays('scheduleDays');
  if(enabled&&!times.length)return toast('Informe pelo menos um horário.');
  if(enabled&&!mask)return toast('Selecione pelo menos um dia.');
  try{
    await api('/api/inkbird/schedule',{method:'POST',body:JSON.stringify({
      device_id:c.id,zone,enabled,duration_minutes:duration,start_times:times,
      cycle_mode:0,days_mask:mask,rain_sensor_follow:true
    })});
    updateDuration(zone,duration);
    $('scheduleDlg').close();
    toast(enabled?'Programação salva.':'Programação desativada.');
    await Promise.all([loadSchedule(true),loadDashboard(false),loadHistory(false)]);
  }catch(e){toast(e.message)}
}
async function loadSchedule(force=false){
  const c=selectedController();if(!c||!store.settings.token)return;
  if(app.schedules[c.id]&&!force){renderSectors();return}
  try{
    const r=await api('/api/inkbird/schedule?device_id='+encodeURIComponent(c.id));
    app.schedules[c.id]=r;renderSectors();
  }catch(e){if(force)toast(e.message)}
}

function openGroup(){
  const c=selectedController();if(!c)return;
  const prefs=ensurePrefs(c);
  $('groupRows').innerHTML=prefs.map((p,i)=>{
    const zone=i+1,sector=sectorStart(c)+i;
    return '<div class="groupRow"><input type="checkbox" data-group-check data-zone="'+zone+'"><div><b>'+esc(p.name||('Setor '+pad(sector)))+'</b><small>Setor '+pad(sector)+'</small></div><input data-group-duration data-zone="'+zone+'" type="number" min="1" max="1440" value="'+Math.max(1,num(p.duration,10))+'"></div>';
  }).join('');
  $('groupDlg').showModal();
}
async function startGroup(){
  const c=selectedController();if(!c)return;
  const zones=qsa('[data-group-check]:checked').map(check=>{
    const z=num(check.dataset.zone);
    const input=$('groupRows').querySelector('[data-group-duration][data-zone="'+z+'"]');
    return{zone:z,duration_minutes:Math.max(1,Math.round(num(input?.value,10)))};
  });
  if(!zones.length)return toast('Selecione pelo menos um setor.');
  const total=zones.reduce((s,x)=>s+x.duration_minutes,0);
  if(!confirm('Iniciar '+zones.length+' setores em sequência? Tempo total programado: '+fmtMinutes(total)+'.'))return;
  try{
    await api('/api/inkbird/group',{method:'POST',body:JSON.stringify({
      device_id:c.id,name:$('groupName').value.trim()||'Grupo de setores',mode:'order',zones
    })});
    $('groupDlg').close();toast('Grupo iniciado.');
    await refreshAll(true);
  }catch(e){toast(e.message)}
}

function renderWeather(){
  const d=app.dashboard||{},w=d.weather||{},m=w.metrics||{},cfg=d.config?.weather||{},ws=d.weather_state||{};
  const temp=m.temperature?.value,hum=m.humidity?.value;
  const rain=m.rainGeneric?.value??m.rain24h?.value??m.rainToday?.value;
  $('weatherTemp').textContent=Number.isFinite(Number(temp))?Number(temp).toFixed(1)+' °C':'—';
  $('weatherHumidity').textContent=Number.isFinite(Number(hum))?Math.round(Number(hum))+'%':'—';
  $('weatherRain').textContent=m.rainDetected?'CHOVENDO':Number.isFinite(Number(rain))?Number(rain).toFixed(1)+' mm':'0.0 mm';
  $('weatherRainDetail').textContent=m.rainDetected?'detectado agora':'sem chuva detectada';
  $('weatherAge').textContent=fmtAge(w.checked_at);

  const lastRain=num(ws.lastRainAt);
  const holdMs=Math.max(0,num(cfg.rainHoldHours,12))*3600000;
  const holdActive=lastRain&&Date.now()<lastRain+holdMs;
  let title='Proteção ativa',detail='Novas irrigações podem iniciar normalmente.',tone='';
  if(cfg.enabled===false){title='Proteção desligada';detail='O clima não bloqueará novas irrigações.';tone='warn'}
  else if(m.rainDetected){title='Irrigação bloqueada pela chuva';detail='A Weather2-2 está detectando chuva neste momento.';tone='bad'}
  else if(holdActive){title='Aguardando após chuva';detail='Retomada liberada em aproximadamente '+fmtMinutes(Math.ceil((lastRain+holdMs-Date.now())/60000))+'.';tone='warn'}
  $('protectionCard').className='protectionCard'+(tone==='bad'?' blocked':'');
  $('protectionTitle').textContent=title;$('protectionDetail').textContent=detail;
  setBadge('protectionBadge',tone==='bad'?'BLOQUEADA':tone==='warn'?'ATENÇÃO':'ATIVA',tone);

  $('weatherEnabled').checked=cfg.enabled!==false;
  $('blockWhileRaining').checked=cfg.blockWhileRaining!==false;
  $('rainThreshold').value=num(cfg.rainThreshold,5);
  $('rainHoldHours').value=num(cfg.rainHoldHours,12);
}
async function saveWeather(){
  try{
    await api('/api/irrigation/config',{method:'PATCH',body:JSON.stringify({weather:{
      enabled:$('weatherEnabled').checked,
      rainThreshold:num($('rainThreshold').value,5),
      rainHoldHours:num($('rainHoldHours').value,12),
      blockWhileRaining:$('blockWhileRaining').checked,
      backgroundProtection:true
    }})});
    toast('Proteção climática atualizada.');await loadDashboard(false);
  }catch(e){toast(e.message)}
}
function renderSystem(){
  const d=app.dashboard||{},c=selectedController(),w=d.weather||{},sum=d.summary?.week_totals||{};
  setDot('svcController',c?c.online!==false:null);$('svcControllerText').textContent=!c?'Ausente':c.online===false?'Offline':'Online';
  const wOk=Boolean(w.linked&&w.device?.online!==false&&!w.error);setDot('svcWeather',wOk);$('svcWeatherText').textContent=wOk?'Online':'Atenção';
  setDot('svcFirebase',d.isolated===true);$('svcFirebaseText').textContent=d.isolated===true?'Isolado':'Verificando';
  setDot('svcServer',d.server?.online===true);$('svcServerText').textContent=d.server?.online?'Online':'Atenção';

  const audit=d.audit||{};
  const auditIssues=Array.isArray(audit.issues)?audit.issues:[];
  const auditStatus=String(audit.status||'checking');
  setBadge('auditBadge',
    auditStatus==='critical'?'CRÍTICO':auditStatus==='warning'?'ATENÇÃO':auditStatus==='checking'?'VERIFICANDO':'NORMAL',
    auditStatus==='critical'?'bad':auditStatus==='warning'?'warn':''
  );
  $('auditMessage').textContent=audit.message||(
    auditIssues.length?auditIssues[0]?.message:'Nenhuma anomalia detectada.'
  );
  $('auditCheckedAt').textContent=audit.checked_at?fmtDateTime(audit.checked_at):'—';
  $('auditList').innerHTML=auditIssues.length
    ?auditIssues.slice(0,10).map(issue=>
      '<div class="auditItem '+(issue.level==='critical'?'critical':'warning')+'">'+
        '<i>'+(issue.level==='critical'?'!':'•')+'</i>'+
        '<span><b>'+(issue.level==='critical'?'Crítico':'Atenção')+'</b><small>'+esc(issue.message||issue.code||'Anomalia')+'</small></span>'+
      '</div>'
    ).join('')
    :'<div class="auditOk"><i>✓</i><span><b>Sistema coerente</b><small>IIC-800, clima, horários e histórico sem anomalia detectada.</small></span></div>';

  $('weekSessions').textContent=String(num(sum.sessions));$('weekCompleted').textContent=String(num(sum.completed));
  $('weekMinutes').textContent=fmtMinutes(sum.completed_minutes);$('weekBlocked').textContent=String(num(sum.blocked));
  const days=d.summary?.week||[],max=Math.max(1,...days.map(x=>num(x.sessions)));
  $('weekChart').innerHTML=days.map(day=>{
    const pct=Math.max(3,Math.round(num(day.sessions)/max*100));
    return '<div class="dayBar"><div class="barArea"><i style="height:'+pct+'%"></i></div><small>'+esc(day.label||'')+'</small></div>';
  }).join('');

  const reports=d.reports||{},trend=reports.trend30||[];
  const trendMax=Math.max(1,...trend.map(x=>num(x.sessions)));
  $('cafeTrend30Chart').innerHTML=trend.map(day=>{
    const pct=Math.max(day.sessions?4:1,Math.round(num(day.sessions)/trendMax*100));
    const tone=day.status==='critical'?' critical':day.status==='warning'?' warning':'';
    return '<div class="trendDay'+tone+'" title="'+esc(day.label+' • '+num(day.sessions)+' irrigações')+'"><i style="height:'+pct+'%"></i><small>'+esc(String(day.key||'').slice(-2))+'</small></div>';
  }).join('')||'<div class="panelNote">Sem histórico suficiente.</div>';
  setBadge('cafeTrendBadge',trend.length+' DIAS','');

  const activeDays=trend.filter(x=>num(x.sessions)>0);
  let trendNote='Sem histórico suficiente para tendência.';
  if(activeDays.length>=2){
    const first=activeDays[0],last=activeDays.at(-1);
    const delta=num(last.sessions)-num(first.sessions);
    trendNote=delta===0
      ?'A frequência diária permaneceu estável entre os dias com irrigação.'
      :delta>0
        ?'A frequência de irrigação aumentou nos dias mais recentes.'
        :'A frequência de irrigação reduziu nos dias mais recentes.';
  }
  $('cafeTrendNote').textContent=trendNote;

  const incidents=reports.incidents||{},open=incidents.open||[],recent=incidents.recent||[];
  setBadge('cafeIncidentBadge',open.length?open.length+' ABERTO'+(open.length>1?'S':''):'SEM ABERTOS',open.some(x=>x.level==='critical')?'bad':open.length?'warn':'');
  $('cafeIncidentList').innerHTML=recent.length?recent.slice(0,12).map(item=>{
    const isOpen=item.status==='open';
    const durationMs=isOpen?Date.now()-num(item.opened_at):num(item.duration_ms);
    const resolution=item.resolution==='intervencao'?'com intervenção':item.resolution==='automatico'?'automática':'em andamento';
    return '<div class="incidentItem '+(item.level==='critical'?'critical':'warning')+'">'+
      '<i>'+(isOpen?'!':'✓')+'</i>'+
      '<span><b>'+esc(item.message||item.code||'Incidente')+'</b><small>'+esc((isOpen?'Aberto':'Resolvido')+' • '+resolution+' • '+fmtMinutes(durationMs/60000))+'</small></span>'+
      '<em>'+esc(fmtDateTime(item.opened_at))+'</em>'+
    '</div>';
  }).join(''):'<div class="auditOk"><i>✓</i><span><b>Nenhum incidente registrado</b><small>Problemas detectados pela auditoria aparecerão aqui.</small></span></div>';

  const sectors=(reports.sectors||[]).slice().sort((a,b)=>{
    const ah=a.hours_since_last==null?-1:num(a.hours_since_last);
    const bh=b.hours_since_last==null?-1:num(b.hours_since_last);
    return bh-ah;
  });
  $('sectorTrendList').innerHTML=sectors.length?sectors.map(item=>{
    const last=item.last_start_at?fmtDateTime(item.last_start_at):'Sem registro';
    const stale=item.hours_since_last!=null&&num(item.hours_since_last)>72;
    return '<div class="sectorTrendItem'+(stale?' warning':'')+'">'+
      '<div><b>Setor '+pad(item.sector)+'</b><small>Última: '+esc(last)+'</small></div>'+
      '<span><strong>'+num(item.starts_7d)+'</strong><small>7 dias</small></span>'+
      '<span><strong>'+num(item.starts_30d)+'</strong><small>30 dias</small></span>'+
      '<span><strong>'+esc(fmtMinutes(item.planned_minutes_30d))+'</strong><small>30 dias</small></span>'+
    '</div>';
  }).join(''):'<div class="panelNote">Sem dados por setor.</div>';

  if(document.activeElement!==$('apiUrl'))$('apiUrl').value=store.settings.apiUrl||DEFAULT_API;
  if(document.activeElement!==$('controlToken'))$('controlToken').value=store.settings.token||'';
  $('diagnosticText').textContent=JSON.stringify({
    app:'cafe',
    isolated:d.isolated,
    controller:c,
    runtime:d.runtime,
    active_session:d.active_session,
    weather:{linked:w.linked,online:w.device?.online,error:w.error||null,checked_at:w.checked_at},
    next_schedule:d.next_schedule,
    config_weather:d.config?.weather||{},
    history_count:app.history.length,
    audit:d.audit||null,
    sector_activity:d.sector_activity?.[c?.id]||null,
    reports:d.reports||null
  },null,2);
}
function renderAll(){renderHeader();renderHero();renderSummary();if(!(app.activeView==='sectors'&&$('sectorGrid')?.contains(document.activeElement)))renderSectors();renderWeather();renderSystem()}

async function loadDashboard(showToast=false){
  if(app.loading||!store.settings.token)return;
  app.loading=true;
  try{
    const id=store.selectedControllerId||'';
    const d=await api('/api/cafe/dashboard'+(id?'?device_id='+encodeURIComponent(id):''));
    app.dashboard=d;app.lastDashboardAt=Date.now();
    if(!store.selectedControllerId||!d.controllers?.some(c=>c.id===store.selectedControllerId)){
      store.selectedControllerId=d.controllers?.[0]?.id||null;saveStore();
      if(store.selectedControllerId&&store.selectedControllerId!==d.selected_controller?.id){
        app.loading=false;return loadDashboard(showToast);
      }
    }
    renderAll();
    if(showToast)toast('Café atualizado.');
  }catch(e){
    $('offlineBar').hidden=false;
    if(showToast)toast(e.message||'Falha ao atualizar');
  }finally{app.loading=false}
}
async function loadHistory(showToast=false){
  if(!store.settings.token)return;
  try{
    const r=await api('/api/irrigation/history?limit=300');
    app.history=r.history||[];renderRecent();renderSystem();
    if(showToast)toast('Histórico atualizado.');
  }catch(e){if(showToast)toast(e.message)}
}
async function refreshAll(showToast=false){
  await loadDashboard(showToast);
  await Promise.all([loadHistory(false),loadSchedule(true)]);
}
function schedulePolling(){
  clearTimeout(app.pollTimer);
  if(!store.settings.token)return;
  app.pollTimer=setTimeout(async()=>{
    if(document.visibilityState==='visible')await loadDashboard(false);
    schedulePolling();
  },12000);
}
function schedulePollingHistory(){
  clearTimeout(app.historyTimer);
  if(!store.settings.token)return;
  app.historyTimer=setTimeout(async()=>{
    if(document.visibilityState==='visible')await loadHistory(false);
    schedulePollingHistory();
  },60000);
}

$('controllerSelect').addEventListener('change',async e=>{
  store.selectedControllerId=e.target.value||null;saveStore();app.schedules={};
  await loadDashboard(false);await loadSchedule(true);
});
$('refreshBtn').addEventListener('click',()=>refreshAll(true));
$('stopAllBtn').addEventListener('click',stopAll);
$('groupBtn').addEventListener('click',openGroup);
$('startGroupBtn').addEventListener('click',startGroup);
$('saveWeatherBtn').addEventListener('click',saveWeather);
$('saveScheduleBtn').addEventListener('click',()=>saveSchedule(null));
$('disableScheduleBtn').addEventListener('click',()=>saveSchedule(false));
qsa('.closeBtn').forEach(b=>b.addEventListener('click',()=>b.closest('dialog')?.close()));

function saveConnection(tokenOverride){
  const token=String(tokenOverride??$('controlToken').value).trim();
  store.settings.apiUrl=String($('apiUrl')?.value||DEFAULT_API).trim()||DEFAULT_API;
  store.settings.token=token;saveStore();
  $('setupOverlay').hidden=Boolean(token);
  if(token){refreshAll(true);schedulePolling();schedulePollingHistory()}
}
$('saveConnectionBtn').addEventListener('click',()=>saveConnection());
$('setupSaveBtn').addEventListener('click',()=>{
  const token=$('setupToken').value.trim();if(!token)return toast('Informe o token.');
  $('controlToken').value=token;saveConnection(token);
});
window.addEventListener('online',()=>{if(store.settings.token){refreshAll(false);schedulePolling();schedulePollingHistory()}});
window.addEventListener('offline',()=>{$('offlineBar').hidden=false});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&store.settings.token)refreshAll(false)});

initDays('scheduleDays');
$('apiUrl').value=store.settings.apiUrl||DEFAULT_API;
$('controlToken').value=store.settings.token||'';
$('setupOverlay').hidden=Boolean(store.settings.token);
renderAll();
if(store.settings.token){
  refreshAll(false);
  schedulePolling();
  schedulePollingHistory();
}
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>null);
})();