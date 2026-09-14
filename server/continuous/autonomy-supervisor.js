import { smartLifeListDevices } from '../api/_smartlife.js';
import { fetchWeatherSnapshot } from '../api/weather/_weather.js';
import { readRecentHistory, storeGet, storeSet, storePush } from '../api/irrigation/_store.js';
import { notifyIrrigation } from '../api/irrigation/_notify.js';
import { localHistoryStatus } from '../local/history-store.js';
import { getSecondsManagerState } from './seconds-manager.js';
import { publishLive } from './live-bus.js';
import { buildAutonomyBaseline, detectAutonomyAnomalies, learningSummary } from './autonomy-learning.js';
import { buildHourlyProfile, detectHourlyAnomaly, predictiveMaintenance, buildDailyPlan, componentReliability, predictiveRisk } from './autonomy-v3.js';
import { loadForecast } from '../api/weather/forecast.js';
import { buildDecisionJournal, learnFromDecisionResults } from './decision-journal.js';
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
    readRecentHistory({sinceMs:Date.now()-14*86400000,limit:20000}).catch(()=>[]),
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

async function notifyChanges(evaluation){
  const nowKeys=new Set(evaluation.issues.map(x=>x.key));
  for(const issue of evaluation.issues){
    if(previousIssueKeys.has(issue.key))continue;
    await notifyIrrigation({title:'Supervisor autônomo',body:issue.message,tag:'autonomy-'+issue.key,level:issue.level,url:'/irrigacao/',cooldownMinutes:30}).catch(()=>null);
  }
  for(const key of previousIssueKeys){
    if(nowKeys.has(key))continue;
    await notifyIrrigation({title:'Supervisor autônomo',body:`Condição ${key} normalizada automaticamente.`,tag:'autonomy-'+key+'-recovered',level:'info',url:'/irrigacao/',cooldownMinutes:5}).catch(()=>null);
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
    const recoverySelfTest=runRecoverySelfTest(evaluateAutonomy,Date.now());
    const intelligence42=buildIntelligence42({seconds:context.seconds,weather:context.weather,forecast:context.forecast,resultLearning,decisionJournal,dailyPlan});
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
    latest={
      version:4.2,
      intelligence:'local_supervisor_predictive_4_2',
      checked_at:Date.now(),
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
      recovery_self_test:recoverySelfTest,
      intelligence_4_2:intelligence42,
      controller:{automatic_controller:context.seconds?.automatic_controller||null,automatic_version:num(context.seconds?.automatic_version)||null,phase:context.seconds?.phase||null,enabled:context.seconds?.enabled!==false},
      weather:{fresh:evaluation.weather_fresh,linked:context.weather?.linked!==false,online:context.weather?.device?.online!==false,checked_at:context.weather?.checked_at||null},
      safeguards:['Nenhum acionamento físico pelo supervisor','Automático 4.0 mantém autoridade da irrigação','Recuperações apenas de comunicação/leitura','Interlocks continuam prioritários']
    };
    await storeSet(ROOT+'/latest',latest).catch(()=>null);
    await storePush(ROOT+'/journal',{ts:latest.checked_at,status:latest.status,score:latest.score,issues:latest.issues,recovery:latest.recovery,learning:{stage:latest.learning?.stage,normality:latest.learning?.normality,score:latest.learning?.score,anomaly_count:latest.learning?.anomaly_count}}).catch(()=>null);
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
