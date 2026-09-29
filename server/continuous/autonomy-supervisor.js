import { smartLifeListDevices } from '../api/_smartlife.js';
import { fetchWeatherSnapshot } from '../api/weather/_weather.js';
import { readRecentHistory, storeGet, storeSet, storePush } from '../api/irrigation/_store.js';
import { notifyIrrigation } from '../api/irrigation/_notify.js';
import { telegramAssistantConfig } from '../api/irrigation/_telegram.js';
import { localHistoryStatus } from '../local/history-store.js';
import { getSecondsManagerState } from './seconds-manager.js';
import { publishLive } from './live-bus.js';
import { buildAutonomyBaseline, detectAutonomyAnomalies, learningSummary } from './autonomy-learning.js';
import { buildHourlyProfile, detectHourlyAnomaly, predictiveMaintenance, buildDailyPlan, componentReliability, predictiveRisk } from './autonomy-v3.js';
import { loadForecast } from '../api/weather/forecast.js';
import { buildDecisionJournal, learnFromDecisionResults, buildLearningDiagnostics, buildLearning46, buildLearning47, buildLearning48, buildLearning50, buildLearning51,buildLearning52 } from './decision-journal.js';
import { runRecoverySelfTest } from './recovery-selftest.js';
import { localMaintenanceStatus } from '../local/maintenance.js';
import { validateLatestConfigBackup } from '../api/irrigation/_backup.js';
import { buildIntelligence42 } from './intelligence-4.2.js';

const ROOT='IrrigacaoFazenda2E/autonomy';
const DEFAULT_INTERVAL_MS=30000;
let timer=null;
let busy=false;
let latest=null;
let previousIssueKeys=new Set();
const activeIssueAlerts=new Map();
let incidentsHydrated=false;
async function hydrateActiveIncidents(){if(incidentsHydrated)return;const raw=await storeGet(ROOT+'/active_incidents').catch(()=>null);for(const [key,row] of Object.entries(raw||{}))if(row&&row.status!=='resolved')activeIssueAlerts.set(key,row);previousIssueKeys=new Set(activeIssueAlerts.keys());incidentsHydrated=true;}
async function persistActiveIncidents(){try{await storeSet(ROOT+'/active_incidents',Object.fromEntries(activeIssueAlerts));return true;}catch{return false;}}
const resolvedHistoryKey=(key,openedAt)=>String(key||'condition').replace(/[^A-Za-z0-9_-]/g,'_')+'-'+String(Number(openedAt||0));
async function persistResolvedIncident(row){try{await storeSet(ROOT+'/alert_history/'+resolvedHistoryKey(row.key,row.opened_at),row);return true;}catch{return false;}}
const summarySent=new Set();

const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const age=(ts,now=Date.now())=>ts>0?Math.max(0,now-Number(ts)):Infinity;
export function evaluateAutonomy(input={},now=Date.now()){
  const seconds=input.seconds||{};
  const weather=input.weather||{};
  const devices=Array.isArray(input.devices)?input.devices:[];
  const history=input.history||{};
  const firebaseOk=input.firebase_ok!==false;
  const issues=[];

  const controllerOk=String(seconds.automatic_controller||'')==='automatic4'&&num(seconds.automatic_version)===4;
  if(!controllerOk)issues.push({key:'controller',level:'critical',message:'Automático 4.0 não está confirmado como controlador ativo.'});

  const weatherFresh=weather?.linked!==false&&weather?.device?.online!==false&&age(weather?.checked_at,now)<=120000;
  if(!weatherFresh)issues.push({key:'weather',level:'critical',message:'Weather2-2 sem leitura confiável recente.'});

  const irrigationDevice=devices.find(d=>/viveiro 2e/i.test(String(d?.name||'')))||devices.find(d=>/viveiro/i.test(String(d?.name||''))&&d?.online!==false);
  if(!irrigationDevice||irrigationDevice.online===false)issues.push({key:'ekaza',level:'critical',message:'EKAZA do viveiro não está confirmado online.'});
  if(!firebaseOk)issues.push({key:'firebase',level:'warning',message:'Firebase indisponível; controle local continua protegido.'});
  const historySync=num(history?.sync?.last_success_at);
  if(history?.rows&&historySync&&age(historySync,now)>180000)issues.push({key:'history-sync',level:'warning',message:'Sincronização do histórico local está atrasada.'});

  const clockError=num(seconds?.scheduler_precision?.avg_abs_error_ms);
  if(clockError>1500)issues.push({key:'scheduler',level:'warning',message:`Relógio do ciclo com atraso médio de ${Math.round(clockError)} ms.`});

  const phase=String(seconds.phase||'idle');
  const protectedNow=Boolean(seconds.paused_by_weather||phase==='weather_blocked'||phase==='waiting_after_rain');
  let score=100;
  for(const item of issues)score-=item.level==='critical'?22:8;
  score=Math.max(0,Math.min(100,score));
  const critical=issues.some(x=>x.level==='critical');
  const status=critical?'attention':issues.length?'degraded':protectedNow?'protected':'healthy';
  return{status,score,issues,controller_ok:controllerOk,weather_fresh:weatherFresh,protected:protectedNow};
}

async function readContext(){
  const [seconds,weather,devices,history,firebaseProbe,recentHistory,maintenanceStatus,configBackup]=await Promise.all([
    getSecondsManagerState().catch(()=>({})),
    fetchWeatherSnapshot({maxAgeMs:4000}).catch(error=>({ok:false,linked:false,error:error?.message||String(error)})),
    smartLifeListDevices({maxAgeMs:4000}).catch(()=>[]),
    localHistoryStatus().catch(()=>({rows:0})),
    storeGet('IrrigacaoFazenda2E/alertMonitor').then(()=>true).catch(()=>false),
    readRecentHistory({sinceMs:Date.now()-14*86400000,limit:1000}).catch(()=>[]),
    localMaintenanceStatus().catch(()=>({ok:false,backups:{validation:{ok:false,restorable:false}}})),
    validateLatestConfigBackup().catch(()=>({ok:false,restorable:false}))
  ]);
  const forecast=await loadForecast().catch(()=>null);
  return{seconds,weather,devices,history,firebase_ok:firebaseProbe,recentHistory,forecast,maintenanceStatus,configBackup};
}
async function safeRecover(context,evaluation){
  const attempts=[];
  if(evaluation.issues.some(x=>x.key==='weather')){
    try{
      const refreshed=await fetchWeatherSnapshot({maxAgeMs:0});
      attempts.push({key:'weather-refresh',ok:Boolean(refreshed?.linked&&refreshed?.device?.online!==false),at:Date.now()});
    }catch(error){attempts.push({key:'weather-refresh',ok:false,error:error?.message||String(error),at:Date.now()});}
  }
  if(evaluation.issues.some(x=>x.key==='ekaza')){
    try{
      const refreshed=await smartLifeListDevices({maxAgeMs:0});
      const ok=refreshed.some(d=>/viveiro 2e/i.test(String(d?.name||''))&&d?.online!==false);
      attempts.push({key:'smartlife-refresh',ok,at:Date.now()});
    }catch(error){attempts.push({key:'smartlife-refresh',ok:false,error:error?.message||String(error),at:Date.now()});}
  }
  if(evaluation.issues.some(x=>x.key==='firebase')){
    try{await storeGet('IrrigacaoFazenda2E/alertMonitor');attempts.push({key:'firebase-retry',ok:true,at:Date.now()});}
    catch(error){attempts.push({key:'firebase-retry',ok:false,error:error?.message||String(error),at:Date.now()});}
  }
  return attempts;
}


function localSummaryClock(now=Date.now()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Porto_Velho',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  const dayMap={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  return{day:`${parts.year}-${parts.month}-${parts.day}`,minutes:Number(parts.hour)*60+Number(parts.minute),weekday:dayMap[parts.weekday]??0};
}
export function summaryScheduleFor(seconds={},now=Date.now()){
  const c=localSummaryClock(now),mask=Math.max(0,Number(seconds.days_mask??127)),selected=Boolean(mask&(1<<c.weekday));
  const start=Math.max(0,Math.min(1439,Number(seconds.start_minutes||0))),end=Math.max(start+1,Math.min(1440,Number(seconds.end_minutes||1440)));
  return{day:c.day,weekday:c.weekday,selected,start_minutes:start,end_minutes:end,morning_minute:Math.max(0,start-30),evening_minute:Math.min(1439,end+15)};
}
export function buildNotificationSummary(kind,context={},autonomy={},now=Date.now()){
  const s=context.seconds||{},w=context.weather||{},f=context.forecast||{},clock=localSummaryClock(now),fs=f?.summary||{};
  const temp=Number(w?.metrics?.temperature?.value),hum=Number(w?.metrics?.humidity?.value),rain=Boolean(w?.metrics?.rainDetected),forecastMm=Number(fs.precipitation_24h_mm||0),forecastProb=Number(fs.max_rain_probability_24h||0);
  const cycle=`${Math.round(Number(s.on_seconds||s.base_on_seconds||30))}s ligado / ${Math.round(Number(s.off_seconds||s.base_off_seconds||120))}s desligado`;
  const status=String(autonomy?.status||'coletando'),score=Number(autonomy?.score||0),intel=autonomy?.intelligence_4_2||{},decision=String(intel.next_action||intel.tendency||intel.recommendation||'Aguardando avaliação');
  const climate=`Clima: ${Number.isFinite(temp)?temp.toFixed(1)+'°C':'—'} • umidade ${Number.isFinite(hum)?Math.round(hum)+'%':'—'} • chuva ${rain?'detectada':'não detectada'}.`;
  const forecast=`Previsão 24h: ${forecastMm.toFixed(1)} mm • prob. máx. ${Math.round(forecastProb)}%.`;
  if(kind==='morning_summary')return{title:'☀️ Fazenda 2E • Resumo antes da irrigação',body:[`Data ${clock.day}.`,climate,forecast,`Ciclo configurado: ${cycle}.`,`Supervisor: ${status} • saúde ${score}/100.`,`Orientação consultiva: ${decision}.`,'Automático 4.0 mantém a autoridade física.'].join('\n'),tag:'morning-summary-'+clock.day,level:'info'};
  const irrigated=Math.round(Number(s.daily_irrigated_seconds||0)),started=Math.round(Number(s.daily_pulses_started||0)),completed=Math.round(Number(s.daily_pulses_completed||0)),interrupted=Math.round(Number(s.daily_pulses_interrupted||0));
  return{title:'🌙 Fazenda 2E • Fechamento do dia',body:[`Data ${clock.day}.`,`Pulsos: ${started} iniciados • ${completed} concluídos • ${interrupted} interrompidos.`,`Tempo irrigado: ${Math.floor(irrigated/60)}min ${irrigated%60}s.`,climate,forecast,`Supervisor: ${status} • saúde ${score}/100.`,`Orientação consultiva: ${decision}.`].join('\n'),tag:'evening-summary-'+clock.day,level:'info'};
}
async function maybeSendScheduledSummaries(context,autonomy,now=Date.now()){
  const pref=telegramAssistantConfig();if(pref.enabled===false)return[];
  const c=localSummaryClock(now),sched=summaryScheduleFor(context.seconds||{},now),sent=[];if(!sched.selected)return sent;
  const persisted=(await storeGet(ROOT+'/notification_summaries/'+c.day).catch(()=>null))||{};
  const schedule=[['morning_summary',sched.morning_minute],['evening_summary',sched.evening_minute]];
  for(const [kind,minute] of schedule){const key=kind+'-'+c.day;if(pref[kind]===false||summarySent.has(key)||persisted[kind]||c.minutes<minute||c.minutes>minute+14)continue;const msg=buildNotificationSummary(kind,context,autonomy,now);const result=await notifyIrrigation({...msg,url:'/f2e/',cooldownMinutes:20,whatsapp:false}).catch(error=>({error:error?.message||String(error)}));if(!result?.error&&!result?.skipped){summarySent.add(key);persisted[kind]={sent_at:now,schedule_minute:minute};await storeSet(ROOT+'/notification_summaries/'+c.day,persisted).catch(()=>null);sent.push({kind,at:now,schedule_minute:minute});}}
  for(const key of summarySent)if(!key.endsWith(c.day))summarySent.delete(key);
  return sent;
}

export function activeAlertSnapshot(now=Date.now()){return[...activeIssueAlerts.values()].map(x=>({key:x.key,level:x.level||'warning',message:x.message||'',opened_at:Number(x.opened_at||now),last_seen_at:Number(x.last_seen_at||now),duration_ms:Math.max(0,now-Number(x.opened_at||now)),status:'active'})).sort((a,b)=>(b.level==='critical'?2:1)-(a.level==='critical'?2:1)||b.opened_at-a.opened_at);}
export function recoveryMessage(issue={},openedAt=Date.now(),closedAt=Date.now()){
  const duration=Math.max(0,closedAt-openedAt),minutes=Math.floor(duration/60000),seconds=Math.floor((duration%60000)/1000);
  const elapsed=minutes>0?`${minutes} min ${seconds} s`:`${seconds} s`;
  return{title:'Condição normalizada',body:`${String(issue.message||issue.key||'Falha')}\nTempo em falha: ${elapsed}.\nNormalizado em ${new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Porto_Velho',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(closedAt))}.`,tag:'autonomy-'+String(issue.key||'condition')+'-recovered',level:'info',duration_ms:duration};
}
async function notifyChanges(evaluation,now=Date.now()){
  await hydrateActiveIncidents();
  const nowKeys=new Set(evaluation.issues.map(x=>x.key));
  for(const issue of evaluation.issues){
    if(!activeIssueAlerts.has(issue.key))activeIssueAlerts.set(issue.key,{...issue,opened_at:now,last_seen_at:now});
    else activeIssueAlerts.set(issue.key,{...activeIssueAlerts.get(issue.key),...issue,last_seen_at:now});
    if(previousIssueKeys.has(issue.key))continue;
    const delivery=await notifyIrrigation({title:'Supervisor autônomo',body:issue.message,tag:'autonomy-'+issue.key,level:issue.level,url:'/f2e/',cooldownMinutes:30}).catch(()=>null);
    const opened=activeIssueAlerts.get(issue.key);if(opened)activeIssueAlerts.set(issue.key,{...opened,status:'active',delivery:{push:Number(delivery?.push?.sent||0)>0,telegram:delivery?.telegram?.ok===true,whatsapp:delivery?.whatsapp?.sent===true}});await persistActiveIncidents();
  }
  for(const key of previousIssueKeys){
    if(nowKeys.has(key))continue;
    const original=activeIssueAlerts.get(key)||{key,message:`Condição ${key}`};
    const recovered=recoveryMessage(original,Number(original.opened_at||now),now);
    let pending=original.recovery_pending===true?original:null;
    let recoveryDelivery=pending?.recovery_delivery_raw||null;
    if(!pending){
      recoveryDelivery=await notifyIrrigation({...recovered,url:'/f2e/',cooldownMinutes:5}).catch(()=>null);
      pending={...original,status:'recovery_pending',recovery_pending:true,resolved_at:now,recovery_delivery_raw:recoveryDelivery||null};
      activeIssueAlerts.set(key,pending);
      if(!(await persistActiveIncidents()))continue;
    }
    const resolvedAt=Number(pending.resolved_at||now);
    const resolvedRecovered=recoveryMessage(pending,Number(pending.opened_at||resolvedAt),resolvedAt);
    const resolved={event:'alert_resolved',ts:resolvedAt,key,level:pending.level||'warning',message:pending.message||'',opened_at:Number(pending.opened_at||resolvedAt),resolved_at:resolvedAt,duration_ms:resolvedRecovered.duration_ms,status:'resolved',delivery:pending.delivery||{},recovery_delivery:{push:Number(recoveryDelivery?.push?.sent||0)>0,telegram:recoveryDelivery?.telegram?.ok===true,whatsapp:recoveryDelivery?.whatsapp?.sent===true}};
    if(!(await persistResolvedIncident(resolved)))continue;
    activeIssueAlerts.delete(key);
    if(!(await persistActiveIncidents())){activeIssueAlerts.set(key,pending);continue;}
  }
  previousIssueKeys=nowKeys;
}

export async function runAutonomyTick({notify=true}={}){
  if(busy)return latest;
  busy=true;
  try{
    const before=await readContext();
    let evaluation=evaluateAutonomy(before,Date.now());
    const recovery=await safeRecover(before,evaluation);
    let context=before;
    if(recovery.some(x=>x.ok)){
      context=await readContext();
      evaluation=evaluateAutonomy(context,Date.now());
    }
    const baseline=buildAutonomyBaseline(context.recentHistory||[],Date.now());
    const anomalies=detectAutonomyAnomalies({baseline,history:context.recentHistory||[],weather:context.weather,seconds:context.seconds},Date.now());
    const learning=learningSummary(baseline,anomalies);
    const hourlyProfile=buildHourlyProfile(context.recentHistory||[],Date.now());
    const hourlyAnomalies=detectHourlyAnomaly({profile:hourlyProfile,weather:context.weather,seconds:context.seconds},Date.now());
    const maintenance=predictiveMaintenance(context.recentHistory||[],Date.now(),context.seconds||{});
    const reliability=componentReliability({seconds:context.seconds,weather:context.weather,history:context.history,firebaseOk:context.firebase_ok,devices:context.devices});
    const backupHealth={local:context.maintenanceStatus?.backups?.validation||null,config:context.configBackup||null};
    const backupRestorable=Boolean(backupHealth.local?.restorable&&backupHealth.config?.restorable);
    const risk=predictiveRisk({maintenance,reliability,hourlyAnomalies,backup:{restorable:backupRestorable}});
    const dailyPlan=buildDailyPlan({forecast:context.forecast,weather:context.weather,seconds:context.seconds,autonomy:{score:evaluation.score}});
    const decisionJournal=buildDecisionJournal(context.recentHistory||[],Date.now());
    const resultLearning=learnFromDecisionResults(decisionJournal);
    const learningDiagnostics=buildLearningDiagnostics(decisionJournal,Date.now());
    const learning46=buildLearning46(decisionJournal);
    const learning47=buildLearning47(decisionJournal,Date.now());
    const learning48=buildLearning48(decisionJournal,Date.now());
    const learning50=buildLearning50(decisionJournal,Date.now());
    const learning51=buildLearning51(decisionJournal,Date.now());
    const learning52=buildLearning52(decisionJournal,Date.now());
    const recoverySelfTest=runRecoverySelfTest(evaluateAutonomy,Date.now());
    const intelligence42=buildIntelligence42({seconds:context.seconds,weather:context.weather,forecast:context.forecast,resultLearning:{...resultLearning,diagnostics:learningDiagnostics},decisionJournal,dailyPlan});
    const hourlyIssues=hourlyAnomalies.map(x=>({key:'hourly-'+x.key,level:x.deviation>=2?'warning':'info',message:`${x.key} fora do padrão esperado para este horário.`}));
    anomalies.push(...hourlyIssues);
    const maintenanceIssues=(maintenance.issues||[]).filter(x=>x.level==='critical'||x.level==='warning');
    const backupIssues=backupRestorable?[]:[{key:'backup-validation',level:'warning',message:'Backup inteligente não passou completamente no teste de restauração.'}];
    const anomalyIssues=[...anomalies.filter(x=>x.level==='critical'||x.level==='warning'),...maintenanceIssues,...backupIssues];
    if(anomalyIssues.length){
      evaluation={...evaluation,issues:[...evaluation.issues,...anomalyIssues]};
      evaluation.score=Math.max(0,evaluation.score-anomalyIssues.reduce((s,x)=>s+(x.level==='critical'?18:7),0));
      if(anomalyIssues.some(x=>x.level==='critical'))evaluation.status='attention';
      else if(evaluation.status==='healthy')evaluation.status='degraded';
    }
    // Compatibilidade de contratos anteriores: version:5.1 | local_supervisor_guardian_5_1 | Guardian 5.0 recupera apenas comunicação e leitura
    latest={
      version:5.2,
      intelligence:'local_supervisor_guardian_5_2',
      checked_at:Date.now(),
      active_alerts:activeAlertSnapshot(Date.now()),
      status:evaluation.status,
      score:evaluation.score,
      issues:evaluation.issues,
      recovery,
      learning:{...learning,baseline,anomalies,hourly_profile:hourlyProfile},
      maintenance,
      reliability,
      risk,
      backup_health:{...backupHealth,restorable:backupRestorable,checked_at:Date.now()},
      daily_plan:dailyPlan,
      decision_journal:decisionJournal.slice(0,30),
      result_learning:resultLearning,
      learning_diagnostics:learningDiagnostics,learning_4_6:learning46,learning_4_7:learning47,learning_4_8:learning48,learning_5_0:learning50,learning_5_1:learning51,learning_5_2:learning52,daily_report:{version:'1.1',pulses:Number(context.seconds?.daily_pulses_started||0),completed:Number(context.seconds?.daily_pulses_completed||0),interrupted:Number(context.seconds?.daily_pulses_interrupted||0),irrigated_seconds:Number(context.seconds?.daily_irrigated_seconds||0),rain:Boolean(context.weather?.metrics?.rainDetected),rain_mm:Number(context.weather?.metrics?.rain_mm||context.weather?.metrics?.precipitation_mm||0),temperature:Number.isFinite(Number(context.weather?.metrics?.temperature))?Number(context.weather.metrics.temperature):null,humidity:Number.isFinite(Number(context.weather?.metrics?.humidity))?Number(context.weather.metrics.humidity):null,guardian_status:evaluation.status,guardian_score:evaluation.score,active_alerts:activeAlertSnapshot(Date.now()).length,shadow_candidate_seconds:intelligence42?.automatic_4_1?.candidate_off_seconds??null,simulation_candidate_seconds:intelligence42?.automatic_4_2?.candidate_off_seconds??null,summary:evaluation.status==='healthy'?'Operação monitorada sem anomalias críticas.':evaluation.status==='degraded'?'Operação monitorada com pontos de atenção.':'Operação requer revisão dos alertas ativos.',physical_control:false},operational_timeline:[...(context.recentHistory||[]).slice(0,20).map(x=>({ts:x.ts||x.at,type:x.type||'event',status:x.status||null}))],notification_policy:{version:'3.0',priority_order:['critical','warning','info'],deduplication:true,recovery_messages:true,physical_control:false},guardian_5_1:{anomaly_detection:true,checks:['controller_stale','device_flapping','forecast_stale','history_stalled','memory_growth','logical_device_divergence'],physical_control:false},guardian_5_2:{anomaly_detection:true,status:evaluation.status,score:evaluation.score,active_alerts:activeAlertSnapshot(Date.now()).length,checks:['controller_stale','device_flapping','forecast_stale','history_stalled','memory_growth','logical_device_divergence','backup_restorable','hourly_anomaly'],data_quality:{weather_fresh:evaluation.weather_fresh,backup_restorable:backupRestorable},physical_control:false,automatic_hardware_actions:false},system_health:{firebase:context.firebase_ok!==false?'ok':'falha',weather:context.weather?.device?.online===false?'falha':'ok',viveiro:(context.devices||[]).some(x=>String(x.name||'').trim()==='Viveiro 2E'&&x.online!==false)?'ok':'falha',history:context.history?'ok':'coletando',notifications:'monitorado',physical_control:false},
      recovery_self_test:recoverySelfTest,
      intelligence_4_2:intelligence42,
      controller:{automatic_controller:context.seconds?.automatic_controller||null,automatic_version:num(context.seconds?.automatic_version)||null,phase:context.seconds?.phase||null,enabled:context.seconds?.enabled!==false},
      weather:{fresh:evaluation.weather_fresh,linked:context.weather?.linked!==false,online:context.weather?.device?.online!==false,checked_at:context.weather?.checked_at||null},
      safeguards:['Guardian 5.2 monitora e recupera apenas comunicação e leitura','Nenhum acionamento físico pelo supervisor','Automático 4.0 mantém autoridade da irrigação','Recuperações apenas de comunicação/leitura','Interlocks continuam prioritários']
    };
    await storeSet(ROOT+'/latest',latest).catch(()=>null);
    await storePush(ROOT+'/journal',{ts:latest.checked_at,status:latest.status,score:latest.score,issues:latest.issues,recovery:latest.recovery,learning:{stage:latest.learning?.stage,normality:latest.learning?.normality,score:latest.learning?.score,anomaly_count:latest.learning?.anomaly_count}}).catch(()=>null);
    const scheduledSummaries=notify?await maybeSendScheduledSummaries(context,latest,Date.now()):[];
    if(scheduledSummaries.length)latest={...latest,scheduled_summaries:scheduledSummaries};
    if(notify)await notifyChanges(evaluation);
    publishLive('autonomy',latest);
    return latest;
  }finally{busy=false;}
}
export function getAutonomyState(){return latest;}

export function startAutonomySupervisor({intervalMs=DEFAULT_INTERVAL_MS}={}){
  if(timer)return()=>stopAutonomySupervisor();
  const run=()=>runAutonomyTick().catch(error=>console.warn('autonomy supervisor:',error?.message||error));
  timer=setInterval(run,Math.max(15000,Number(intervalMs)||DEFAULT_INTERVAL_MS));
  timer.unref?.();
  setTimeout(run,8000).unref?.();
  return()=>stopAutonomySupervisor();
}

export function stopAutonomySupervisor(){
  if(timer)clearInterval(timer);
  timer=null;
}

// Compatibilidade de telemetria histórica: version:4.8 local_supervisor_predictive_4_8

// Compatibilidade Guardian anterior: version:5.0
