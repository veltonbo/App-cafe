(()=>{
'use strict';
const KEY='viveiroEkazaRealV1';
const DEFAULT_API=location.origin;
const DAYS=[['D',1],['S',2],['T',4],['Q',8],['Q',16],['S',32],['S',64]];
const $=id=>document.getElementById(id);
const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
let store={};
try{store=JSON.parse(localStorage.getItem(KEY)||'null')||{}}catch{store={}}
if(!store.settings)store.settings={apiUrl:DEFAULT_API,token:''};
if(location.hostname.endsWith('.up.railway.app'))store.settings.apiUrl=DEFAULT_API;
if(!store.settings.apiUrl)store.settings.apiUrl=DEFAULT_API;

const app={
  dashboard:null,status:null,seconds:null,liveConnected:false,lastLiveAt:0,lastDashboardAt:0,lastStatusAt:0,
  activeView:'summary',autoMode:'automatic',automationDirty:false,loading:false,sseAbort:null,dashboardPollTimer:null,statusPollTimer:null,sessionReady:false,authChecked:false
};

function saveStore(){try{localStorage.setItem(KEY,JSON.stringify(store))}catch{}}
function toast(msg){
  const el=$('toast');el.textContent=String(msg||'');el.classList.add('show');
  clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2600);
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function num(v,d=0){const n=Number(v);return Number.isFinite(n)?n:d}
function apiBase(){return String(store.settings.apiUrl||DEFAULT_API).replace(/\/$/,'')}
function sameOriginApi(){
  try{return new URL(apiBase(),location.href).origin===location.origin}catch{return false}
}
function hasAuth(){return Boolean(app.sessionReady||store.settings.token)}
function authHeaders(extra={}){
  return{
    'Content-Type':'application/json',
    ...(store.settings.token?{'Authorization':'Bearer '+store.settings.token}:{}),
    ...extra
  };
}
async function ensureSecureSession(){
  if(!sameOriginApi()){
    app.sessionReady=false;
    app.authChecked=true;
    return Boolean(store.settings.token);
  }
  try{
    if(store.settings.token){
      const r=await fetch(apiBase()+'/api/session',{
        method:'POST',
        credentials:'same-origin',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+store.settings.token}
      });
      if(r.ok){
        app.sessionReady=true;
        app.authChecked=true;
        store.settings.token='';
        saveStore();
        return true;
      }
      app.sessionReady=false;
      app.authChecked=true;
      return false;
    }
    const r=await fetch(apiBase()+'/api/session',{credentials:'same-origin'});
    app.sessionReady=r.ok;
    app.authChecked=true;
    return r.ok;
  }catch{
    app.sessionReady=false;
    app.authChecked=true;
    return Boolean(store.settings.token);
  }
}
async function api(path,opt={}){
  if(!hasAuth())throw new Error('Sessão de controle não configurada.');
  const ctl=new AbortController();
  const t=setTimeout(()=>ctl.abort(),12000);
  try{
    const r=await fetch(apiBase()+path,{
      ...opt,signal:ctl.signal,credentials:'same-origin',
      headers:authHeaders(opt.headers||{})
    });
    const body=await r.json().catch(()=>({}));
    if(r.status===401&&app.sessionReady&&!store.settings.token){
      app.sessionReady=false;
      $('setupOverlay').hidden=false;
    }
    if(!r.ok)throw new Error(body?.error||body?.detail||('HTTP '+r.status));
    return body;
  }finally{clearTimeout(t)}
}
function fmtSeconds(s){
  s=Math.max(0,Math.round(num(s)));
  if(s<60)return s+' s';
  const m=Math.floor(s/60),r=s%60;
  return r?m+' min '+r+' s':m+' min';
}
function fmtAge(ts){
  const ms=Date.now()-num(ts);
  if(!ts||ms<0)return'—';
  if(ms<1000)return'agora';
  if(ms<60000)return Math.round(ms/1000)+' s';
  return Math.round(ms/60000)+' min';
}
function fmtClock(ts){
  if(!ts)return'—';
  return new Date(num(ts)).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
}
function timeValue(mins){
  const m=Math.max(0,Math.min(1440,Math.round(num(mins))));
  return String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
}
function minutesValue(v){
  const [h,m]=String(v||'').split(':').map(Number);
  return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null;
}
function localDateTime(ts){
  if(!ts)return'—';
  return new Date(num(ts)).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
}
function setDot(id,state){
  const el=$(id);if(!el)return;el.className=state===true?'ok':state===false?'bad':'warn';
}
function setBadge(el,text,tone=''){
  if(!el)return;el.textContent=text;el.className='badge'+(tone?' '+tone:'');
}
function weather(){
  return app.dashboard?.current_weather||{};
}
function seconds(){
  return app.seconds||app.dashboard?.seconds||{};
}
function climateState(){return app.dashboard?.climate?.state||{}}
function climateConfig(){return app.dashboard?.climate?.config||{}}
function weatherConfig(){return app.dashboard?.weather?.config||{}}

function renderOperation(){
  const d=app.dashboard||{},op=d.intelligence?.operation||{},s=seconds();
  $('operationLabel').textContent=op.label||'AGUARDANDO';
  $('operationDetail').textContent=op.detail||'Aguardando estado do sistema.';
  const code=op.code||'neutral';
  $('operationCard').className='operationCard tone-'+code;
  $('operationIcon').textContent=code==='irrigating'?'●':code==='interval'?'◷':code==='rain'?'☂':code==='emergency'?'!':'◷';

  let nextAt=num(op.next_event_at);
  let label=op.next_event_label||'Próximo evento';
  if(!nextAt&&String(s.phase)==='on')nextAt=num(s.expected_off_at);
  if(!nextAt&&String(s.phase)==='off')nextAt=num(s.expected_next_on_at);
  $('nextEventLabel').textContent=label||'Próximo evento';
  $('nextEventValue').dataset.at=String(nextAt||0);
  $('nextEventValue').textContent=nextAt?fmtClock(nextAt):'—';

  const deviceAt=num(s.last_confirmation_at||s.state_updated_at||app.lastStatusAt);
  const weatherAt=num(weather().checked_at||d.weather?.state?.lastWeatherAt);
  $('deviceAge').textContent=fmtAge(deviceAt);
  $('weatherAge').textContent=fmtAge(weatherAt);
  $('liveAge').textContent=app.liveConnected?fmtAge(app.lastLiveAt):'reconectando';
  setDot('deviceDot',app.status?.online===true?true:app.status?.online===false?false:null);
  setDot('weatherDot',weather()?.linked&&weather()?.error==null?true:weather()?.error?false:null);
  setDot('liveDot',app.liveConnected?true:false);

  const active=Boolean(s.enabled);
  $('emergencyBtn').hidden=!active&&!d.safety?.emergency_latched;
}

function renderMetrics(){
  const d=app.dashboard||{},w=weather(),m=w.metrics||{},cs=climateState();
  const t=m.temperature?.value;
  const h=m.humidity?.value;
  const v=cs.last_vpd??cs.vpd;
  const r=m.rainGeneric?.value??m.rain24h?.value;
  $('temperature').textContent=Number.isFinite(Number(t))?Number(t).toFixed(1)+' °C':'—';
  $('humidity').textContent=Number.isFinite(Number(h))?Math.round(Number(h))+'%':'—';
  $('vpd').textContent=Number.isFinite(Number(v))?Number(v).toFixed(2)+' kPa':'—';
  $('rain').textContent=Number.isFinite(Number(r))?Number(r).toFixed(1)+' mm':(m.rainDetected?'Detectada':'0.0 mm');
  $('rainHint').textContent=m.rainDetected?'Chuva detectada':'Sem chuva detectada';

  const level=String(cs.drying_level_label||cs.drying_level||cs.last_level||cs.level||'').replaceAll('_',' ');
  setBadge($('climateBadge'),level?level.toUpperCase():'AGUARDANDO',m.rainDetected?'warn':'');

  const s=seconds(),baseOn=num(s.base_on_seconds||s.on_seconds),baseOff=num(s.base_off_seconds||s.off_seconds);
  const curOn=num(s.on_seconds),curOff=num(s.off_seconds);
  $('baseCycle').textContent=baseOn&&baseOff?baseOn+' s / '+baseOff+' s':'—';
  $('currentCycle').textContent=curOn&&curOff?curOn+' s / '+curOff+' s':'—';
  const intel=d.intelligence||{};
  $('autoTitle').textContent=intel.cycle_reason?.title||'Automático 2.0';
  $('autoReason').textContent=intel.cycle_reason?.detail||cs.last_reason||'Aguardando avaliação climática.';
  $('intensity').textContent=(intel.intensity?.label||'—')+(Number.isFinite(Number(intel.intensity?.change_percent))?' • '+(num(intel.intensity.change_percent)>0?'+':'')+num(intel.intensity.change_percent).toFixed(0)+'%':'');
  const cfg=climateConfig();
  const mode=cfg.automatic?'AUTOMÁTICO':cfg.observation?'OBSERVAÇÃO':cfg.enabled===false?'DESLIGADO':'ATIVO';
  setBadge($('autoBadge'),mode,cfg.enabled===false?'warn':'');
}

function renderToday(){
  const t=app.dashboard?.summary?.today||{};
  $('todayPulses').textContent=String(num(t.pulses));
  $('todayCompleted').textContent=num(t.completed_pulses)+' concluídos';
  $('todayIrrigated').textContent=fmtSeconds(t.irrigated_seconds);
  $('todayLast').textContent=t.last_pulse_at?fmtClock(t.last_pulse_at):'—';
  $('todayLastSub').textContent=t.last_pulse_at?localDateTime(t.last_pulse_at):'Sem pulso';
  $('todayRainPauses').textContent=String(num(t.rain_pauses));
  $('todayErrors').textContent=num(t.errors)+' falhas';
}
function renderHealth(){
  const h=app.dashboard?.intelligence?.health||{};
  $('healthTitle').textContent=h.message||'Aguardando diagnóstico';
  $('healthDetail').textContent=h.level==='ok'?'Todos os serviços essenciais respondendo.':(h.issues?.[0]?.message||'Toque para abrir o Sistema.');
  $('healthIcon').textContent=h.level==='critical'?'!':h.level==='warning'?'•':'✓';
  const connected=Boolean(hasAuth()&&app.dashboard);
  $('headerStateText').textContent=!hasAuth()?'Configurar':!connected?'Reconectando':h.level==='critical'?'Atenção':'Online';
  setDot('headerDot',!hasAuth()?null:h.level==='critical'?false:connected?true:null);
}
function renderAutomation(){
  if(app.automationDirty)return;
  const s=seconds(),cc=climateConfig(),wc=weatherConfig();
  $('onSeconds').value=Math.round(num(s.base_on_seconds||s.on_seconds,30));
  $('offSeconds').value=Math.round(num(s.base_off_seconds||s.off_seconds,120));
  $('startTime').value=timeValue(s.start_minutes??360);
  $('endTime').value=timeValue(s.end_minutes??1080);
  const mask=num(s.days_mask,127);
  qsa('#dayPicker button').forEach(b=>b.classList.toggle('active',Boolean(mask&num(b.dataset.bit))));
  setBadge($('scheduleState'),s.enabled?'ARMADO':'DESARMADO',s.enabled?'':'warn');
  $('saveScheduleBtn').textContent=s.enabled?'Salvar e rearmar':'Salvar e armar';
  $('disableScheduleBtn').disabled=!s.enabled;

  app.autoMode=cc.automatic?'automatic':cc.observation?'observation':'off';
  qsa('#autoMode button').forEach(b=>b.classList.toggle('active',b.dataset.mode===app.autoMode));
  $('evaluationMinutes').value=Math.round(num(cc.evaluation_minutes,5));
  $('maxAdjustPercent').value=Math.round(num(cc.max_adjust_percent,35));
  setBadge($('autoConfigState'),app.autoMode==='automatic'?'AUTOMÁTICO':app.autoMode==='observation'?'OBSERVANDO':'DESLIGADO',app.autoMode==='off'?'warn':'');

  $('rainEnabled').checked=wc.enabled!==false;
  $('resumeDelay').value=Math.round(num(wc.resumeDelayMinutes,30));
  $('weatherCheck').value='≈ 4';
  setBadge($('rainProtectionState'),wc.enabled===false?'DESLIGADA':'ATIVA',wc.enabled===false?'warn':'');
}
function renderHistory(){
  const sum=app.dashboard?.summary||{},tot=sum.week_totals||{};
  const reports=app.dashboard?.reports||{},today=reports.today||{},incidents=reports.incidents||{};
  $('weekPulses').textContent=String(num(tot.pulses));
  $('weekIrrigated').textContent=fmtSeconds(tot.irrigated_seconds);
  $('weekRain').textContent=String(num(tot.rain_pauses));
  $('weekErrors').textContent=String(num(tot.errors));

  const status=String(reports.status_today||'normal');
  $('dayStatusTitle').textContent=status==='critical'?'CRÍTICO':status==='warning'?'ATENÇÃO':'NORMAL';
  $('dayStatusDetail').textContent=status==='critical'
    ?'Existe uma falha ou incidente crítico registrado hoje.'
    :status==='warning'
      ?'O sistema registrou uma ocorrência que merece acompanhamento.'
      :'Irrigação, clima e auditoria sem ocorrência crítica hoje.';
  $('dayStatusCard').className='dayStatusCard '+status;
  setBadge($('dayStatusBadge'),status==='critical'?'CRÍTICO':status==='warning'?'ATENÇÃO':'NORMAL',status==='critical'?'bad':status==='warning'?'warn':'');

  $('reportAutoAdjust').textContent=String(num(today.auto_adjustments));
  $('reportInterruptions').textContent=String(num(today.interrupted));
  const climate=today.climate||{};
  $('reportTemperature').textContent=Number.isFinite(Number(climate.temperature_min))&&Number.isFinite(Number(climate.temperature_max))
    ?Number(climate.temperature_min).toFixed(1)+'–'+Number(climate.temperature_max).toFixed(1)+' °C'
    :'—';
  $('reportIncidents').textContent=String(num(incidents.totals?.open));

  const days=sum.week||[],max=Math.max(1,...days.map(x=>num(x.irrigated_seconds)));
  $('weekChart').innerHTML=days.map(day=>{
    const pct=Math.max(3,Math.round(num(day.irrigated_seconds)/max*100));
    return '<div class="dayBar"><div class="barArea" title="'+esc(fmtSeconds(day.irrigated_seconds))+'"><i style="height:'+pct+'%"></i></div><small>'+esc(day.label||'')+'</small></div>';
  }).join('')||'<div class="panelNote">Sem dados dos últimos dias.</div>';

  const trend=reports.trend30||[],trendMax=Math.max(1,...trend.map(x=>num(x.irrigated_seconds)));
  $('trend30Chart').innerHTML=trend.map(day=>{
    const pct=Math.max(day.irrigated_seconds?4:1,Math.round(num(day.irrigated_seconds)/trendMax*100));
    const tone=day.status==='critical'?' critical':day.status==='warning'?' warning':'';
    return '<div class="trendDay'+tone+'" title="'+esc(day.label+' • '+fmtSeconds(day.irrigated_seconds))+'"><i style="height:'+pct+'%"></i><small>'+esc(String(day.key||'').slice(-2))+'</small></div>';
  }).join('')||'<div class="panelNote">Sem histórico suficiente.</div>';
  const first=trend.find(x=>num(x.irrigated_seconds)>0),last=[...trend].reverse().find(x=>num(x.irrigated_seconds)>0);
  let trendText='Sem histórico suficiente para tendência.';
  if(first&&last&&first!==last){
    const delta=num(last.irrigated_seconds)-num(first.irrigated_seconds);
    const pct=num(first.irrigated_seconds)>0?delta/num(first.irrigated_seconds)*100:0;
    trendText=Math.abs(pct)<8
      ?'Tempo irrigado permaneceu estável no período.'
      :pct>0
        ?'Tempo irrigado aumentou cerca de '+Math.abs(pct).toFixed(0)+'% entre os primeiros e últimos dias com dados.'
        :'Tempo irrigado reduziu cerca de '+Math.abs(pct).toFixed(0)+'% entre os primeiros e últimos dias com dados.';
  }
  $('trend30Note').textContent=trendText;
  setBadge($('trend30Badge'),trend.length+' DIAS','');

  const open=incidents.open||[],recent=incidents.recent||[];
  setBadge($('incidentOpenBadge'),open.length?open.length+' ABERTO'+(open.length>1?'S':''):'SEM ABERTOS',open.some(x=>x.level==='critical')?'bad':open.length?'warn':'');
  $('incidentList').innerHTML=recent.length?recent.slice(0,12).map(item=>{
    const isOpen=item.status==='open';
    const durationMs=isOpen?Date.now()-num(item.opened_at):num(item.duration_ms);
    const resolution=item.resolution==='intervencao'?'com intervenção':item.resolution==='automatico'?'automática':'em andamento';
    return '<div class="incidentItem '+(item.level==='critical'?'critical':'warning')+'">'+
      '<i>'+(isOpen?'!':'✓')+'</i>'+
      '<span><b>'+esc(item.message||item.code||'Incidente')+'</b>'+
      '<small>'+esc((isOpen?'Aberto':'Resolvido')+' • '+resolution+' • duração '+fmtSeconds(durationMs/1000))+'</small></span>'+
      '<em>'+esc(localDateTime(item.opened_at))+'</em>'+
    '</div>';
  }).join(''):'<div class="auditOk"><i>✓</i><span><b>Nenhum incidente registrado</b><small>Problemas detectados pela auditoria aparecerão aqui.</small></span></div>';

  const decisions=app.dashboard?.intelligence?.decisions||[];
  $('decisionList').innerHTML=decisions.slice(0,12).map(x=>eventHtml(x,true)).join('')||'<div class="panelNote">Nenhuma decisão recente.</div>';
  const history=app.dashboard?.history||[];
  $('historyList').innerHTML=history.slice(0,20).map(x=>eventHtml(x,false)).join('')||'<div class="panelNote">Nenhum evento recente.</div>';
}
function eventHtml(x,decision){
  const type=String(x.type||''),when=num(x.ts||Date.parse(x.at||0));
  let icon='•',title=x.title||x.detail||'Evento';
  if(type.includes('pulse_complete')){icon='✓';title='Pulso concluído'}
  else if(type.includes('pulse_start')){icon='▶';title='Pulso iniciado'}
  else if(type.includes('interrupted')){icon='■';title='Pulso interrompido'}
  else if(type.includes('weather'))icon='☂';
  else if(type.includes('climate'))icon='A';
  else if(type.includes('error')||type.includes('emergency'))icon='!';
  const detail=decision?(x.detail||''):(x.detail||x.reason||((x.actual_duration_seconds!=null)?fmtSeconds(x.actual_duration_seconds):''));
  return '<div class="eventItem"><div class="eventIcon">'+esc(icon)+'</div><div><b>'+esc(title)+'</b><small>'+esc(detail)+'</small></div><span class="eventTime">'+esc(when?localDateTime(when):'—')+'</span></div>';
}
function renderSystem(){
  const d=app.dashboard||{},s=seconds(),w=weather(),health=d.intelligence?.health||{};
  const deviceOk=app.status?.online===true;
  const weatherOk=Boolean(w.linked&&!w.error&&w.device?.online!==false);
  const serverOk=Boolean(d.server?.online);
  setDot('svcEkaza',deviceOk?true:app.status?.online===false?false:null);
  setDot('svcWeather',weatherOk);
  setDot('svcRealtime',app.liveConnected);
  setDot('svcServer',serverOk);
  $('svcEkazaText').textContent=deviceOk?'Online':app.status?.online===false?'Offline':'Aguardando';
  $('svcWeatherText').textContent=weatherOk?'Online':'Sem confirmação';
  $('svcRealtimeText').textContent=app.liveConnected?'Conectado':'Reconectando';
  $('svcServerText').textContent=serverOk?'Online':'Aguardando';

  const emergency=Boolean(d.safety?.emergency_latched||d.safety?.latched);
  $('emergencyState').textContent=emergency?'ATIVA':'Livre';
  $('clearEmergencyBtn').hidden=!emergency;
  $('watchdogState').textContent=s.watchdog?.status||s.watchdog_status||'—';
  $('confirmationState').textContent=s.last_confirmation_at?fmtAge(s.last_confirmation_at)+' atrás':'—';
  const latencyAvg=Number(s.confirmation_latency?.avg_ms);
  const latencyLast=Number(s.last_confirmation_latency_ms);
  $('confirmationLatencyState').textContent=Number.isFinite(latencyAvg)&&num(s.confirmation_latency?.samples)>0
    ?Math.round(latencyAvg)+' ms méd.'
    :Number.isFinite(latencyLast)&&latencyLast>=0?Math.round(latencyLast)+' ms':'—';
  const schedulerAvg=s.scheduler_precision?.avg_abs_error_ms;
  $('precisionState').textContent=Number.isFinite(Number(schedulerAvg))
    ?Math.round(Number(schedulerAvg))+' ms'
    :'Coletando';

  const audit=s.operational_audit||health.audit||{};
  const auditIssues=Array.isArray(audit.issues)?audit.issues:[];
  const auditLevel=String(audit.status||health.level||'ok');
  setBadge($('auditBadge'),
    auditLevel==='critical'?'CRÍTICO':auditLevel==='warning'?'ATENÇÃO':'NORMAL',
    auditLevel==='critical'?'bad':auditLevel==='warning'?'warn':''
  );
  $('auditSummary').textContent=audit.message||(
    auditIssues.length
      ?auditIssues[0]?.message||'A auditoria encontrou uma anomalia.'
      :'Nenhuma anomalia encontrada.'
  );
  $('auditCheckedAt').textContent=audit.checked_at?localDateTime(audit.checked_at):'—';
  $('auditList').innerHTML=auditIssues.length
    ?auditIssues.slice(0,8).map(issue=>
        '<div class="auditItem '+(issue.level==='critical'?'critical':'warning')+'">'+
          '<i>'+(issue.level==='critical'?'!':'•')+'</i>'+
          '<span><b>'+esc(issue.level==='critical'?'Crítico':'Atenção')+'</b><small>'+esc(issue.message||issue.code||'Anomalia')+'</small></span>'+
        '</div>'
      ).join('')
    :'<div class="auditOk"><i>✓</i><span><b>Sistema coerente</b><small>Horário, clima, ciclo, confirmações e histórico sem divergência detectada.</small></span></div>';

  const maint=d.maintenance||{};
  setBadge($('maintenanceBadge'),maint.active?'ATIVA':'INATIVA',maint.active?'warn':'');
  if(document.activeElement!==$('apiUrl'))$('apiUrl').value=store.settings.apiUrl||DEFAULT_API;
  if(document.activeElement!==$('controlToken'))$('controlToken').value=store.settings.token||'';

  $('diagnosticText').textContent=JSON.stringify({
    operacao:d.intelligence?.operation||null,
    health,
    seconds:{phase:s.phase,enabled:s.enabled,on:s.on_seconds,off:s.off_seconds,server_read_at:s.server_read_at,watchdog:s.watchdog||null,observed_precision:s.precision||null,scheduler_precision:s.scheduler_precision||null,confirmation_latency:s.confirmation_latency||null},
    weather:{linked:w.linked,checked_at:w.checked_at,error:w.error||null},
    live:{connected:app.liveConnected,last_event_at:app.lastLiveAt},
    audit,
    reports:d.reports||null
  },null,2);
}
function renderAll(){
  renderOperation();renderMetrics();renderToday();renderHealth();renderAutomation();renderHistory();renderSystem();
  $('offlineBar').hidden=navigator.onLine&&Boolean(app.dashboard);
}

function initDays(){
  $('dayPicker').innerHTML=DAYS.map(([label,bit])=>'<button type="button" data-bit="'+bit+'">'+label+'</button>').join('');
  qsa('#dayPicker button').forEach(b=>b.addEventListener('click',()=>{b.classList.toggle('active');app.automationDirty=true}));
}
function showView(name){
  app.activeView=name;
  qsa('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+name));
  qsa('.bottomNav button').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  scrollTo({top:0,behavior:'smooth'});
}
qsa('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));

async function loadDashboard(showToast=false){
  if(app.loading||!hasAuth())return;
  app.loading=true;
  try{
    const d=await api('/api/viveiro/dashboard');
    app.dashboard=d;app.seconds=d.seconds||app.seconds;app.lastDashboardAt=Date.now();
    renderAll();
    if(showToast)toast('Dados atualizados');
  }catch(e){
    $('offlineBar').hidden=false;
    if(showToast)toast(e.message||'Falha ao atualizar');
  }finally{app.loading=false}
}
async function loadStatus(){
  if(!hasAuth())return;
  try{app.status=await api('/api/status');app.lastStatusAt=Date.now();renderOperation();renderHealth();renderSystem()}catch(e){app.status={online:false,error:String(e.message||e)};renderAll()}
}

async function connectLive(){
  if(!hasAuth())return;
  if(app.sseAbort)app.sseAbort.abort();
  const ctl=new AbortController();app.sseAbort=ctl;
  let wait=1000;
  while(!ctl.signal.aborted){
    try{
      const r=await fetch(apiBase()+'/api/viveiro/live',{headers:store.settings.token?{'Authorization':'Bearer '+store.settings.token}:{},credentials:'same-origin',signal:ctl.signal});
      if(!r.ok||!r.body)throw new Error('Tempo real HTTP '+r.status);
      app.liveConnected=true;app.lastLiveAt=Date.now();renderAll();wait=1000;scheduleDashboardPoll();scheduleStatusPoll();
      const reader=r.body.getReader(),dec=new TextDecoder();let buf='';
      while(true){
        const {done,value}=await reader.read();if(done)break;
        buf+=dec.decode(value,{stream:true});
        let cut;
        while((cut=buf.indexOf('\n\n'))>=0){
          const block=buf.slice(0,cut);buf=buf.slice(cut+2);
          const line=block.split('\n').find(x=>x.startsWith('data: '));
          if(!line)continue;
          let event=null;try{event=JSON.parse(line.slice(6))}catch{}
          if(!event)continue;
          app.lastLiveAt=Date.now();
          if(event.type==='seconds'&&event.payload?.state){
            app.seconds=event.payload.state;
            if(app.dashboard)app.dashboard.seconds=event.payload.state;
            renderOperation();renderMetrics();renderAutomation();renderSystem();
          }else if(event.type==='weather'&&event.payload?.weather){
            if(app.dashboard)app.dashboard.current_weather=event.payload.weather;
            renderMetrics();renderOperation();renderSystem();
          }else if(event.type==='protection'){
            if(app.dashboard){
              if(event.payload?.state)app.dashboard.weather={...(app.dashboard.weather||{}),state:event.payload.state};
              if(event.payload?.config)app.dashboard.weather={...(app.dashboard.weather||{}),config:event.payload.config};
            }
            renderOperation();renderHealth();renderSystem();
          }else if(event.type==='confirmation'){
            const p=event.payload||{};
            app.seconds={...seconds(),
              last_confirmation_at:num(p.confirmed_at)||seconds().last_confirmation_at,
              last_confirmation_latency_ms:num(p.latency_ms),
              last_confirmation_source:p.source||seconds().last_confirmation_source,
              device_relay:p.command==='on'?true:p.command==='off'?false:seconds().device_relay
            };
            if(app.dashboard)app.dashboard.seconds=app.seconds;
            renderOperation();renderSystem();
          }else if(event.type==='watchdog'){
            app.seconds={...seconds(),watchdog:{status:event.payload?.status||'warning',checked_at:event.payload?.at||Date.now(),reason:event.payload?.reason||'',error:event.payload?.error||null}};
            if(app.dashboard)app.dashboard.seconds=app.seconds;
            renderHealth();renderSystem();
          }else if(event.type==='server'){
            if(app.dashboard)app.dashboard.server={online:true,at:event.at||Date.now()};
            renderHealth();renderSystem();
          }else if(event.type==='event'){
            clearTimeout(connectLive.refresh);
            connectLive.refresh=setTimeout(()=>loadDashboard(false),900);
          }
        }
      }
      throw new Error('Stream encerrado');
    }catch(e){
      if(ctl.signal.aborted)break;
      app.liveConnected=false;renderOperation();renderHealth();renderSystem();scheduleDashboardPoll();scheduleStatusPoll();
      await new Promise(r=>setTimeout(r,wait));wait=Math.min(10000,wait*1.7);
    }
  }
}

function scheduleDashboardPoll(){
  clearTimeout(app.dashboardPollTimer);
  if(!hasAuth())return;
  const delay=app.liveConnected?60000:8000;
  app.dashboardPollTimer=setTimeout(async()=>{
    if(document.visibilityState==='visible')await loadDashboard(false);
    scheduleDashboardPoll();
  },delay);
}
function scheduleStatusPoll(){
  clearTimeout(app.statusPollTimer);
  if(!hasAuth())return;
  const delay=app.liveConnected?60000:15000;
  app.statusPollTimer=setTimeout(async()=>{
    if(document.visibilityState==='visible')await loadStatus();
    scheduleStatusPoll();
  },delay);
}

function startClock(){
  setInterval(()=>{
    const el=$('nextEventValue'),at=num(el.dataset.at);
    if(at){
      const remain=Math.max(0,(at-Date.now())/1000);
      el.textContent=remain<=180?fmtSeconds(remain):fmtClock(at);
    }
    $('deviceAge').textContent=fmtAge(num(seconds().last_confirmation_at||seconds().state_updated_at||app.lastStatusAt));
    $('weatherAge').textContent=fmtAge(num(weather().checked_at||app.dashboard?.weather?.state?.lastWeatherAt));
    $('liveAge').textContent=app.liveConnected?fmtAge(app.lastLiveAt):'reconectando';
  },500);
}

async function saveSchedule(){
  const on=Math.max(1,Math.min(300,Math.round(num($('onSeconds').value,30))));
  const off=Math.max(1,Math.min(900,Math.round(num($('offSeconds').value,120))));
  const start=minutesValue($('startTime').value),end=minutesValue($('endTime').value);
  const mask=qsa('#dayPicker button.active').reduce((m,b)=>m|num(b.dataset.bit),0);
  if(start==null||end==null||end<=start)return toast('Confira o horário inicial e final.');
  if(!mask)return toast('Selecione pelo menos um dia.');
  const currentlyActive=Boolean(seconds().enabled);
  if(currentlyActive&&!confirm('A programação está armada. Para aplicar os novos valores, o sistema irá desarmar e rearmar o ciclo. Continuar?'))return;
  $('saveScheduleBtn').disabled=true;
  try{
    if(currentlyActive)await api('/api/viveiro/seconds',{method:'POST',body:JSON.stringify({action:'disable'})});
    const cfg=await api('/api/irrigation/config').catch(()=>({config:{}}));
    const profiles={...(cfg.config?.profiles||{}),viveiroFast:{on_seconds:on,off_seconds:off,start_minutes:start,end_minutes:end,days_mask:mask,updated_at:new Date().toISOString(),origin:'Viveiro Clean UI'}};
    await api('/api/irrigation/config',{method:'PATCH',body:JSON.stringify({profiles})});
    await api('/api/viveiro/seconds',{method:'POST',body:JSON.stringify({action:'configure',on_seconds:on,off_seconds:off,start_minutes:start,end_minutes:end,days_mask:mask,resume_delay_minutes:num($('resumeDelay').value,30)})});
    toast('Programação salva e armada.');app.automationDirty=false;
    await loadDashboard();
  }catch(e){toast(e.message||'Falha ao salvar programação')}finally{$('saveScheduleBtn').disabled=false}
}
async function disableSchedule(){
  if(!seconds().enabled)return;
  if(!confirm('Desarmar a irrigação automática do Viveiro?'))return;
  try{await api('/api/viveiro/seconds',{method:'POST',body:JSON.stringify({action:'disable'})});toast('Programação desarmada.');await loadDashboard()}catch(e){toast(e.message)}
}
async function saveAutomatic(){
  const mode=app.autoMode;
  const cc=climateConfig();
  try{
    await api('/api/viveiro/dashboard',{method:'POST',body:JSON.stringify({
      action:'climate_config',
      automatic:mode==='automatic',
      observation:mode==='observation',
      enabled:mode!=='off',
      trend_minutes:num(cc.trend_minutes,20),
      evaluation_minutes:num($('evaluationMinutes').value,5),
      max_adjust_percent:num($('maxAdjustPercent').value,35),
      min_change_seconds:num(cc.min_change_seconds,1),
      min_change_off_seconds:num(cc.min_change_off_seconds,10),
      cooldown_minutes:num(cc.cooldown_minutes,15),
      normal_confirmations:num(cc.normal_confirmations,2),
      post_rain_hold_minutes:num(cc.post_rain_hold_minutes,30)
    })});
    toast('Automático 2.0 atualizado.');app.automationDirty=false;await loadDashboard();
  }catch(e){toast(e.message)}
}
async function saveRain(){
  const wc=weatherConfig();
  try{
    await api('/api/viveiro/weather',{method:'POST',body:JSON.stringify({action:'save_config',config:{
      enabled:$('rainEnabled').checked,
      resumeDelayMinutes:num($('resumeDelay').value,30),
      checkMinutes:num(wc.checkMinutes,5),
      blockWhileRaining:wc.blockWhileRaining!==false,
      rainThresholdMm:num(wc.rainThresholdMm,5)
    }})});
    toast('Proteção por chuva atualizada.');app.automationDirty=false;await loadDashboard();
  }catch(e){toast(e.message)}
}
async function emergencyStop(){
  if(!confirm('PARAR A IRRIGAÇÃO AGORA?\n\nA saída será desligada e a parada de emergência ficará travada até liberação manual.'))return;
  try{await api('/api/viveiro/seconds',{method:'POST',body:JSON.stringify({action:'emergency_stop',reason:'Parada de emergência pelo aplicativo'})});toast('Parada de emergência acionada.');await Promise.all([loadDashboard(),loadStatus()])}catch(e){toast(e.message)}
}
async function clearEmergency(){
  if(!confirm('Liberar a parada de emergência? A irrigação continuará parada até ser rearmada.'))return;
  try{await api('/api/viveiro/seconds',{method:'POST',body:JSON.stringify({action:'clear_emergency'})});toast('Emergência liberada.');await loadDashboard()}catch(e){toast(e.message)}
}
async function setMaintenance(minutes){
  try{await api('/api/viveiro/dashboard',{method:'POST',body:JSON.stringify({action:'maintenance',minutes,reason:minutes?'Manutenção pelo aplicativo':'Fim da manutenção'})});toast(minutes?'Manutenção ativada.':'Manutenção encerrada.');await loadDashboard()}catch(e){toast(e.message)}
}

$('saveScheduleBtn').addEventListener('click',saveSchedule);
$('disableScheduleBtn').addEventListener('click',disableSchedule);
qsa('#autoMode button').forEach(b=>b.addEventListener('click',()=>{app.autoMode=b.dataset.mode;app.automationDirty=true;qsa('#autoMode button').forEach(x=>x.classList.toggle('active',x===b))}));
$('saveAutoBtn').addEventListener('click',saveAutomatic);
$('saveRainBtn').addEventListener('click',saveRain);
qsa('#view-automation input').forEach(el=>{el.addEventListener('input',()=>{app.automationDirty=true});el.addEventListener('change',()=>{app.automationDirty=true})});
$('emergencyBtn').addEventListener('click',emergencyStop);
$('clearEmergencyBtn').addEventListener('click',clearEmergency);
qsa('.maintenanceBtn').forEach(b=>b.addEventListener('click',()=>setMaintenance(num(b.dataset.minutes))));
$('refreshBtn').addEventListener('click',()=>Promise.all([loadDashboard(true),loadStatus()]));

async function saveConnection(tokenOverride){
  const token=String(tokenOverride??$('controlToken').value).trim();
  store.settings.apiUrl=String($('apiUrl')?.value||DEFAULT_API).trim()||DEFAULT_API;
  app.sessionReady=false;
  if(token)store.settings.token=token;
  saveStore();
  const ok=await ensureSecureSession();
  $('setupOverlay').hidden=ok;
  $('controlToken').value='';
  $('setupToken').value='';
  if(ok){
    if(app.sseAbort)app.sseAbort.abort();
    Promise.all([loadDashboard(true),loadStatus()]);
    connectLive();scheduleDashboardPoll();scheduleStatusPoll();
    toast(sameOriginApi()?'Sessão segura ativada.':'Conexão salva.');
  }else toast('Não foi possível validar o token.');
}
$('saveConnectionBtn').addEventListener('click',()=>saveConnection());
$('setupSaveBtn').addEventListener('click',()=>{const t=$('setupToken').value.trim();if(!t)return toast('Informe o token.');saveConnection(t)});

window.addEventListener('online',()=>{$('offlineBar').hidden=true;if(hasAuth()){loadDashboard();loadStatus();scheduleDashboardPoll();scheduleStatusPoll()}});
window.addEventListener('offline',()=>{$('offlineBar').hidden=false});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&hasAuth()){loadDashboard();loadStatus();scheduleDashboardPoll();scheduleStatusPoll()}});

async function bootstrap(){
  initDays();
  $('apiUrl').value=store.settings.apiUrl||DEFAULT_API;
  $('controlToken').value=store.settings.token||'';
  $('setupOverlay').hidden=true;
  renderAll();startClock();
  const ok=await ensureSecureSession();
  $('setupOverlay').hidden=ok;
  $('controlToken').value=store.settings.token||'';
  if(ok){
    Promise.all([loadDashboard(),loadStatus()]);
    connectLive();
    scheduleDashboardPoll();
    scheduleStatusPoll();
  }
}
bootstrap();
if('serviceWorker' in navigator)navigator.serviceWorker.register('/irrigacao/sw.js',{scope:'/irrigacao/'}).catch(()=>null);
})();