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
  activeView:'summary',autoMode:'automatic',historyPeriod:'today',historyEventFilter:'all',automationDirty:false,loading:false,sseAbort:null,dashboardPollTimer:null,statusPollTimer:null,sessionReady:false,authChecked:false,serverReachable:false,lastServerSuccessAt:0,lastServerFailureAt:0,serverClockOffset:0,lastSecondsServerReadAt:0,telegramDirect:null,lastAutonomy:null/*FAZENDA2E_UI_SYNC_V5*/
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
function acceptSeconds(next){
  if(!next||typeof next!=='object')return false;
  const readAt=num(next.server_read_at||next.runtime_sync?.server_now);
  const currentAt=num(app.seconds?.server_read_at||app.seconds?.runtime_sync?.server_now);
  if(readAt&&currentAt&&readAt+250<currentAt)return false;
  app.seconds=next;
  if(readAt){app.lastSecondsServerReadAt=readAt;app.serverClockOffset=readAt-Date.now();}
  return true;
}
function syncedNow(){return Date.now()+num(app.serverClockOffset)}
function seconds(){
  return app.seconds||app.dashboard?.seconds||{};
}
function climateState(){return app.dashboard?.climate?.state||{}}
function climateConfig(){return app.dashboard?.climate?.config||{}}
function weatherConfig(){return app.dashboard?.weather?.config||{}}
function markServerSuccess(){app.serverReachable=true;app.lastServerSuccessAt=Date.now();renderConnectivityBanner();}
function markServerFailure(){app.lastServerFailureAt=Date.now();if(!app.lastServerSuccessAt||Date.now()-app.lastServerSuccessAt>20000)app.serverReachable=false;renderConnectivityBanner();}
function renderConnectivityBanner(){
  const bar=$('offlineBar');if(!bar)return;
  const recentServer=app.serverReachable||Date.now()-num(app.lastServerSuccessAt)>0&&Date.now()-num(app.lastServerSuccessAt)<20000;
  if(!recentServer&&app.lastServerFailureAt){bar.hidden=false;bar.className='offlineBar serverOffline';bar.textContent='Sem conexão com o servidor. Os últimos dados continuam visíveis.';return;}
  // Reconexão apenas do canal em tempo real fica nos indicadores locais, sem banner global.
  bar.hidden=true;bar.className='offlineBar';
}

function renderOperation(){
  const d=app.dashboard||{},fallback=d.intelligence?.operation||{},s=seconds();
  const phase=String(s.phase||fallback.phase||'');
  let code=fallback.code||'neutral',label=fallback.label||'AGUARDANDO',detail=fallback.detail||'Aguardando estado do sistema.',nextAt=0,nextLabel='Próximo evento';
  if(phase==='starting_on'){code='starting_on';label='LIGANDO';detail='Comando enviado. Aguardando confirmação da saída.';nextLabel='Confirmação';}
  else if(phase==='on'){code='irrigating';label='IRRIGANDO';detail='Saída do viveiro ligada.';nextAt=num(s.expected_off_at);nextLabel='Desliga';}
  else if(phase==='stopping_off'){code='stopping_off';label='DESLIGANDO';detail='Tempo concluído. Confirmando desligamento da saída.';nextLabel='Confirmação';}
  else if(phase==='off'){code='interval';label='INTERVALO';detail='Saída desligada. Aguardando o próximo pulso.';nextAt=num(s.expected_next_on_at);nextLabel='Liga';}
  else if(phase==='waiting_window'){code='waiting_schedule';label='AGUARDANDO HORÁRIO';detail='Automação armada fora da janela de irrigação.';nextAt=num(s.next_window_at);nextLabel='Próximo início';}
  else if(phase==='weather_blocked'){code='rain';label='PAUSADO POR CHUVA';detail='A Weather2-2 detectou chuva e manteve a saída desligada.';}
  else if(phase==='waiting_after_rain'){code='rain';label='AGUARDANDO APÓS CHUVA';detail='Aguardando o período de segurança para retomar.';}
  else if(phase==='weather_unavailable'){code='emergency';label='CLIMA INDISPONÍVEL';detail='Weather2-2 sem dados. Irrigação desligada por segurança.';}
  else if(phase==='maintenance'){code='neutral';label='MANUTENÇÃO';detail='Automação temporariamente bloqueada pelo modo manutenção.';}
  else if(phase==='emergency_stopped'){code='emergency';label='PARADA DE EMERGÊNCIA';detail='Saída bloqueada até liberação manual.';}
  $('operationLabel').textContent=label;
  $('operationDetail').textContent=detail;
  $('operationCard').className='operationCard tone-'+code;
  $('operationIcon').textContent=code==='irrigating'?'●':code==='interval'?'◷':code==='rain'?'☂':code==='emergency'?'!':code==='starting_on'?'▶':code==='stopping_off'?'■':'◷';
  if(!nextAt&&phase!=='starting_on'&&phase!=='stopping_off')nextAt=num(fallback.next_event_at);
  const scheduleWindow=timeValue(s.start_minutes??0)+'–'+timeValue(s.end_minutes??0);
  $('nextEventLabel').textContent=phase==='waiting_window'?'Próximo início • '+scheduleWindow:(nextLabel||fallback.next_event_label||'Próximo evento');
  $('nextEventValue').dataset.at=String(nextAt||0);
  $('nextEventValue').textContent=nextAt?fmtSeconds(Math.max(0,(nextAt-Date.now())/1000)):(phase==='starting_on'||phase==='stopping_off'?'aguarde':'—');
  const deviceAt=num(s.last_confirmation_at||s.state_updated_at||app.lastStatusAt),weatherAt=num(weather().checked_at||d.weather?.state?.lastWeatherAt);
  $('deviceAge').textContent=fmtAge(deviceAt);$('weatherAge').textContent=fmtAge(weatherAt);$('liveAge').textContent=app.liveConnected?fmtAge(app.lastLiveAt):'reconectando';
  setDot('deviceDot',app.status?.online===true?true:app.status?.online===false?false:null);setDot('weatherDot',weather()?.linked&&weather()?.error==null?true:weather()?.error?false:null);setDot('liveDot',app.liveConnected?true:false);
  const active=Boolean(s.enabled);$('emergencyBtn').hidden=!active&&!d.safety?.emergency_latched;
}

function renderMetrics(){
  const d=app.dashboard||{},w=weather(),m=w.metrics||{},cs=climateState();
  const t=m.temperature?.value;
  const h=m.humidity?.value;
  const currentClimate=d.climate?.current||{};
  const auto4Current=d.climate?.auto4||{};
  const fallbackVpd=auto4Current.vpd??seconds()?.climate4_vpd;
  const v=currentClimate.fresh?currentClimate.vpd:(Number.isFinite(Number(fallbackVpd))?Number(fallbackVpd):null);
  const r=m.rainGeneric?.value??m.rain24h?.value;
  $('temperature').textContent=Number.isFinite(Number(t))?Number(t).toFixed(1)+' °C':'—';
  $('humidity').textContent=Number.isFinite(Number(h))?Math.round(Number(h))+'%':'—';
  $('vpd').textContent=Number.isFinite(Number(v))?Number(v).toFixed(2)+' kPa':'—';
  if($('vpdHint'))$('vpdHint').textContent=currentClimate.fresh?'Calculado da leitura atual':Number.isFinite(Number(fallbackVpd))?'Calculado pelo Automático 4.0':currentClimate.observed_at?'Leitura climática antiga':'Aguardando leitura sincronizada';
  $('rain').textContent=Number.isFinite(Number(r))?Number(r).toFixed(1)+' mm':(m.rainDetected?'Detectada':'0.0 mm');
  $('rainHint').textContent=m.rainDetected?'Chuva ativa detectada':'Sem chuva ativa';

  const level=currentClimate.fresh?String(currentClimate.level_label||currentClimate.level||'').replaceAll('_',' '):'';
  setBadge($('climateBadge'),level?level.toUpperCase():'AGUARDANDO',m.rainDetected?'warn':'');

  const s=seconds(),baseOn=num(s.base_on_seconds||s.on_seconds),baseOff=num(s.base_off_seconds||s.off_seconds);
  const curOn=num(s.on_seconds),curOff=num(s.off_seconds);
  $('baseCycle').textContent=baseOn&&baseOff?baseOn+' s / '+baseOff+' s':'—';
  $('currentCycle').textContent=curOn&&curOff?curOn+' s / '+curOff+' s':'—';
  const intel=d.intelligence||{};
  $('autoTitle').textContent=intel.cycle_reason?.title||'Automático 4.0';
  $('autoReason').textContent=intel.cycle_reason?.detail||cs.last_reason||'Aguardando avaliação climática.';
  $('intensity').textContent=(intel.intensity?.label||'—')+(Number.isFinite(Number(intel.intensity?.change_percent))?' • '+(num(intel.intensity.change_percent)>0?'+':'')+num(intel.intensity.change_percent).toFixed(0)+'%':'');
  const cfg=climateConfig();
  const mode=cfg.automatic?'AUTOMÁTICO':cfg.observation?'OBSERVAÇÃO':cfg.enabled===false?'DESLIGADO':'ATIVO';
  setBadge($('autoBadge'),mode,cfg.enabled===false?'warn':'');
}

function renderAutonomy(){
  const candidate=app.dashboard?.autonomy;
  const valid=candidate&&(candidate.checked_at||candidate.version||Number.isFinite(Number(candidate.score)));
  const a=valid?candidate:(app.lastAutonomy||{}); if(valid)app.lastAutonomy=candidate;
  const l=a.learning||{},b=l.baseline||{};
  const score=Number(a.score),status=String(a.status||'starting');
  const label=status==='healthy'?'SAUDÁVEL':status==='protected'?'PROTEGIDO':status==='degraded'?'DEGRADADO':status==='attention'?'ATENÇÃO':'INICIANDO';
  const title=status==='healthy'?'Sistema cuidando sozinho':status==='protected'?'Proteção automática ativa':status==='degraded'?'Desvio sendo acompanhado':status==='attention'?'Intervenção pode ser necessária':'Supervisor iniciando';
  const first=(a.issues||[])[0]?.message; const stage=l.stage||'Aprendendo o viveiro';
  const detail=first||stage+' • clima, dispositivos, histórico e Automático 4.0 sob supervisão.';
  if($('autonomyTitle'))$('autonomyTitle').textContent=title;
  if($('autonomyDetail'))$('autonomyDetail').textContent=detail;
  if($('autonomyScore'))$('autonomyScore').textContent=Number.isFinite(score)?Math.round(score):'—';
  if($('autonomySystemScore'))$('autonomySystemScore').textContent=Number.isFinite(score)?Math.round(score)+'/100':'—';
  if($('autonomyChecked'))$('autonomyChecked').textContent=a.checked_at?fmtAge(a.checked_at)+' atrás':'—';
  if($('autonomySystemDetail'))$('autonomySystemDetail').textContent=detail;
  if($('autonomySystemBadge'))setBadge($('autonomySystemBadge'),label,status==='attention'?'bad':status==='degraded'?'warn':'');
  if($('autonomyLearningStage'))$('autonomyLearningStage').textContent=stage;
  if($('autonomyNormality'))$('autonomyNormality').textContent=String(l.normality||'—').toUpperCase();
  if($('autonomyAnomalies'))$('autonomyAnomalies').textContent=String(Number(l.anomaly_count||0));
  const recovery=Array.isArray(a.recovery)?a.recovery:[];
  if($('autonomyRecovery'))$('autonomyRecovery').innerHTML=recovery.length?recovery.slice(-3).map(x=>'<span class="'+(x.ok?'ok':'bad')+'">'+(x.ok?'✓ ':'! ')+esc(x.key||'recuperação')+'</span>').join(''):'<span class="ok">✓ Nenhuma recuperação necessária agora</span>';
  const t=b.climate?.temperature,h=b.climate?.humidity,v=b.climate?.vpd;
  const parts=[];
  if(t?.samples>=4)parts.push('Temp '+Number(t.median).toFixed(1)+' °C');
  if(h?.samples>=4)parts.push('Umid '+Number(h.median).toFixed(0)+'%');
  if(v?.samples>=4)parts.push('VPD '+Number(v.median).toFixed(2));
  if($('autonomyLearnedRanges'))$('autonomyLearnedRanges').textContent=parts.length?'Padrão aprendido: '+parts.join(' • '):'Coletando histórico suficiente para aprender o padrão do viveiro.';
}

function renderAutonomyV3(){
  const candidate=app.dashboard?.autonomy;
  const valid=candidate&&(candidate.checked_at||candidate.version||Number.isFinite(Number(candidate.score)));
  const a=valid?candidate:(app.lastAutonomy||{}); if(valid)app.lastAutonomy=candidate;
  const p=a.daily_plan||{},m=a.maintenance||{};
  const demand=String(p.demand||'—').toUpperCase();
  if($('dailyPlanTitle'))$('dailyPlanTitle').textContent='Demanda '+demand.toLowerCase();
  if($('dailyPlanDetail'))$('dailyPlanDetail').textContent=(p.why||[]).slice(0,2).join(' • ')||'Aguardando previsão e histórico suficientes.';
  if($('dailyPlanScore'))$('dailyPlanScore').textContent=Number.isFinite(Number(p.score))?Math.round(Number(p.score)):'—';
  if($('maintenanceTitle'))$('maintenanceTitle').textContent=m.status==='attention'?'Revisão preventiva recomendada':m.status==='observe'?'Tendência em observação':'Sem degradação relevante';
  if($('maintenanceScore'))$('maintenanceScore').textContent=Number.isFinite(Number(m.score))?Math.round(Number(m.score))+'/100':'—';
  if($('maintenanceDetail'))$('maintenanceDetail').textContent=(m.issues||[])[0]?.message||'Latência, falhas e interrupções dentro do padrão recente.';
}

function renderAutonomy31(){
  const d=app.dashboard||{},candidate=d.autonomy,valid=candidate&&(candidate.checked_at||candidate.version||Number.isFinite(Number(candidate.score))),a=valid?candidate:(app.lastAutonomy||{});
  const r=a.reliability||{},s=r.scores||{};
  const set=(id,v)=>{const e=$(id);if(e)e.textContent=v};
  set('reliabilityOverall31',Number.isFinite(Number(r.overall))?Math.round(Number(r.overall))+'/100':'—');
  set('relController31',Number.isFinite(Number(s.controller))?Math.round(Number(s.controller))+'/100':'—');
  set('relEkaza31',Number.isFinite(Number(s.ekaza))?Math.round(Number(s.ekaza))+'/100':'—');
  set('relWeather31',Number.isFinite(Number(s.weather))?Math.round(Number(s.weather))+'/100':'—');
  set('relFirebase31',Number.isFinite(Number(s.firebase))?Math.round(Number(s.firebase))+'/100':'—');
  set('relHistory31',Number.isFinite(Number(s.history))?Math.round(Number(s.history))+'/100':'—');
  const auto=d.climate?.auto4||{},latest=(d.intelligence?.decisions||[]).find(x=>String(x.type||'')==='viveiro_automatic4_decision')||{};
  const climate=d.climate?.current||{},today=d.summary?.today||{},observed=[];
  if(Number.isFinite(Number(climate.temperature)))observed.push(Number(climate.temperature).toFixed(1)+' °C');
  if(Number.isFinite(Number(climate.humidity)))observed.push(Math.round(Number(climate.humidity))+'% UR');
  if(Number.isFinite(Number(climate.vpd)))observed.push('VPD '+Number(climate.vpd).toFixed(2));
  set('decisionObserved',observed.join(' • ')||'Clima e histórico em análise');
  set('decisionAction',latest.title||auto.decision||'OBSERVANDO');
  set('decisionWhy',latest.detail||auto.reason||'Aguardando justificativa do Automático 4.0.');
  const target=Number(latest.to_off||latest.to_off_seconds||auto.target_off_seconds||0);
  set('decisionResult',(target?'Intervalo '+Math.round(target)+' s • ':'')+num(today.completed_pulses)+' pulsos concluídos • '+num(today.errors)+' falhas');
}

function renderAutonomy32(){
  const a=app.dashboard?.autonomy||app.lastAutonomy||{},risk=a.risk||{},b=a.backup_health||{},r=a.reliability||{},s=r.scores||{},p=a.daily_plan||{},cc=app.dashboard?.climate?.current||{};
  const set=(id,v)=>{const e=$(id);if(e)e.textContent=v};
  const level=String(risk.level||'—');
  set('preventiveTitle32',level==='baixo'?'Sem risco relevante':level==='atencao'?'Atenção preventiva':level==='provavel'?'Degradação provável':level==='iminente'?'Falha iminente':'Calculando risco');
  set('preventiveScore32',Number.isFinite(Number(risk.score))?Math.round(Number(risk.score))+'/100':'—');
  set('preventiveDetail32',(risk.reasons||[])[0]||risk.recommendation||'Nenhum sinal preventivo relevante agora.');
  set('riskLevel32',level==='atencao'?'ATENÇÃO':level==='provavel'?'PROVÁVEL':level==='iminente'?'IMINENTE':level==='baixo'?'BAIXO':'—');
  set('backupState32',b.restorable===true?'RESTAURÁVEL':b.restorable===false?'VERIFICAR':'—');
  set('controllerState32',Number.isFinite(Number(s.controller))?Math.round(Number(s.controller))+'/100':'—');
  set('cloudState32',Number.isFinite(Number(s.ekaza))?Math.round(Number(s.ekaza))+'/100':'—');
  const v=Number(cc.vpd??seconds()?.climate4_vpd),t=Number(cc.temperature),h=Number(cc.humidity);
  let title='Manejo estável',detail='Condições atuais sem desvio agronômico relevante.';
  if(Number.isFinite(v)&&v>=2.5){title='Demanda atmosférica alta';detail='VPD '+v.toFixed(2)+' kPa. O Automático 4.0 pode aumentar a frequência dentro das proteções.';}
  else if(Number.isFinite(v)&&v<=0.8){title='Demanda atmosférica baixa';detail='VPD '+v.toFixed(2)+' kPa. Evite aumentar irrigação manualmente sem necessidade.';}
  else if(p.demand==='alta'||p.demand==='elevada'){title='Demanda '+String(p.demand);detail=(p.why||[]).slice(0,2).join(' • ')||'Plano do dia indica maior demanda.';}
  if(Number.isFinite(t)&&Number.isFinite(h))detail+=' • '+t.toFixed(1)+' °C • '+Math.round(h)+'%';
  set('agronomyTitle32',title);set('agronomyDetail32',detail);
}

function renderAutonomy33(){
  const d=app.dashboard||{},a=d.autonomy||{},l=a.result_learning||{},journal=a.decision_journal||[],self=a.recovery_self_test||{};
  const set=(id,v)=>{const e=$(id);if(e)e.textContent=v};
  set('decisionSamples33',Number.isFinite(Number(l.samples))?String(l.samples):'—');
  set('decisionOutcome33',Number.isFinite(Number(l.average_outcome))?Math.round(Number(l.average_outcome))+'/100':'—');
  set('decisionConfidence33',String(l.confidence||'—').toUpperCase());
  set('decisionLearningSummary33',l.summary||'Aguardando decisões avaliadas.');
  if($('decisionLearningBadge33'))setBadge($('decisionLearningBadge33'),l.confidence?String(l.confidence).toUpperCase():'COLETANDO',l.average_outcome<65?'warn':'');
  if($('decisionJournal33'))$('decisionJournal33').innerHTML=journal.slice(0,8).map(x=>'<div class="decisionJournalRow33"><span><b>'+esc(x.decision||'—')+' • '+esc((x.to_off_seconds??'—')+' s')+'</b><small>'+esc(x.reason||'Sem justificativa')+'</small></span><em class="'+(x.outcome_score>=85?'ok':x.outcome_score<65?'warn':'')+'">'+esc((x.outcome_score??'—')+'/100')+'</em></div>').join('')||'<div class="panelNote">Ainda não há decisões avaliadas.</div>';
  const cases=Array.isArray(self.cases)?self.cases:[],passed=cases.filter(x=>x.ok).length;
  set('recoverySelfTitle33',self.ok?'Proteções aprovadas':'Verificar proteções');
  set('recoverySelfScore33',cases.length?passed+'/'+cases.length:'—');
  set('recoverySelfDetail33',self.note||'Simulações sem desligar dispositivos reais.');
}

function renderIntelligence42(){
  const i=app.dashboard?.autonomy?.intelligence_4_2||app.dashboard?.autonomy?.intelligence_4_1||{};
  const set=(id,v)=>{const e=$(id);if(e)e.textContent=v};
  const tendency=String(i.tendency||'APRENDENDO');
  set('intel41Title',tendency==='MANTER'?'Manejo estável':tendency);
  set('intel41Reason',i.reason||'Analisando clima, histórico e resultado dos ciclos sem assumir o controle físico.');
  set('intel41Confidence',Number.isFinite(Number(i.confidence_score))?Math.round(Number(i.confidence_score))+'/100':'—');
  set('intel41Next',i.next_action||'Próxima ação em análise');
  const f=i.forecast||{};
  set('intel42Pulses',Number.isFinite(Number(f.pulses))?String(Math.round(Number(f.pulses))):'—');
  set('intel42Time',Number.isFinite(Number(f.irrigated_seconds))?fmtSeconds(f.irrigated_seconds):'—');
  set('intel42Rain',Number.isFinite(Number(f.rain_probability))?Math.round(Number(f.rain_probability))+'%':'—');
  set('intel42Demand',f.demand?String(f.demand).toUpperCase():'—');
}

function renderSimulator42(){
  if(!$('simOn')||!$('simOff'))return;
  const on=Math.max(1,num($('simOn').value,30)),off=Math.max(1,num($('simOff').value,196));
  const pulses=3600/(on+off),minutes=pulses*on/60,s=seconds();
  const baseOn=Math.max(1,num(s.base_on_seconds||s.on_seconds,30)),baseOff=Math.max(1,num(s.base_off_seconds||s.off_seconds,120));
  const delta=((on/(on+off))/(baseOn/(baseOn+baseOff))-1)*100;
  $('simPulses').textContent=pulses.toFixed(1);$('simMinutes').textContent=minutes.toFixed(1)+' min';$('simDelta').textContent=(delta>=0?'+':'')+delta.toFixed(0)+'%';
}
function classifyHistory3Event(row={}){
  const t=String(row.type||'');
  if(t.includes('pulse_complete'))return['✓','Pulso concluído'];
  if(t.includes('pulse_start'))return['▶','Pulso iniciado'];
  if(t.includes('weather')||t.includes('rain'))return['☂',t.includes('resume')?'Retomada após chuva':'Proteção por chuva'];
  if(t.includes('automatic4')||t.includes('climate'))return['A','Decisão do Automático 4.0'];
  if(t.includes('error')||t.includes('failure')||t.includes('emergency'))return['!','Falha ou proteção'];
  return['•','Evento do sistema'];
}
function renderHistory3(data=app.dashboard?.history3||{}){
  if(!$('history3Timeline'))return;
  const summary=data.summary||{},events=Array.isArray(data.events)?data.events:[];
  if($('historyDate')&&!$('historyDate').value)$('historyDate').value=data.selected_date||data.today_date||'';
  setBadge($('history3Badge'),data.selected_date===data.today_date?'HOJE':'ARQUIVO','');
  $('history3Pulses').textContent=String(num(summary.pulses??summary.completed));
  $('history3Time').textContent=fmtSeconds(summary.irrigated_seconds);
  $('history3Rain').textContent=String(num(summary.rain_pauses));
  $('history3Errors').textContent=String(num(summary.errors));
  $('history3EventsCount').textContent=String(num(data.total_events,events.length))+' EVENTOS';
  $('history3Timeline').innerHTML=events.length?events.slice(-120).reverse().map(row=>{const [icon,title]=classifyHistory3Event(row),when=num(row.ts||Date.parse(row.at||0)),detail=row.reason||row.detail||row.message||row.decision||'';return '<div class="eventItem"><div class="eventIcon">'+esc(icon)+'</div><div><b>'+esc(title)+'</b><small>'+esc(detail)+'</small></div><span class="eventTime">'+esc(when?fmtClock(when):'—')+'</span></div>'}).join(''):'<div class="panelNote emptyState"><b>Sem eventos neste dia.</b><span>Selecione outra data para consultar o histórico.</span></div>';
}
async function loadHistory3Day(date){
  if(!date||!hasAuth())return;
  try{const d=await api('/api/viveiro/dashboard?fresh=1&history_date='+encodeURIComponent(date));if(d?.history3){if(app.dashboard)app.dashboard.history3=d.history3;renderHistory3(d.history3)}}catch(e){toast(e.message||'Falha ao abrir o dia.')}
}
function shiftHistory3Day(delta){const input=$('historyDate');if(!input?.value)return;const d=new Date(input.value+'T12:00:00');d.setDate(d.getDate()+delta);input.value=d.toISOString().slice(0,10);loadHistory3Day(input.value)}
function exportHistory3Day(){
  const h=app.dashboard?.history3||{},rows=Array.isArray(h.events)?h.events:[];if(!rows.length)return toast('Não há eventos para exportar.');
  const csv=['data_hora,tipo,decisao,motivo'].concat(rows.map(r=>[new Date(num(r.ts||Date.parse(r.at||0))).toISOString(),r.type||'',r.decision||'',r.reason||r.detail||''].map(v=>'"'+String(v).replaceAll('"','""')+'"').join(','))).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='fazenda2e-'+String(h.selected_date||'historico')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function renderProfessionalAlerts(){
  if(!$('alertCenterList'))return;
  const incidents=app.dashboard?.reports?.incidents?.recent||[],issues=app.dashboard?.autonomy?.issues||[],items=[];
  for(const x of incidents.slice(0,8))items.push({level:x.level||'warning',message:x.message||x.code||'Ocorrência',status:x.status||'resolved',resolution:x.resolution||''});
  for(const x of issues.slice(0,8))items.push({level:x.level||'warning',message:x.message||x.key||'Alerta',status:'open',resolution:''});
  const unique=[],seen=new Set();for(const x of items){const k=x.message+'|'+x.status;if(seen.has(k))continue;seen.add(k);unique.push(x)}
  const critical=unique.filter(x=>x.level==='critical'&&x.status==='open').length,attention=unique.filter(x=>x.level!=='critical'&&x.status==='open').length;
  setBadge($('alertCenterBadge'),critical?critical+' CRÍTICO'+(critical>1?'S':''):attention?attention+' ATENÇÃO':'NORMAL',critical?'bad':attention?'warn':'');
  $('alertCenterList').innerHTML=unique.length?unique.slice(0,12).map(x=>'<div class="incidentItem '+(x.level==='critical'?'critical':'warning')+'"><i>'+(x.status==='open'?'!':'✓')+'</i><span><b>'+esc(x.level==='critical'?'Crítico':x.level==='info'?'Informativo':'Atenção')+'</b><small>'+esc(x.message)+' • '+esc(x.status==='open'?'aberto':x.resolution==='automatico'?'resolvido automaticamente':'resolvido')+'</small></span></div>').join(''):'<div class="auditOk"><i>✓</i><span><b>Nenhum alerta registrado</b><small>O sistema está sem ocorrência ativa.</small></span></div>';
}
async function runGuidedDiagnostics42(){
  const btn=$('runDiagnosticsBtn');if(!btn)return;btn.disabled=true;btn.textContent='Verificando…';
  try{const r=await fetch(apiBase()+'/api/irrigation/diagnostics',{credentials:'same-origin',headers:authHeaders()});const d=await r.json();renderServerDiagnostics(d);const rows=Object.values(d.guided_checks||{}),bad=rows.filter(x=>!x.ok);setBadge($('guidedDiagBadge'),bad.length?bad.length+' ATENÇÃO':'SAUDÁVEL',bad.some(x=>['EKAZA','Weather2-2','Smart Life','Watchdog'].includes(x.label))?'bad':bad.length?'warn':'');$('guidedDiagSummary').textContent=bad.length?'A auditoria encontrou '+bad.length+' item(ns) para revisar.':'Todos os componentes auditados responderam normalmente.';$('guidedDiagList').innerHTML=rows.map(x=>'<div class="auditItem '+(x.ok?'':'warning')+'"><i>'+(x.ok?'✓':'!')+'</i><span><b>'+esc(x.label||'Componente')+'</b><small>'+esc(x.detail||'Sem detalhe')+(Number.isFinite(Number(x.ms))?' • '+Math.round(x.ms)+' ms':'')+'</small></span></div>').join('')}catch(e){setBadge($('guidedDiagBadge'),'FALHA','bad');$('guidedDiagSummary').textContent=e.message||'Falha no diagnóstico.'}finally{btn.disabled=false;btn.textContent='Verificar sistema agora'}
}
async function loadBackups42(){
  if(!$('backup42List')||!hasAuth())return;
  try{const d=await api('/api/irrigation/backups'),list=d.backups||[];setBadge($('backup42Badge'),list.length?list.length+' DISPONÍVEIS':'SEM BACKUP',list.length?'':'warn');$('backup42List').innerHTML=list.length?list.map(b=>'<div class="backup42Row"><span><b>'+esc(localDateTime(b.created_at))+'</b><small>'+esc(b.reason||'manual')+' • '+(b.restorable===false?'INTEGRIDADE: FALHA':'ÍNTEGRO')+'</small></span><button type="button" data-backup-restore="'+esc(b.id)+'">Restaurar</button></div>').join(''):'<p class="panelNote">Nenhum backup de configuração encontrado.</p>';qsa('[data-backup-restore]').forEach(btn=>btn.addEventListener('click',()=>restoreBackup42(btn.dataset.backupRestore)))}catch(e){setBadge($('backup42Badge'),'INDISPONÍVEL','warn')}
}
async function createBackup42(){try{await api('/api/irrigation/backups',{method:'POST',body:JSON.stringify({action:'create',reason:'manual_app_4_2'})});toast('Backup criado com sucesso.');await loadBackups42()}catch(e){toast(e.message||'Falha ao criar backup.')}}
async function restoreBackup42(id){if(!confirm('Restaurar este backup de configuração? O estado físico ao vivo não será restaurado.'))return;try{await api('/api/irrigation/backups',{method:'POST',body:JSON.stringify({action:'restore',id,confirm:true})});toast('Configuração restaurada.');await Promise.all([loadBackups42(),loadDashboard(false,true)])}catch(e){toast(e.message||'Falha ao restaurar backup.')}}

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
  const connected=Boolean(hasAuth()&&app.dashboard);
  const emergency=Boolean(app.dashboard?.safety?.emergency_latched||app.dashboard?.safety?.latched);
  if(emergency&&connected){
    $('healthTitle').textContent='Parada manual ativa';
    $('healthDetail').textContent='Saída desligada e sistema protegido até liberação manual.';
    $('healthIcon').textContent='■';
    $('headerStateText').textContent='Pausado';
    setDot('headerDot',null);
    return;
  }
  $('healthTitle').textContent=h.message||'Aguardando diagnóstico';
  $('healthDetail').textContent=h.level==='ok'?'Todos os serviços essenciais respondendo.':(h.issues?.[0]?.message||'Toque para abrir o Sistema.');
  $('healthIcon').textContent=h.level==='critical'?'!':h.level==='warning'?'•':'✓';
  $('headerStateText').textContent=!hasAuth()?'Configurar':!connected?'Reconectando':h.level==='critical'?'Atenção':'Online';
  setDot('headerDot',!hasAuth()?null:h.level==='critical'?false:connected?true:null);
}
function renderAuto4(){
  const a=app.dashboard?.climate?.auto4||app.dashboard?.intelligence?.auto4||{};
  const el=id=>document.getElementById(id);if(!el('auto4Decision'))return;
  el('auto4Decision').textContent=a.decision||'OBSERVANDO';
  el('auto4Confidence').textContent='Confiança '+(a.confidence_label||'—')+(Number.isFinite(Number(a.confidence_score))?' • '+a.confidence_score+'%':'');
  el('auto4Reason').textContent=a.reason||'Coletando dados para o Automático 4.0.';
  el('auto4Current').textContent=a.current_on_seconds?(a.current_on_seconds+'/'+a.current_off_seconds+' s'):'—';
  el('auto4Target').textContent=a.target_on_seconds?(a.target_on_seconds+'/'+a.target_off_seconds+' s'):'—';
  el('auto4Demand').textContent=Number.isFinite(Number(a.demand_percent))?(a.demand_percent>0?'+':'')+a.demand_percent+'%':'—';
  el('auto4Factors').innerHTML=(a.factors||[]).slice(0,4).map(x=>'<span>'+escapeHtml(String(x))+'</span>').join('');
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
  $('maxAdjustPercent').value=Math.round(num(cc.max_adjust_percent,30));
  setBadge($('autoConfigState'),app.autoMode==='automatic'?'AUTOMÁTICO':app.autoMode==='observation'?'OBSERVANDO':'DESLIGADO',app.autoMode==='off'?'warn':'');

  $('rainEnabled').checked=wc.enabled!==false;
  $('resumeDelay').value=Math.round(num(wc.resumeDelayMinutes,30));
  $('weatherCheck').value='≈ 4';
  setBadge($('rainProtectionState'),wc.enabled===false?'DESLIGADA':'ATIVA',wc.enabled===false?'warn':'');
}
function applyHistoryPeriod(period=app.historyPeriod||'today'){
  app.historyPeriod=period;
  qsa('.historyPeriodBlock').forEach(el=>{el.hidden=el.dataset.period!==period});
  qsa('#historyPeriod button').forEach(b=>{
    const active=b.dataset.period===period;b.classList.toggle('active',active);b.setAttribute('aria-selected',active?'true':'false');
  });
}
function renderHistory(){
  const set=(id,v)=>{const e=$(id);if(e)e.textContent=v};
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
      ?(num(incidents.totals?.open)>0?'Existe uma ocorrência aberta que merece acompanhamento.':'Houve uma ocorrência hoje, mas não existe incidente aberto agora.')
      :'Irrigação, clima e auditoria sem ocorrência crítica hoje.';
  $('dayStatusCard').className='dayStatusCard '+status;
  setBadge($('dayStatusBadge'),status==='critical'?'CRÍTICO':status==='warning'?'ATENÇÃO':'NORMAL',status==='critical'?'bad':status==='warning'?'warn':'');

  const liveDecisions=(app.dashboard?.intelligence?.decisions||[]).filter(x=>String(x.type||'')==='viveiro_automatic4_decision');
  const liveAdjustments=liveDecisions.filter(x=>['REDUZIR','INTENSIFICAR','AUMENTAR'].includes(String(x.decision||'').toUpperCase())).length;
  $('reportAutoAdjust').textContent=String(Math.max(num(today.auto_adjustments),liveAdjustments));
  $('reportInterruptions').textContent=String(num(today.interrupted));
  const climate=today.climate||{};
  $('reportTemperature').textContent=Number.isFinite(Number(climate.temperature_min))&&Number.isFinite(Number(climate.temperature_max))
    ?Number(climate.temperature_min).toFixed(1)+'–'+Number(climate.temperature_max).toFixed(1)+' °C'
    :'—';
  $('reportIncidents').textContent=String(num(incidents.totals?.open));
  applyHistoryPeriod();

  const trendAll=reports.trend30||[];
  const yesterday=trendAll.length>1?trendAll[trendAll.length-2]:{};
  const recent7=trendAll.slice(-7);
  const daysWithData=recent7.filter(x=>num(x.pulses)>0||num(x.irrigated_seconds)>0);
  const avg7Pulses=daysWithData.length?daysWithData.reduce((a,x)=>a+num(x.pulses),0)/daysWithData.length:0;
  const avg7Seconds=daysWithData.length?daysWithData.reduce((a,x)=>a+num(x.irrigated_seconds),0)/daysWithData.length:0;
  set('historyTodayPulses',String(num(today.pulses)));set('historyTodayTime',fmtSeconds(today.irrigated_seconds));
  set('historyYesterdayPulses',String(num(yesterday.pulses)));set('historyYesterdayTime',fmtSeconds(yesterday.irrigated_seconds));
  set('historyAvg7Pulses',avg7Pulses?avg7Pulses.toFixed(1):'—');set('historyAvg7Time',avg7Seconds?fmtSeconds(avg7Seconds):'—');
  const dP=num(today.pulses)-num(yesterday.pulses),dT=num(today.irrigated_seconds)-num(yesterday.irrigated_seconds);
  set('historyDeltaPulses',(dP>0?'+':'')+String(dP));set('historyDeltaTime',(dT>0?'+':'')+fmtSeconds(Math.abs(dT))+(dT<0?' menos':dT>0?' a mais':''));
  setBadge($('historyCompareBadge'),num(yesterday.pulses)>0?'ATUALIZADO':'SEM BASE','');
  const confidences=recent7.map(x=>String(x.history_confidence||'none'));
  const high=confidences.filter(x=>x==='high').length,medium=confidences.filter(x=>x==='medium').length,low=confidences.filter(x=>x==='low').length;
  const todayConfidence=String(today.history_confidence||'none');
  const qualityLabel=todayConfidence==='high'?'CONFIÁVEL':todayConfidence==='medium'?'RECONCILIADO':todayConfidence==='low'?'LEGADO INCOMPLETO':'SEM DADOS';
  setBadge($('historyQualityBadge'),qualityLabel,todayConfidence==='low'?'warn':'');
  set('historyQualityDetail','Hoje: '+qualityLabel.toLowerCase()+'. Últimos 7 dias: '+high+' confiável(is), '+medium+' reconciliado(s), '+low+' legado(s) incompleto(s). Eventos brutos são preservados.');

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
  $('decisionList').innerHTML=decisions.slice(0,12).map(x=>eventHtml(x,true)).join('')||'<div class="panelNote emptyState"><b>Automático 4.0 sem nova decisão neste período.</b><span>A última condição conhecida continua válida até a próxima avaliação.</span></div>';
  const history=app.dashboard?.history||[];
  const filter=String(app.historyEventFilter||'all');
  const filtered=history.filter(x=>{const t=String(x.type||'');if(filter==='pulse')return t.includes('pulse');if(filter==='climate')return t.includes('climate')||t.includes('weather')||t.includes('rain');if(filter==='issue')return t.includes('error')||t.includes('failure')||t.includes('interrupted')||t.includes('emergency')||t.includes('audit_alert');return true;});
  qsa('#historyEventFilter button').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter));
  $('historyList').innerHTML=filtered.slice(0,30).map(x=>eventHtml(x,false)).join('')||'<div class="panelNote emptyState"><b>Sem eventos neste filtro.</b><span>Selecione outro filtro ou aguarde novos registros.</span></div>';
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
  let detail='';
  if(decision){
    const action=String(x.decision||'').toUpperCase();
    const cycle=(Number.isFinite(Number(x.from_off))&&Number.isFinite(Number(x.to_off)))?Math.round(Number(x.from_off))+' → '+Math.round(Number(x.to_off))+' s':'';
    const confidence=Number.isFinite(Number(x.confidence_score))?'confiança '+Math.round(Number(x.confidence_score))+'%':'';
    detail=[action,cycle,confidence,x.reason||x.detail||''].filter(Boolean).join(' • ');
  }else detail=x.detail||x.reason||((x.actual_duration_seconds!=null)?fmtSeconds(x.actual_duration_seconds):'');
  return '<div class="eventItem"><div class="eventIcon">'+esc(icon)+'</div><div><b>'+esc(title)+'</b><small>'+esc(detail)+'</small></div><span class="eventTime">'+esc(when?localDateTime(when):'—')+'</span></div>';
}
async function syncTelegramDirect(){
  if(!hasAuth())return;
  try{
    const d=await api('/api/irrigation/telegram');
    app.telegramDirect=d.telegram||{};
    if(app.dashboard){app.dashboard.notifications=app.dashboard.notifications||{};app.dashboard.notifications.telegram=app.telegramDirect;}
    renderTelegram();
  }catch(e){}
}

function renderTelegram(){
  const t=app.telegramDirect||app.dashboard?.notifications?.telegram||{};
  const configured=Boolean(t.bot_token_configured),bound=Boolean(t.bound);
  const label=bound?'VINCULADO':configured?'AGUARDANDO VÍNCULO':'NÃO CONFIGURADO';
  if($('telegramBadge'))setBadge($('telegramBadge'),label,bound?'':configured?'warn':'');
  if($('telegramDetail'))$('telegramDetail').textContent=bound?'Alertas automáticos e consultas estão ativos neste Telegram.':configured?'Bot pronto. Vincule seu Telegram com o código abaixo.':'Crie um bot no BotFather e configure o token no servidor para ativar.';
  if($('telegramSetupBox'))$('telegramSetupBox').hidden=configured;
  if($('telegramPairBox'))$('telegramPairBox').hidden=!configured||bound||!t.pairing_code;
  if($('telegramPairCode'))$('telegramPairCode').textContent=t.pairing_code||'—';
}

function renderSystem(){
  const d=app.dashboard||{},s=seconds(),w=weather(),health=d.intelligence?.health||{};
  const overall=$('systemOverallCard'),overallTitle=$('systemOverallTitle'),overallDetail=$('systemOverallDetail'),overallIcon=$('systemOverallIcon');
  if(overall){const level=String(health.level||'ok'),auto=app.dashboard?.autonomy||{},maint=auto.maintenance||{};overall.className='systemOverallCard '+level;overallIcon.textContent=level==='critical'?'!':level==='warning'?'•':'✓';overallTitle.textContent=level==='critical'?'Sistema requer atenção':level==='warning'?'Sistema operando com aviso':'Sistema funcionando normalmente';overallDetail.textContent=level==='ok'?(maint.status==='attention'?'Irrigação protegida e operacional. Comunicação Smart Life em observação preventiva.':'Serviços essenciais operacionais e protegidos.'):(health.issues?.[0]?.message||health.message||'Verifique os detalhes abaixo.');}

  const deviceOk=app.status?.online===true;
  const weatherOk=Boolean(w.linked&&!w.error&&w.device?.online!==false);
  const reconnectBadge=$('smartLifeReconnectBadge'),reconnectText=$('smartLifeReconnectText');
  if(reconnectBadge&&!app.smartLifeReauthToken){
    const smartLifeOk=deviceOk&&weatherOk;
    setBadge(reconnectBadge,smartLifeOk?'CONECTADO':'ATENÇÃO',smartLifeOk?'':'warn');
    if(reconnectText)reconnectText.textContent=smartLifeOk
      ?'EKAZA e Weather2-2 estão conectados. Use a reconexão somente se ambos perderem comunicação.'
      :'Uma das leituras Smart Life não está confirmada. Reconecte apenas se EKAZA e Weather2-2 estiverem sem comunicação.';
  }
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
  const systemHealthOk=String(health?.level||'ok')==='ok';
  $('watchdogState').textContent=s.watchdog?.status||s.watchdog_status||(systemHealthOk?'Sem alerta':'Aguardando');
  const confirmationAt=num(s.last_confirmation_at||s.state_updated_at||app.lastStatusAt);
  $('confirmationState').textContent=confirmationAt?fmtAge(confirmationAt)+' atrás':'Aguardando';
  const latencyAvg=Number(s.confirmation_latency?.avg_ms);
  const latencyLast=Number(s.last_confirmation_latency_ms);
  $('confirmationLatencyState').textContent=Number.isFinite(latencyAvg)&&num(s.confirmation_latency?.samples)>0
    ?Math.round(latencyAvg)+' ms méd.'
    :Number.isFinite(latencyLast)&&latencyLast>0?Math.round(latencyLast)+' ms':'Aguardando amostra';
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
function renderExecutiveV5(){
 const d=app.dashboard||{},a=d.climate?.auto4||{},t=d.summary?.today||{},health=d.intelligence?.health||{};
 const set=(id,v)=>{const e=$(id);if(e)e.textContent=v};
 const live=seconds(),phase=String(live.phase||'');
 const phaseLabel=phase==='on'?'IRRIGANDO':phase==='off'?'INTERVALO':phase==='starting_on'?'LIGANDO':phase==='stopping_off'?'DESLIGANDO':phase==='weather_blocked'?'PAUSADO PELA CHUVA':phase==='waiting_after_rain'?'AGUARDANDO APÓS CHUVA':phase==='waiting_window'?'AGUARDANDO HORÁRIO':phase==='maintenance'?'MANUTENÇÃO':phase.includes('emergency')?'EMERGÊNCIA':(d.intelligence?.operation?.label||'Sistema analisando');
 set('execHeadline',String(phaseLabel).replaceAll('_',' '));set('execSubline',a.reason||d.intelligence?.operation?.detail||'Operação monitorada em tempo real.');
 set('execScore',Number.isFinite(Number(a.confidence_score))?Math.round(Number(a.confidence_score))+'%':'—');set('execScoreLabel',a.confidence_label||'coletando');
 set('sum4Decision',a.decision||'OBSERVANDO');set('sum4Reason',a.reason||'O 4.0 está reunindo dados sem controlar a bomba.');
 set('sum4Current',a.current_on_seconds?a.current_on_seconds+'/'+a.current_off_seconds+' s':'—');set('sum4Target',a.target_on_seconds?a.target_on_seconds+'/'+a.target_off_seconds+' s':'—');set('sum4Demand',Number.isFinite(Number(a.demand_percent))?((Number(a.demand_percent)>0?'+':'')+a.demand_percent+'% vs base'):'—');
 const f=$('sum4Factors');if(f)f.innerHTML=(a.factors||[]).slice(0,4).map(x=>'<span>'+esc(x)+'</span>').join('');
 const pulses=num(t.pulses),completed=num(t.completed_pulses),errors=num(t.errors),rate=pulses?Math.round(completed/pulses*100):100;
 set('kpiCompletion',rate+'%');set('kpiErrors',String(errors));set('kpiRain',String(num(t.rain_pauses)));set('kpiIrrigated',fmtSeconds(t.irrigated_seconds));
 const good=errors===0&&health.level!=='critical';setBadge($('decisionHealth'),good?'NORMAL':'ATENÇÃO',good?'':'warn');
 set('decisionAdvice',errors?'Há '+errors+' falha(s) registrada(s) hoje. Consulte o histórico antes de alterar o automático.':num(t.rain_pauses)?'Proteção por chuva atuou hoje. O automático permanece subordinado às proteções.':'Operação sem falhas registradas hoje. O 4.0 continua comparando decisões em modo sombra.');
}
function safeRenderBlock33(name,fn){try{fn()}catch(e){console.error('[Fazenda2E render '+name+']',e)}}
function renderAll(){
  safeRenderBlock33('1',()=>{renderOperation();});
  safeRenderBlock33('2',()=>{renderMetrics();});
  safeRenderBlock33('3',()=>{renderToday();});
  safeRenderBlock33('4',()=>{renderHealth();});
  safeRenderBlock33('5',()=>{renderAuto4();});
  safeRenderBlock33('6',()=>{renderAutomation();});
  safeRenderBlock33('7',()=>{renderHistory();});
  safeRenderBlock33('8',()=>{renderAutonomy();});
  safeRenderBlock33('9',()=>{renderTelegram();});
  safeRenderBlock33('10',()=>{renderAutonomyV3();});
  safeRenderBlock33('11',()=>{renderAutonomy31();renderAutonomy33();renderIntelligence42();});
  safeRenderBlock33('12',()=>{renderAutonomy32();});
  safeRenderBlock33('13',()=>{renderSystem();});
  safeRenderBlock33('14',()=>{renderConnectivityBanner();});
  safeRenderBlock33('15',()=>{renderSimulator42();renderHistory3();renderProfessionalAlerts();});
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
  if(name==='history'||name==='system'){loadDashboard(false,true);}
  if(name==='system'){syncTelegramDirect();loadBackups42();}
  if(name==='history'){const h=app.dashboard?.history3;if(h&&$('historyDate')&&!$('historyDate').value)$('historyDate').value=h.selected_date||h.today_date||'';renderHistory3();}
}
qsa('[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
async function refreshHistoryDirectV12(){
  if(!hasAuth())return;
  try{
    const d=await api('/api/viveiro/dashboard?fresh=1');
    const previous=app.dashboard||{};
    if((!d.autonomy||!Object.keys(d.autonomy||{}).length)&&(app.lastAutonomy||previous.autonomy))d.autonomy=app.lastAutonomy||previous.autonomy;
    if(d.autonomy&&(d.autonomy.checked_at||d.autonomy.version||Number.isFinite(Number(d.autonomy.score))))app.lastAutonomy=d.autonomy;
    d.notifications=d.notifications||previous.notifications||{};
    if(app.telegramDirect)d.notifications.telegram=app.telegramDirect;
    app.dashboard=d;if(d.seconds)acceptSeconds(d.seconds);if(app.seconds)app.dashboard.seconds=app.seconds;app.lastDashboardAt=Date.now();
    renderHistory();renderAutonomy33();
    const el=$('historyLoadState');if(el)el.remove();
  }catch(e){
    const view=$('view-history');if(view&&!$('historyLoadState')){const n=document.createElement('div');n.id='historyLoadState';n.className='panelNote emptyState';n.textContent='Falha ao carregar o histórico. Toque em Histórico novamente para tentar.';view.prepend(n);}
  }
}
function refreshCriticalViewV12(name=app.activeView){
  if(name!=='history'&&name!=='system')return;
  if(name==='history'){refreshHistoryDirectV12().catch?.(()=>null);return;}
  loadDashboard(false,true).catch?.(()=>null);
  if(name==='system')syncTelegramDirect().catch?.(()=>null);
}


async function loadDashboard(showToast=false,force=false){
  if(!hasAuth())return;
  if(app.loading){if(force)setTimeout(()=>loadDashboard(showToast,true),350);return;}
  app.loading=true;
  try{
    const d=await api('/api/viveiro/dashboard'+(force?'?fresh=1':''));
    const previous=app.dashboard||{};
    if((!d.autonomy||!Object.keys(d.autonomy||{}).length)&&(app.lastAutonomy||previous.autonomy))d.autonomy=app.lastAutonomy||previous.autonomy;
    if(d.autonomy&&(d.autonomy.checked_at||d.autonomy.version||Number.isFinite(Number(d.autonomy.score))))app.lastAutonomy=d.autonomy;
    d.notifications=d.notifications||previous.notifications||{};
    if(app.telegramDirect)d.notifications.telegram=app.telegramDirect;
    app.dashboard=d;if(d.seconds)acceptSeconds(d.seconds);if(app.seconds)app.dashboard.seconds=app.seconds;app.lastDashboardAt=Date.now();
    renderAll();
    if(showToast)toast('Dados atualizados');
  }catch(e){
    markServerFailure();
    if(showToast)toast(e.message||'Falha ao atualizar');
  }finally{app.loading=false}
}
async function loadStatus(){
  if(!hasAuth())return;
  try{app.status=await api('/api/status');app.lastStatusAt=Date.now();markServerSuccess();renderOperation();renderHealth();renderSystem()}catch(e){app.status={online:false,error:String(e.message||e)};renderAll()}
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
      app.liveConnected=true;app.lastLiveAt=Date.now();markServerSuccess();renderAll();renderConnectivityBanner();wait=1000;scheduleDashboardPoll();scheduleStatusPoll();
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
            acceptSeconds(event.payload.state);
            if(app.dashboard)app.dashboard.seconds=app.seconds;
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
            acceptSeconds({...seconds(),server_read_at:Date.now()+num(app.serverClockOffset),
              last_confirmation_at:num(p.confirmed_at)||seconds().last_confirmation_at,
              last_confirmation_latency_ms:num(p.latency_ms),
              last_confirmation_source:p.source||seconds().last_confirmation_source,
              device_relay:p.command==='on'?true:p.command==='off'?false:seconds().device_relay
            });
            if(app.dashboard)app.dashboard.seconds=app.seconds;
            renderOperation();renderSystem();
          }else if(event.type==='watchdog'){
            acceptSeconds({...seconds(),server_read_at:Date.now()+num(app.serverClockOffset),watchdog:{status:event.payload?.status||'warning',checked_at:event.payload?.at||Date.now(),reason:event.payload?.reason||'',error:event.payload?.error||null}});
            if(app.dashboard)app.dashboard.seconds=app.seconds;
            renderHealth();renderSystem();
          }else if(event.type==='autonomy'){
            const incoming=event.payload||null;
            if(incoming&&(incoming.checked_at||incoming.version||Number.isFinite(Number(incoming.score)))){app.lastAutonomy=incoming;if(app.dashboard)app.dashboard.autonomy=incoming;}
            renderAutonomy();renderAutonomyV3();renderAutonomy31();renderAutonomy32();
          }else if(event.type==='server'){
            if(app.dashboard)app.dashboard.server={online:true,at:event.at||Date.now()};
            renderHealth();renderSystem();
          }else if(event.type==='event'){
            clearTimeout(connectLive.refresh);
            connectLive.refresh=setTimeout(()=>loadDashboard(false),250);
          }
        }
      }
      throw new Error('Stream encerrado');
    }catch(e){
      if(ctl.signal.aborted)break;
      app.liveConnected=false;renderOperation();renderHealth();renderSystem();renderConnectivityBanner();scheduleDashboardPoll();scheduleStatusPoll();
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
      const remain=Math.max(0,(at-syncedNow())/1000);
      el.textContent=remain<=180?fmtSeconds(remain):fmtClock(at);
    }
    $('deviceAge').textContent=fmtAge(num(seconds().last_confirmation_at||seconds().state_updated_at||app.lastStatusAt));
    $('weatherAge').textContent=fmtAge(num(weather().checked_at||app.dashboard?.weather?.state?.lastWeatherAt));
    $('liveAge').textContent=app.liveConnected?fmtAge(app.lastLiveAt):'reconectando';
  },500);
}

async function auditChange42(action,detail=''){
  if(!hasAuth())return;
  try{await api('/api/irrigation/history',{method:'POST',body:JSON.stringify({type:'viveiro_change_audit',source:'viveiro_app_4_2',status:'recorded',mode:String(action||''),detail:String(detail||action||'alteração').slice(0,500)})})}catch(e){}
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
    await auditChange42('programacao','Ciclo '+on+'/'+off+' s • janela '+timeValue(start)+'–'+timeValue(end)+' • dias '+mask);
    toast('Programação salva e armada.');app.automationDirty=false;
    await loadDashboard();
  }catch(e){toast(e.message||'Falha ao salvar programação')}finally{$('saveScheduleBtn').disabled=false}
}
async function disableSchedule(){
  if(!seconds().enabled)return;
  if(!confirm('Desarmar a irrigação automática do Viveiro?'))return;
  try{await api('/api/viveiro/seconds',{method:'POST',body:JSON.stringify({action:'disable'})});await auditChange42('programacao_desarmada','Irrigação automática desarmada pelo aplicativo.');toast('Programação desarmada.');await loadDashboard()}catch(e){toast(e.message)}
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
      trend_minutes:num(cc.trend_minutes,30),
      evaluation_minutes:num($('evaluationMinutes').value,5),
      max_adjust_percent:num($('maxAdjustPercent').value,35),
      min_change_seconds:num(cc.min_change_seconds,3),
      min_change_off_seconds:num(cc.min_change_off_seconds,6),
      cooldown_minutes:num(cc.cooldown_minutes,30),
      normal_confirmations:num(cc.normal_confirmations,2),
      post_rain_hold_minutes:num(cc.post_rain_hold_minutes,30)
    })});
    await auditChange42('automatico_4_config','Parâmetros consultivos/automáticos atualizados pelo aplicativo.');toast('Automático 4.0 atualizado.');app.automationDirty=false;await loadDashboard();
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
    await auditChange42('protecao_chuva','Proteção por chuva '+($('rainEnabled').checked?'ativada':'desativada')+' • retomada '+num($('resumeDelay').value,30)+' min.');toast('Proteção por chuva atualizada.');app.automationDirty=false;await loadDashboard();
  }catch(e){toast(e.message)}
}
async function emergencyStop(){
  if(!confirm('PARAR A IRRIGAÇÃO AGORA?\n\nA saída será desligada e a parada de emergência ficará travada até liberação manual.'))return;
  try{await api('/api/viveiro/seconds',{method:'POST',body:JSON.stringify({action:'emergency_stop',reason:'Parada de emergência pelo aplicativo'})});await auditChange42('emergencia','Parada de emergência acionada pelo aplicativo.');toast('Parada de emergência acionada.');await Promise.all([loadDashboard(),loadStatus()])}catch(e){toast(e.message)}
}
async function clearEmergency(){
  if(!confirm('Liberar a parada de emergência? A irrigação continuará parada até ser rearmada.'))return;
  try{await api('/api/viveiro/seconds',{method:'POST',body:JSON.stringify({action:'clear_emergency'})});await auditChange42('emergencia_liberada','Parada de emergência liberada pelo aplicativo.');toast('Emergência liberada.');await loadDashboard()}catch(e){toast(e.message)}
}
async function setMaintenance(minutes){
  try{await api('/api/viveiro/dashboard',{method:'POST',body:JSON.stringify({action:'maintenance',minutes,reason:minutes?'Manutenção pelo aplicativo':'Fim da manutenção'})});await auditChange42('manutencao',minutes?'Manutenção ativada por '+minutes+' min.':'Manutenção encerrada.');toast(minutes?'Manutenção ativada.':'Manutenção encerrada.');await loadDashboard()}catch(e){toast(e.message)}
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
qsa('#historyPeriod button').forEach(b=>b.addEventListener('click',()=>applyHistoryPeriod(b.dataset.period)));
qsa('#historyEventFilter button').forEach(b=>b.addEventListener('click',()=>{app.historyEventFilter=b.dataset.filter||'all';renderHistory()}));
$('simOn')?.addEventListener('input',renderSimulator42);$('simOff')?.addEventListener('input',renderSimulator42);
$('historyDate')?.addEventListener('change',e=>loadHistory3Day(e.target.value));$('historyPrevDay')?.addEventListener('click',()=>shiftHistory3Day(-1));$('historyNextDay')?.addEventListener('click',()=>shiftHistory3Day(1));$('exportDayBtn')?.addEventListener('click',exportHistory3Day);
$('runDiagnosticsBtn')?.addEventListener('click',runGuidedDiagnostics42);$('createBackupBtn')?.addEventListener('click',createBackup42);$('refreshBackupsBtn')?.addEventListener('click',loadBackups42);$('toggleChangelogBtn')?.addEventListener('click',()=>{$('changelog42').hidden=!$('changelog42').hidden});
$('refreshBtn').addEventListener('click',()=>Promise.all([loadDashboard(true),loadStatus()]));

async function refreshApplication(){
  const btn=$('refreshAppBtn'),badge=$('appUpdateBadge'),detail=$('appUpdateDetail');
  if(btn?.disabled)return;
  if(!navigator.onLine){toast('Sem internet. Não foi possível atualizar o aplicativo.');return;}
  if(btn)btn.disabled=true;if(badge)setBadge(badge,'ATUALIZANDO','');if(detail)detail.textContent='Verificando servidor e removendo o cache antigo…';
  try{
    await auditChange42('atualizacao_aplicativo','Solicitada atualização manual do aplicativo para a versão mais recente.');
    const stamp=Date.now();
    const health=await fetch('/health?app_refresh='+stamp,{cache:'no-store',credentials:'same-origin'});
    if(!health.ok)throw new Error('Servidor indisponível para atualização.');
    if('caches' in window){
      const names=await caches.keys();
      await Promise.all(names.filter(name=>String(name).startsWith('fazenda2e-')).map(name=>caches.delete(name)));
    }
    if('serviceWorker' in navigator){
      const regs=await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.filter(reg=>String(reg.scope||'').includes('/irrigacao/')).map(reg=>reg.update().catch(()=>null)));
    }
    const latest=await fetch('/irrigacao/?app_refresh='+stamp,{cache:'no-store',credentials:'same-origin'});
    if(!latest.ok)throw new Error('Não foi possível carregar a versão nova.');
    sessionStorage.setItem('fazenda2eAppRefreshDone',String(stamp));
    location.replace('/irrigacao/?app_refresh='+stamp);
  }catch(error){
    if(btn)btn.disabled=false;if(badge)setBadge(badge,'TENTAR NOVAMENTE','warn');if(detail)detail.textContent='A atualização não foi concluída. O aplicativo atual foi mantido.';
    toast(error?.message||'Falha ao atualizar o aplicativo.');
  }
}
$('refreshAppBtn')?.addEventListener('click',refreshApplication);

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

window.addEventListener('online',()=>{if(hasAuth()){loadDashboard();loadStatus();scheduleDashboardPoll();scheduleStatusPoll()}else renderConnectivityBanner();});
window.addEventListener('offline',()=>{if(!app.lastServerSuccessAt||Date.now()-app.lastServerSuccessAt>20000)markServerFailure();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&hasAuth()){loadDashboard();loadStatus();scheduleDashboardPoll();scheduleStatusPoll()}});

function organizeConilonSystem(){
  const body=document.querySelector('#view-system .systemAdvancedBody');
  if(!body)return;
  for(const id of ['serverDiagnosticsPanel','smartLifeReconnectPanel']){const el=$(id);if(el)body.appendChild(el);}
}

async function bootstrap(){
  initDays();
  organizeConilonSystem();
  $('apiUrl').value=store.settings.apiUrl||DEFAULT_API;
  $('controlToken').value=store.settings.token||'';
  $('setupOverlay').hidden=true;
  renderAll();startClock();
  if(sessionStorage.getItem('fazenda2eAppRefreshDone')){
    sessionStorage.removeItem('fazenda2eAppRefreshDone');
    if($('appUpdateBadge'))setBadge($('appUpdateBadge'),'ATUALIZADO','');
    if($('appUpdateDetail'))$('appUpdateDetail').textContent='Aplicativo atualizado. Você já está usando os arquivos mais recentes do servidor.';
  }
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

// FAZENDA2E_CRITICAL_VIEW_TIMER_V12
setInterval(()=>{if(document.visibilityState==='visible')refreshCriticalViewV12();},15000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(()=>refreshCriticalViewV12(),250);});
if('serviceWorker' in navigator)navigator.serviceWorker.register('/irrigacao/sw.js',{scope:'/irrigacao/'}).catch(()=>null);

function forecastClock(v){if(!v)return'—';const d=new Date(v);return d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});}
function forecastDay(v){if(!v)return'—';const d=new Date(v+'T12:00:00');return d.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','');}
function renderClimateForecast(f){
  if(!$('climateForecastPanel')||!f?.ok)return;
  const s=f.summary||{},local=weather()?.metrics||{},model=f.current||{};
  const lt=Number(local.temperature?.value),lh=Number(local.humidity?.value),mt=Number(model.temperature_2m),mh=Number(model.relative_humidity_2m);
  const tDiff=Number.isFinite(lt)&&Number.isFinite(mt)?Math.abs(lt-mt):null,hDiff=Number.isFinite(lh)&&Number.isFinite(mh)?Math.abs(lh-mh):null;
  const agrees=tDiff!=null&&hDiff!=null?(tDiff<=2.5&&hDiff<=12):null;
  setBadge($('forecastBadge'),f.stale?'DADOS SALVOS':agrees===true?'CONFIÁVEL':agrees===false?'DIVERGÊNCIA':'PREVISÃO',f.stale||agrees===false?'warn':'');
  $('forecastProvider').textContent=f.provider||'Open-Meteo';$('forecastAgreement').textContent=agrees==null?'Aguardando':agrees?'Estação e modelo próximos':'Modelo difere da estação';
  const nr=s.next_rain;$('forecastNextRain').textContent=nr?forecastClock(nr.time)+' • '+Math.round(num(nr.precipitation_probability))+'%':'Sem chuva forte';
  $('forecastRain24').textContent=Math.round(num(s.max_rain_probability_24h))+'%';$('forecastVpd24').textContent=num(s.max_vpd_24h).toFixed(2)+' kPa';$('forecastEt024').textContent=num(s.et0_24h).toFixed(1)+' mm';
  $('forecastUpdated').textContent=f.generated_at?'atualizada há '+fmtAge(f.generated_at):'—';
  const hourly=(f.hourly||[]).filter((_,i)=>i%2===0).slice(0,8);
  $('forecastHourly').innerHTML=hourly.map(x=>'<div class="forecastHour"><b>'+esc(forecastClock(x.time))+'</b><strong>'+esc(Number(x.temperature_2m).toFixed(0)+'°')+'</strong><span>💧 '+esc(Math.round(num(x.relative_humidity_2m))+'%')+'</span><span>🌧 '+esc(Math.round(num(x.precipitation_probability))+'%')+'</span><span>VPD '+esc(num(x.vapour_pressure_deficit).toFixed(1))+'</span><span>'+esc(x.risk?.label||'')+'</span></div>').join('')||'<span class="panelNote">Previsão horária indisponível.</span>';
  $('forecastDaily').innerHTML=(f.daily||[]).slice(0,5).map(x=>'<div class="forecastDay"><b>'+esc(forecastDay(x.time))+'</b><strong>'+esc(Math.round(num(x.temperature_min))+'–'+Math.round(num(x.temperature_max))+'°')+'</strong><span>🌧 '+esc(Math.round(num(x.precipitation_probability_max))+'%')+'</span><span>'+esc(num(x.precipitation_sum).toFixed(1)+' mm')+'</span></div>').join('')||'<span class="panelNote">Previsão diária indisponível.</span>';
  $('forecastNote').textContent=(f.model_note||'')+(f.stale?' • A fonte externa está temporariamente indisponível; usando a última previsão salva.':'');
}
async function refreshClimateForecast(){if(!hasAuth()||!$('climateForecastPanel')||document.visibilityState!=='visible')return;try{renderClimateForecast(await api('/api/weather/forecast'))}catch(error){setBadge($('forecastBadge'),'INDISPONÍVEL','warn');$('forecastNote').textContent='Previsão externa indisponível agora. A Weather2-2 continua sendo usada normalmente no controle da irrigação.';}}
function renderServerDiagnostics(d){const badge=$('diagOverallBadge');if(!badge)return;const alerts=Array.isArray(d?.alerts)?d.alerts:[];const critical=alerts.some(x=>x?.level==='critical');setBadge(badge,critical?'CRÍTICO':alerts.length?'ATENÇÃO':'SAUDÁVEL',critical?'bad':alerts.length?'warn':'');const total=num(d?.server?.memory?.total_mb),free=num(d?.server?.memory?.free_mb);$('diagServerRam').textContent=total?Math.round(free)+' MB livres / '+Math.round(total)+' MB':'—';$('diagProcessRam').textContent=d?.checks?.maintenance?.ok?Math.round(num(d.checks.maintenance.value?.memory?.rss_mb))+' MB RAM':'Indisponível';const hist=d?.checks?.local_history;$('diagHistory').textContent=hist?.ok?num(hist.value?.rows).toLocaleString('pt-BR')+' registros':'Indisponível';const syncAt=num(hist?.value?.sync?.last_success_at);$('diagSync').textContent=syncAt?'Atualizado há '+fmtAge(syncAt):'Aguardando';const maint=d?.checks?.maintenance,backups=maint?.value?.backups||{},backupAt=num(backups?.last?.at);$('diagBackup').textContent=maint?.ok?String(num(backups.count))+' arquivos'+(backupAt?' • há '+fmtAge(backupAt):''):'Indisponível';const fb=d?.checks?.firebase;$('diagFirebase').textContent=fb?.ok?'Online • '+Math.round(num(fb.ms))+' ms':'Indisponível';$('diagCheckedAt').textContent=d?.checked_at?localDateTime(d.checked_at):'—';$('diagAlerts').textContent=alerts.length?alerts.map(x=>x?.message).filter(Boolean).join(' • '):'Servidor Oracle, histórico, sincronização, backups e Firebase funcionando normalmente.';}
async function refreshServerDiagnostics(){if(!hasAuth()||!$('serverDiagnosticsPanel'))return;try{renderServerDiagnostics(await api('/api/irrigation/diagnostics'))}catch(error){const b=$('diagOverallBadge');if(b)setBadge(b,'INDISPONÍVEL','bad');if($('diagAlerts'))$('diagAlerts').textContent='Não foi possível atualizar o diagnóstico: '+(error?.message||'erro de comunicação')}}
qsa('[data-view="system"]').forEach(el=>el.addEventListener('click',()=>setTimeout(refreshServerDiagnostics,200)));
setTimeout(refreshClimateForecast,12000);setInterval(refreshClimateForecast,30*60000);setTimeout(refreshServerDiagnostics,1500);setInterval(refreshServerDiagnostics,30000);
async function startSmartLifeReconnect(){
  const btn=$('smartLifeReconnectBtn'),area=$('smartLifeQrArea'),img=$('smartLifeQrImage'),text=$('smartLifeReconnectText'),badge=$('smartLifeReconnectBadge');
  if(!btn||!area||!img)return;
  btn.disabled=true;btn.textContent='Gerando QR Code...';
  try{
    const result=await api('/api/smartlife/reauth',{method:'POST',body:JSON.stringify({action:'start'})});
    const payload=result?.result||result?.data||result||{};
    const token=payload?.token||payload?.qr_token||payload?.qrcode_token;
    const qrImage=payload?.qr_image||payload?.qrImage||payload?.image;
    if(!token||!qrImage)throw new Error(result?.error||payload?.error||'Smart Life não retornou o QR Code completo.');
    app.smartLifeReauthToken=String(token);
    img.src=String(qrImage);area.hidden=false;btn.hidden=true;
    if(text)text.textContent='QR Code gerado. Autorize no Smart Life e depois toque em “Já autorizei”.';
    if(badge)setBadge(badge,'AGUARDANDO','warn');
  }catch(error){
    toast(error?.message||'Falha ao gerar QR Code do Smart Life.');
    if(text)text.textContent=error?.message||'Falha ao iniciar a reconexão.';
    btn.disabled=false;btn.textContent='Tentar novamente';
  }
}

async function finishSmartLifeReconnect(){
  const token=String(app.smartLifeReauthToken||'');
  const confirmBtn=$('smartLifeConfirmBtn'),text=$('smartLifeReconnectText'),badge=$('smartLifeReconnectBadge');
  if(!token){toast('Gere um novo QR Code primeiro.');return;}
  if(confirmBtn){confirmBtn.disabled=true;confirmBtn.textContent='Confirmando...';}
  try{
    const result=await api('/api/smartlife/reauth',{method:'POST',body:JSON.stringify({action:'finish',token})});
    if(!result?.authorized){
      if(text)text.textContent=result?.error||'A autorização ainda não foi confirmada. Tente novamente em alguns segundos.';
      if(confirmBtn){confirmBtn.disabled=false;confirmBtn.textContent='Já autorizei';}
      return;
    }
    app.smartLifeReauthToken='';
    const area=$('smartLifeQrArea'),startBtn=$('smartLifeReconnectBtn');
    if(area)area.hidden=true;
    if(startBtn){startBtn.hidden=false;startBtn.disabled=false;startBtn.textContent='Reconectar Smart Life';}
    if(text)text.textContent='Smart Life reconectada. Atualizando EKAZA e Weather2-2...';
    if(badge)setBadge(badge,'CONECTADO','');
    await auditChange42('smartlife_reconectada','Smart Life reconectada e autorização confirmada.');
    toast('Smart Life reconectada com sucesso.');
    setTimeout(()=>{refreshAll?.();refreshServerDiagnostics?.();},1200);
  }catch(error){
    if(text)text.textContent=error?.message||'Falha ao confirmar a autorização.';
    toast(error?.message||'Falha ao reconectar Smart Life.');
    if(confirmBtn){confirmBtn.disabled=false;confirmBtn.textContent='Já autorizei';}
  }
}

function cancelSmartLifeReconnect(){
  app.smartLifeReauthToken='';
  const area=$('smartLifeQrArea'),btn=$('smartLifeReconnectBtn');
  if(area)area.hidden=true;
  if(btn){btn.hidden=false;btn.disabled=false;btn.textContent='Reconectar Smart Life';}
  renderSystem?.();
}

document.addEventListener('click',event=>{
  const id=event.target?.id;
  if(id==='smartLifeReconnectBtn')startSmartLifeReconnect();
  else if(id==='smartLifeConfirmBtn')finishSmartLifeReconnect();
  else if(id==='smartLifeCancelBtn')cancelSmartLifeReconnect();
});


// FAZENDA2E_NOTIFICATIONS_V1
function b64ToUint8(value){const pad='='.repeat((4-value.length%4)%4),b64=(value+pad).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(b64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}
async function notificationState(){
  const supported='serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window;
  let permission=supported?Notification.permission:'unsupported',sub=null,server=null;
  if(supported){try{const reg=await navigator.serviceWorker.ready;sub=await reg.pushManager.getSubscription()}catch{}}
  try{server=await api('/api/irrigation/push')}catch{}
  const active=Boolean(sub&&permission==='granted');
  const b=$('notificationBadge'),s=$('notificationStatus'),p=$('notifyPush');
  if(b){setBadge(b,active?'ATIVAS':permission==='denied'?'BLOQUEADAS':'DESATIVADAS',active?'':permission==='denied'?'bad':'warn')}
  if(p)p.checked=active;
  if(s)s.textContent=!supported?'Este navegador não oferece notificações push.':permission==='denied'?'Permissão bloqueada no sistema. Libere nas configurações do navegador.':active?'Este aparelho está inscrito. '+(server?.subscriptions||1)+' aparelho(s) recebendo alertas.':'Toque em Ativar notificações para autorizar este aparelho.';
  return{supported,permission,sub,server,active};
}
async function saveNotificationPrefs(){
  const current=await api('/api/irrigation/config').catch(()=>({config:{}}));
  const alerts={...(current.config?.alerts||{}),priorities:{critical:$('notifyCritical')?.checked!==false,warning:$('notifyWarning')?.checked!==false,info:$('notifyInfo')?.checked===true},channels:{...(current.config?.alerts?.channels||{}),push:true}};
  await api('/api/irrigation/config',{method:'PATCH',body:JSON.stringify({alerts})});
}
async function enableNotifications(){
  try{
    const state=await notificationState();if(!state.supported)return toast('Este navegador não suporta notificações push.');
    if(Notification.permission==='denied')return toast('Notificações estão bloqueadas nas configurações do aparelho.');
    const permission=await Notification.requestPermission();if(permission!=='granted')return notificationState();
    const reg=await navigator.serviceWorker.ready;
    const info=await api('/api/irrigation/push');if(!info.publicKey)throw new Error('Chave de notificações indisponível.');
    let sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToUint8(info.publicKey)});
    await api('/api/irrigation/push',{method:'POST',body:JSON.stringify({action:'subscribe',subscription:sub.toJSON(),platform:navigator.platform||''})});
    await saveNotificationPrefs();
    toast('Notificações ativadas neste aparelho.');await notificationState();
  }catch(e){toast(e.message||'Falha ao ativar notificações')}
}
async function disableNotifications(){
  try{const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();if(sub){await api('/api/irrigation/push',{method:'POST',body:JSON.stringify({action:'unsubscribe',endpoint:sub.endpoint})}).catch(()=>null);await sub.unsubscribe()}toast('Notificações desativadas neste aparelho.');await notificationState()}catch(e){toast(e.message||'Falha ao desativar notificações')}
}
async function testNotification(){try{await api('/api/irrigation/push',{method:'POST',body:JSON.stringify({action:'test'})});toast('Alerta de teste enviado.')}catch(e){toast(e.message||'Falha ao enviar teste')}}
setTimeout(()=>{
  $('notifyEnableBtn')?.addEventListener('click',enableNotifications);$('notifyTestBtn')?.addEventListener('click',testNotification);$('notifyPush')?.addEventListener('change',e=>e.target.checked?enableNotifications():disableNotifications());
  ['notifyCritical','notifyWarning','notifyInfo'].forEach(id=>$(id)?.addEventListener('change',()=>saveNotificationPrefs().then(()=>toast('Preferências salvas.')).catch(e=>toast(e.message))));
  notificationState().catch(()=>null);
  api('/api/irrigation/config').then(r=>{const p=r.config?.alerts?.priorities||{};if($('notifyCritical'))$('notifyCritical').checked=p.critical!==false;if($('notifyWarning'))$('notifyWarning').checked=p.warning!==false;if($('notifyInfo'))$('notifyInfo').checked=p.info===true}).catch(()=>null);
},900);

})();
/* FAZENDA2E_EKAZA_SELECTOR_V1 */
(()=>{
  const q=id=>document.getElementById(id);
  async function ekazaRequest(init){const r=await fetch('/api/viveiro/device',{credentials:'same-origin',headers:{'Content-Type':'application/json'},...(init||{})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||('Erro '+r.status));return d}
  function renderEkaza(data){const current=q('ekazaCurrent'),list=q('ekazaDeviceList'),badge=q('ekazaSelectorBadge');if(!current||!list)return;const b=data.binding||{};current.innerHTML='<small>EKAZA ATUAL</small><strong>'+String(b.deviceName||'Seleção automática')+'</strong><span>'+(b.deviceId?'Selecionado manualmente':'O servidor escolhe automaticamente')+'</span>';badge.textContent=b.deviceId?'FIXADO':'AUTO';list.innerHTML='';(data.devices||[]).forEach(dev=>{const btn=document.createElement('button');btn.type='button';btn.className='ekazaDeviceRow'+(b.deviceId===dev.deviceId?' selected':'');btn.disabled=!dev.online;btn.innerHTML='<span><strong>'+String(dev.name||'Sem nome')+'</strong><small>'+(dev.online?'Online':'Offline')+(dev.category?' • '+dev.category:'')+'</small></span><b>'+(b.deviceId===dev.deviceId?'ATUAL':'USAR')+'</b>';btn.addEventListener('click',async()=>{if(!confirm('Definir '+String(dev.name||'este dispositivo')+' como EKAZA do viveiro? Nenhum comando de ligar será enviado.'))return;btn.disabled=true;try{const r=await ekazaRequest({method:'POST',body:JSON.stringify({action:'select',deviceId:dev.deviceId})});toast(r.message||'EKAZA definido com sucesso.');await loadEkaza()}catch(e){toast(e.message||'Falha ao trocar EKAZA.')}finally{btn.disabled=false}});list.appendChild(btn)});if(!(data.devices||[]).length)list.innerHTML='<p class="panelNote">Nenhum relé compatível encontrado.</p>'}
  async function loadEkaza(){const btn=q('refreshEkazaDevicesBtn');if(btn)btn.disabled=true;try{renderEkaza(await ekazaRequest())}catch(e){toast(e.message||'Falha ao buscar EKAZA.')}finally{if(btn)btn.disabled=false}}
  q('refreshEkazaDevicesBtn')?.addEventListener('click',loadEkaza);document.querySelector('[data-view="system"]')?.addEventListener('click',()=>setTimeout(loadEkaza,100));setTimeout(()=>{if(!q('view-system')?.classList.contains('active'))return;loadEkaza()},1200);
})();

// FAZENDA2E_UI_CONSISTENCY_V7

// FAZENDA2E_TELEGRAM_TOKEN_HANDLER_V1
if($('telegramSaveTokenBtn'))$('telegramSaveTokenBtn').addEventListener('click',async()=>{
  const input=$('telegramTokenInput');
  const token=String(input?.value||'').trim();
  if(!token){toast('Cole o token do BotFather.');return;}
  const btn=$('telegramSaveTokenBtn'); btn.disabled=true; btn.textContent='Validando…';
  try{
    await api('/api/irrigation/telegram',{method:'POST',body:JSON.stringify({action:'set_token',token})});
    if(input)input.value='';
    toast('Telegram ativado. Agora vincule seu chat.');
    await loadDashboard(false);
  }catch(e){toast(e.message||'Falha ao ativar Telegram.');}
  finally{btn.disabled=false;btn.textContent='Ativar Telegram';}
});
