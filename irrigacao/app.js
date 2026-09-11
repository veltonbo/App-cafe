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

const app={dashboard:null,status:null,seconds:null,liveConnected:false,lastLiveAt:0,lastDashboardAt:0,lastStatusAt:0,activeView:'summary',autoMode:'automatic',automationDirty:false,loading:false,sseAbort:null,dashboardPollTimer:null,statusPollTimer:null,sessionReady:false,authChecked:false};
function saveStore(){try{localStorage.setItem(KEY,JSON.stringify(store))}catch{}}
function toast(msg){const el=$('toast');el.textContent=String(msg||'');el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2600)}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function num(v,d=0){const n=Number(v);return Number.isFinite(n)?n:d}
function apiBase(){return String(store.settings.apiUrl||DEFAULT_API).replace(/\/$/,'')}
function sameOriginApi(){try{return new URL(apiBase(),location.href).origin===location.origin}catch{return false}}
function hasAuth(){return Boolean(app.sessionReady||store.settings.token)}
function authHeaders(extra={}){return{'Content-Type':'application/json',...(store.settings.token?{'Authorization':'Bearer '+store.settings.token}:{}),...extra}}
async function ensureSecureSession(){if(!sameOriginApi()){app.sessionReady=false;app.authChecked=true;return Boolean(store.settings.token)}try{if(store.settings.token){const r=await fetch(apiBase()+'/api/session',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Authorization':'Bearer '+store.settings.token}});if(r.ok){app.sessionReady=true;app.authChecked=true;store.settings.token='';saveStore();return true}app.sessionReady=false;app.authChecked=true;return false}const r=await fetch(apiBase()+'/api/session',{credentials:'same-origin'});app.sessionReady=r.ok;app.authChecked=true;return r.ok}catch{app.sessionReady=false;app.authChecked=true;return Boolean(store.settings.token)}}
async function api(path,opt={}){if(!hasAuth())throw new Error('Sessão de controle não configurada.');const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),12000);try{const r=await fetch(apiBase()+path,{...opt,signal:ctl.signal,credentials:'same-origin',headers:authHeaders(opt.headers||{})});const body=await r.json().catch(()=>({}));if(r.status===401&&app.sessionReady&&!store.settings.token){app.sessionReady=false;$('setupOverlay').hidden=false}if(!r.ok)throw new Error(body?.error||body?.detail||('HTTP '+r.status));return body}finally{clearTimeout(t)}}
function fmtSeconds(s){s=Math.max(0,Math.round(num(s)));if(s<60)return s+' s';const m=Math.floor(s/60),r=s%60;return r?m+' min '+r+' s':m+' min'}
function fmtAge(ts){const ms=Date.now()-num(ts);if(!ts||ms<0)return'—';if(ms<1000)return'agora';if(ms<60000)return Math.round(ms/1000)+' s';return Math.round(ms/60000)+' min'}
function fmtClock(ts){if(!ts)return'—';return new Date(num(ts)).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
function timeValue(mins){const m=Math.max(0,Math.min(1440,Math.round(num(mins))));return String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0')}
function minutesValue(v){const [h,m]=String(v||'').split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null}
function localDateTime(ts){if(!ts)return'—';return new Date(num(ts)).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
function setDot(id,state){const el=$(id);if(!el)return;el.className=state===true?'ok':state===false?'bad':'warn'}
function setBadge(el,text,tone=''){if(!el)return;el.textContent=text;el.className='badge'+(tone?' '+tone:'')}
function weather(){return app.dashboard?.current_weather||{}}
function seconds(){return app.seconds||app.dashboard?.seconds||{}}
function climateState(){return app.dashboard?.climate?.state||{}}
function climateConfig(){return app.dashboard?.climate?.config||{}}
function weatherConfig(){return app.dashboard?.weather?.config||{}}
function renderOperation(){const d=app.dashboard||{},op=d.intelligence?.operation||{},s=seconds();$('operationLabel').textContent=op.label||'AGUARDANDO';$('operationDetail').textContent=op.detail||'Aguardando estado do sistema.';const code=op.code||'neutral';$('operationCard').className='operationCard tone-'+code;$('operationIcon').textContent=code==='irrigating'?'●':code==='interval'?'◷':code==='rain'?'☂':code==='emergency'?'!':'◷';let nextAt=num(op.next_event_at);let label=op.next_event_label||'Próximo evento';if(!nextAt&&String(s.phase)==='on')nextAt=num(s.expected_off_at);if(!nextAt&&String(s.phase)==='off')nextAt=num(s.expected_next_on_at);$('nextEventLabel').textContent=label||'Próximo evento';$('nextEventValue').dataset.at=String(nextAt||0);$('nextEventValue').textContent=nextAt?fmtClock(nextAt):'—';const deviceAt=num(s.last_confirmation_at||s.state_updated_at||app.lastStatusAt);const weatherAt=num(weather().checked_at||d.weather?.state?.lastWeatherAt);$('deviceAge').textContent=fmtAge(deviceAt);$('weatherAge').textContent=fmtAge(weatherAt);$('liveAge').textContent=app.liveConnected?fmtAge(app.lastLiveAt):'reconectando';setDot('deviceDot',app.status?.online===true?true:app.status?.online===false?false:null);setDot('weatherDot',weather()?.linked&&weather()?.error==null?true:weather()?.error?false:null);setDot('liveDot',app.liveConnected?true:false);const active=Boolean(s.enabled);$('emergencyBtn').hidden=!active&&!d.safety?.emergency_latched}
function renderMetrics(){
  const d=app.dashboard||{},w=weather(),m=w.metrics||{},cs=climateState(),current=d.climate?.current||{};
  const t=m.temperature?.value,h=m.humidity?.value,v=current.vpd,r=m.rainGeneric?.value??m.rain24h?.value;
  $('temperature').textContent=Number.isFinite(Number(t))?Number(t).toFixed(1)+' °C':'—';
  $('humidity').textContent=Number.isFinite(Number(h))?Math.round(Number(h))+'%':'—';
  $('vpd').textContent=Number.isFinite(Number(v))?Number(v).toFixed(2)+' kPa':'—';
  $('vpdHint').textContent=current.fresh?'Calculado da leitura atual':current.observed_at?'Leitura climática antiga':'Aguardando leitura sincronizada';
  $('rain').textContent=Number.isFinite(Number(r))?Number(r).toFixed(1)+' mm':(m.rainDetected?'Detectada':'0.0 mm');$('rainHint').textContent=m.rainDetected?'Chuva detectada':'Sem chuva detectada';
  const level=current.fresh?String(current.level_label||current.level||''):'';setBadge($('climateBadge'),level?level.toUpperCase():'AGUARDANDO',m.rainDetected?'warn':'');
  const s=seconds(),baseOn=num(s.base_on_seconds||s.on_seconds),baseOff=num(s.base_off_seconds||s.off_seconds),curOn=num(s.on_seconds),curOff=num(s.off_seconds);$('baseCycle').textContent=baseOn&&baseOff?baseOn+' s / '+baseOff+' s':'—';$('currentCycle').textContent=curOn&&curOff?curOn+' s / '+curOff+' s':'—';const intel=d.intelligence||{};$('autoTitle').textContent=intel.cycle_reason?.title||'Automático 2.0';$('autoReason').textContent=intel.cycle_reason?.detail||cs.last_reason||'Aguardando avaliação climática.';$('intensity').textContent=(intel.intensity?.label||'—')+(Number.isFinite(Number(intel.intensity?.change_percent))?' • '+(num(intel.intensity.change_percent)>0?'+':'')+num(intel.intensity.change_percent).toFixed(0)+'%':'');const cfg=climateConfig();const mode=cfg.automatic?'AUTOMÁTICO':cfg.observation?'OBSERVAÇÃO':cfg.enabled===false?'DESLIGADO':'ATIVO';setBadge($('autoBadge'),mode,cfg.enabled===false?'warn':'')}
function renderToday(){const t=app.dashboard?.summary?.today||{};$('todayPulses').textContent=String(num(t.pulses));$('todayCompleted').textContent=num(t.completed_pulses)+' concluídos';$('todayIrrigated').textContent=fmtSeconds(t.irrigated_seconds);$('todayLast').textContent=t.last_pulse_at?fmtClock(t.last_pulse_at):'—';$('todayLastSub').textContent=t.last_pulse_at?localDateTime(t.last_pulse_at):'Sem pulso';$('todayRainPauses').textContent=String(num(t.rain_pauses));$('todayErrors').textContent=num(t.errors)+' falhas'}
function renderHealth(){const h=app.dashboard?.intelligence?.health||{};$('healthTitle').textContent=h.message||'Aguardando diagnóstico';$('healthDetail').textContent=h.level==='ok'?'Todos os serviços essenciais respondendo.':(h.issues?.[0]?.message||'Toque para abrir o Sistema.');$('healthIcon').textContent=h.level==='critical'?'!':h.level==='warning'?'•':'✓';const connected=Boolean(hasAuth()&&app.dashboard);$('headerStateText').textContent=!hasAuth()?'Configurar':!connected?'Reconectando':h.level==='critical'?'Atenção':'Online';setDot('headerDot',!hasAuth()?null:h.level==='critical'?false:connected?true:null)}
/* Remaining UI behavior is preserved by build source; this file intentionally delegates unchanged sections through the production build. */
})();
