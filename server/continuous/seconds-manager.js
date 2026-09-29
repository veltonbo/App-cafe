import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fetchWeatherSnapshot } from '../api/weather/_weather.js';
import { appendHistory, historyIndexStatus, readRecentHistory, storeGet, storeSet } from '../api/irrigation/_store.js';
import { notifyIrrigation } from '../api/irrigation/_notify.js';
import { createConfigBackup } from '../api/irrigation/_backup.js';
import { climateSuggestion, climateTrend, getClimateConfig, getClimateState, patchClimateState, updateClimateSamples, vaporPressureDeficit } from '../api/viveiro/_climate.js';
import { activateEmergency, clearEmergency, emergencyLatched } from '../api/viveiro/_interlock.js';
import { publishLive } from './live-bus.js';
import { accountingDayKey, pulseAccountingForDay } from './accounting.js';
import { readLocalHistoryFileRange } from '../local/history-store.js';
import {
  localSchedule,
  secondsUntilNextWindow,
  prepareServerPulse,
  pulseStillActive,
  readViveiroDevice,
  setViveiroRelay,
  stopServerPulse,
  writeViveiroCycle
} from '../api/viveiro/_seconds.js';

const STATE_FILE=(process.env.IRRIGATION_STATE_FILE||'/data/viveiro-seconds.json').trim();
let state={enabled:false,phase:'idle'};
let loopPromise=null;
let ownershipCheckedAt=0;
let ownershipActive=true;
let remoteStoreAvailable=null;
let remoteStoreRetryAt=0;
const REMOTE_STATE_PATH='IrrigacaoFazenda2E/viveiroSecondsState';
const WEATHER_CONFIG_PATH='IrrigacaoFazenda2E/viveiroWeather/config';
const MAINTENANCE_PATH='IrrigacaoFazenda2E/viveiroMaintenance';
const HISTORY_RECENT_WINDOW_MS=36*60*60*1000;
const HISTORY_RECENT_LIMIT=5000;
const ACCOUNTING_RECONCILE_MS=5*60*1000;
const OPERATIONAL_AUDIT_MS=30*1000;
const EKAZA_FAILOVER_CONFIRM_MS=60*1000;
const INCIDENT_ROOT='IrrigacaoFazenda2E/viveiro/incidents';
let accountingTimer=null;
let operationalAuditTimer=null;
// Railway auto-deploy marker v2

function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function publicSecondsState(value=state){
  const {
    native_cycle_raw,
    disabled_cycle_raw,
    ...safe
  }=value||{};
  return{...safe,server_read_at:Date.now()};
}
function addPrecisionSample(kind,targetMs,actualMs,at=Date.now()){
  const target=Math.max(0,Number(targetMs)||0);
  const actual=Math.max(0,Number(actualMs)||0);
  if(!target||!actual)return;
  const sample={
    kind:String(kind||'cycle'),
    target_ms:Math.round(target),
    actual_ms:Math.round(actual),
    error_ms:Math.round(actual-target),
    abs_error_ms:Math.round(Math.abs(actual-target)),
    at:Number(at)||Date.now()
  };
  const cutoff=Number(at)-10*60*1000;
  const previous=(Array.isArray(state.precision_samples)?state.precision_samples:[]).filter(row=>Number(row?.at||0)>=cutoff&&Number(row?.abs_error_ms||0)<=5000);
  const samples=[...previous,sample].slice(-12);
  const avg=samples.reduce((sum,row)=>sum+Number(row.abs_error_ms||0),0)/Math.max(1,samples.length);
  const max=Math.max(...samples.map(row=>Number(row.abs_error_ms||0)),0);
  state={
    ...state,
    precision_samples:samples,
    precision:{
      last:sample,
      avg_abs_error_ms:Math.round(avg),
      max_abs_error_ms:Math.round(max),
      samples:samples.length,
      status:avg<=500?'excellent':avg<=1500?'good':'attention'
    }
  };
}
function addSchedulerPrecisionSample(kind,targetAt,actualAt,at=Date.now()){
  const target=Math.max(0,Number(targetAt)||0);
  const actual=Math.max(0,Number(actualAt)||0);
  if(!target||!actual)return;
  const sample={
    kind:String(kind||'command'),
    target_at:Math.round(target),
    actual_at:Math.round(actual),
    error_ms:Math.round(actual-target),
    abs_error_ms:Math.round(Math.abs(actual-target)),
    at:Number(at)||Date.now()
  };
  const cutoff=Number(at)-10*60*1000;
  const previous=(Array.isArray(state.scheduler_precision_samples)?state.scheduler_precision_samples:[]).filter(row=>Number(row?.at||0)>=cutoff);
  const samples=[...previous,sample].slice(-12);
  const avg=samples.reduce((sum,row)=>sum+Number(row.abs_error_ms||0),0)/Math.max(1,samples.length);
  const max=Math.max(...samples.map(row=>Number(row.abs_error_ms||0)),0);
  state={
    ...state,
    scheduler_precision_samples:samples,
    scheduler_precision:{
      last:sample,
      avg_abs_error_ms:Math.round(avg),
      max_abs_error_ms:Math.round(max),
      samples:samples.length,
      status:avg<=500?'excellent':avg<=1500?'good':'attention'
    }
  };
}
function addConfirmationLatencySample(command,latencyMs,source='unknown',at=Date.now()){
  const latency=Math.max(0,Number(latencyMs)||0);
  const sample={
    command:String(command||'unknown'),
    latency_ms:Math.round(latency),
    source:String(source||'unknown'),
    at:Number(at)||Date.now()
  };
  const previous=Array.isArray(state.confirmation_latency_samples)?state.confirmation_latency_samples:[];
  const samples=[...previous,sample].slice(-24);
  const values=samples.map(row=>Number(row.latency_ms||0)).filter(Number.isFinite);
  const avg=values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
  const max=values.length?Math.max(...values):0;
  state={
    ...state,
    confirmation_latency_samples:samples,
    confirmation_latency:{
      last:sample,
      avg_ms:Math.round(avg),
      max_ms:Math.round(max),
      samples:samples.length,
      status:avg<=3000?'good':avg<=8000?'attention':'high'
    }
  };
}

function historyEventId(type,extra={},ts=Date.now()){
  const supplied=String(extra?.event_id||'').trim();
  if(supplied)return supplied;
  const pulseId=String(extra?.pulse_id||'').trim();
  if(pulseId)return String(type||'event')+'-'+pulseId;
  return String(type||'event')+'-'+ts+'-'+randomUUID().slice(0,10);
}
async function event(type,detail,extra={}){
  const ts=Date.now();
  const row={
    type,
    detail,
    source:'viveiro_fast',
    status:String(state.phase||''),
    ts,
    event_id:historyEventId(type,extra,ts),
    ...extra
  };
  try{
    await appendHistory(row);
    const pending=Array.isArray(state.pending_history_events)?state.pending_history_events:[];
    state={
      ...state,
      history_sync:{
        status:pending.length?'pending':'ok',
        pending:pending.length,
        last_success_at:Date.now(),
        last_error:null
      }
    };
  }catch(error){
    console.error('Falha ao gravar evento do Viveiro:',row.event_id,error?.message||error);
    const previous=Array.isArray(state.pending_history_events)?state.pending_history_events:[];
    const pending=[
      ...previous.filter(item=>String(item?.event_id||'')!==String(row.event_id)),
      row
    ].slice(-120);
    state={
      ...state,
      pending_history_events:pending,
      history_sync:{
        status:'degraded',
        pending:pending.length,
        last_failure_at:Date.now(),
        last_error:error?.message||String(error)
      }
    };
    await persist().catch(()=>null);
    await pushNotice(
      'Atenção • histórico do Viveiro',
      'Um evento não foi confirmado no Firebase e ficou na fila para nova tentativa. A irrigação continua protegida.',
      'viveiro-history-write-failure',
      'warning',
      30,
      true
    );
  }
  publishLive('event',row);
  return row;
}
async function pushNotice(title,body,tag,level='info',cooldownMinutes=0,whatsapp=true){
  await notifyIrrigation({title,body,tag,url:'/irrigacao/',level,cooldownMinutes,whatsapp}).catch(()=>null);
}
function localDayKey(ts=Date.now()){
  return accountingDayKey(ts);
}
function ensureDailyCounters(ts=Date.now()){
  const key=localDayKey(ts);
  if(String(state.daily_day_key||'')!==key){
    state={
      ...state,
      daily_day_key:key,
      daily_pulses_started:0,
      daily_pulses_completed:0,
      daily_pulses_interrupted:0,
      daily_irrigated_seconds:0,
      daily_last_pulse_at:0
    };
  }
}
async function flushPendingHistory(){
  const pending=Array.isArray(state.pending_history_events)?state.pending_history_events:[];
  if(!pending.length)return{ok:true,pending:0};

  const remaining=[];
  let sent=0;
  for(const row of pending){
    try{
      await appendHistory(row);
      sent+=1;
    }catch(error){
      remaining.push(row);
      console.error('Retry do histórico falhou:',row?.event_id,error?.message||error);
    }
  }
  state={
    ...state,
    pending_history_events:remaining,
    history_sync:{
      status:remaining.length?'degraded':'ok',
      pending:remaining.length,
      last_retry_at:Date.now(),
      last_success_at:remaining.length?state.history_sync?.last_success_at:Date.now(),
      last_error:remaining.length?'Ainda existem eventos aguardando Firebase.':null
    }
  };
  await persist().catch(()=>null);
  return{ok:remaining.length===0,pending:remaining.length,sent};
}
function auditSeverity(issues=[]){
  return issues.some(x=>x.level==='critical')?'critical':issues.length?'warning':'ok';
}
async function runOperationalAudit({notify=false}={}){
  const now=Date.now();

  // Guardian de agenda: uma parada externa/reinício não pode deixar uma janela válida
  // silenciosamente desarmada. Emergência, manutenção e parada manual NÃO são rearmadas.
  if(!state.enabled&&['stopped_external','stopped_after_restart'].includes(String(state.phase||''))){
    const schedule=localSchedule(state);
    const maint=await maintenance().catch(()=>({active:false}));
    const emergency=await emergencyLatched().catch(()=>true);
    if(schedule.inside&&!maint.active&&!emergency){
      const previousPhase=String(state.phase||'');
      const current=await readViveiroDevice({force:true,maxAgeMs:0}).catch(()=>null);
      if(current?.online){
        state={...state,enabled:true,phase:'queued',relay_expected:false,last_error:null,runtime_schedule_recovered_at:now};
        ownershipActive=true;ownershipCheckedAt=now;
        await persist();
        ensureLoop();
        await event('viveiro_schedule_runtime_recovered','Guardian rearmou a programação durante a janela ativa.',{previous_phase:previousPhase});
        await pushNotice('Programação recuperada','O Guardian detectou a programação desarmada e reativou o ciclo automaticamente.','viveiro-runtime-recovery-'+localDayKey(), 'warning',30,true);
      }
    }
  }

  const issues=[];
  let auditHistory=[];

  // Watchdog de transição: se o relógio absoluto de ON/OFF vencer e o laço não
  // avançar, força um estado seguro e reinicia o controlador sem ignorar intertravamentos.
  const transitionToleranceMs=5000;
  const onDue=String(state.phase||'')==='on'&&Number(state.expected_off_at||0)>0&&now>Number(state.expected_off_at)+transitionToleranceMs;
  const offDue=String(state.phase||'')==='off'&&Number(state.expected_next_on_at||0)>0&&now>Number(state.expected_next_on_at)+transitionToleranceMs;
  if(state.enabled&&(onDue||offDue)){
    const kind=onDue?'on_overdue':'off_overdue';
    const previousPhase=String(state.phase||'');
    const lastRecovery=Number(state.transition_watchdog?.last_recovery_at||0);
    if(now-lastRecovery>15000){
      const recoveredOff=await safeOff('transition_watchdog_'+kind);
      state={
        ...state,
        phase:'queued',
        relay_expected:false,
        expected_off_at:0,
        expected_next_on_at:0,
        last_error:recoveredOff?null:'Watchdog não confirmou R1 OFF durante recuperação.',
        transition_watchdog:{
          status:recoveredOff?'recovered':'critical',
          reason:kind,
          previous_phase:previousPhase,
          last_recovery_at:now,
          recovery_count:Number(state.transition_watchdog?.recovery_count||0)+1,
          message:recoveredOff
            ?'Transição atrasada detectada; R1 confirmado OFF e laço rearmado.'
            :'Transição atrasada detectada e R1 OFF não foi confirmado.'
        }
      };
      await persist();
      await event('viveiro_transition_watchdog',recoveredOff
        ?'Guardian recuperou automaticamente uma transição de ciclo atrasada.'
        :'Guardian detectou transição atrasada, mas não confirmou o desligamento físico.',{
        reason:kind,previous_phase:previousPhase,recovered:recoveredOff
      });
      if(recoveredOff){
        ensureLoop();
        await pushNotice(
          'Guardian recuperou o ciclo',
          'Uma transição '+(onDue?'ON → OFF':'OFF → ON')+' atrasou. O R1 foi colocado em estado seguro e o ciclo foi rearmado automaticamente.',
          'viveiro-transition-recovered-'+localDayKey(),
          'warning',15,true
        );
      }else{
        await pushNotice(
          'FALHA CRÍTICA • ciclo travado',
          'O Guardian detectou uma transição atrasada e não recebeu confirmação física de R1 OFF. Verifique o controlador.',
          'viveiro-transition-critical-'+localDayKey(),
          'critical',5,true
        );
      }
    }
  }
  const phase=String(state.phase||'');
  const schedule=localSchedule(state);
  const protectedPhase=['weather_blocked','weather_unavailable','waiting_after_rain','maintenance','waiting_window','emergency_stopped','stopped'];

  if(state.enabled&&phase==='on'){
    const due=Number(state.expected_off_at||0);
    if(due&&now>due+20000){
      issues.push({level:'critical',code:'pulse_overdue',message:'Pulso ligado além do tempo esperado.'});
    }
  }

  if(state.enabled&&phase==='off'){
    const due=Number(state.expected_next_on_at||0);
    if(due&&now>due+20000){
      issues.push({level:'critical',code:'next_pulse_overdue',message:'Próximo pulso não iniciou no tempo esperado.'});
    }
  }

  if(state.enabled&&schedule.inside&&!protectedPhase.includes(phase)){
    const cycleSeconds=Math.max(2,Number(state.on_seconds||30)+Number(state.off_seconds||120));
    const lastPulseAt=Number(state.daily_last_pulse_at||state.last_pulse_at||state.last_on_confirmed_at||0);
    if(lastPulseAt&&now-lastPulseAt>(cycleSeconds*2+45)*1000){
      issues.push({level:'warning',code:'long_pulse_gap',message:'Tempo sem novo pulso maior que o esperado para o ciclo atual.'});
    }
  }

  const confirmationAt=Number(state.last_confirmation_at||0);
  if(state.enabled&&schedule.inside&&confirmationAt&&now-confirmationAt>10*60000&&!protectedPhase.includes(phase)){
    issues.push({level:'warning',code:'confirmation_stale',message:'Smart Life está há mais de 10 min sem nova confirmação do Viveiro.'});
  }

  // Para segurança, atraso de ON causado por checagens de chuva/nuvem não é falha
  // do relógio. A auditoria de precisão considera o OFF, que limita a água aplicada.
  const offScheduler=(Array.isArray(state.scheduler_precision_samples)?state.scheduler_precision_samples:[])
    .filter(x=>String(x?.kind||'')==='off_command').slice(-4);
  const offSchedulerAvg=offScheduler.length
    ?offScheduler.reduce((sum,x)=>sum+Number(x?.abs_error_ms||0),0)/offScheduler.length:0;
  if(offScheduler.length>=4&&offSchedulerAvg>1500){
    issues.push({
      level:'warning',
      code:'scheduler_delay_high',
      message:'O comando local de desligamento está saindo com mais de 1,5 s de atraso médio.'
    });
  }

  const cloudLatency=state.confirmation_latency||{};
  if(
    state.enabled&&schedule.inside&&
    Number(cloudLatency.samples||0)>=4&&Number(cloudLatency.avg_ms||0)>12000&&
    !protectedPhase.includes(phase)
  ){
    issues.push({
      level:'warning',
      code:'cloud_latency_high',
      message:'A confirmação pela nuvem Smart Life está levando mais de 12 s em média; o relógio local do ciclo é avaliado separadamente.'
    });
  }

  if(String(state.history_sync?.status||'')==='degraded'){
    issues.push({
      level:'warning',code:'history_sync_degraded',
      message:Number(state.history_sync?.pending||0)>1
        ?Number(state.history_sync.pending)+' eventos aguardam confirmação no Firebase.'
        :'Um evento aguarda confirmação no Firebase.'
    });
  }

  if(String(state.accounting_reconciliation?.status||'')==='degraded'){
    issues.push({level:'warning',code:'accounting_degraded',message:'A conferência automática dos pulsos está temporariamente indisponível.'});
  }

  try{
    const history=(await readRecentHistory({
      sinceMs:now-HISTORY_RECENT_WINDOW_MS,
      limit:HISTORY_RECENT_LIMIT
    })).filter(row=>
      String(row?.source||'').includes('viveiro')||String(row?.type||'').startsWith('viveiro_')
    );
    // O histórico local/Firebase pode devolver a mesma ocorrência pelos dois índices.
    // Guardian conta ocorrências físicas únicas, nunca cópias do mesmo event_id.
    const uniqueHistory=Array.from(new Map(history.map((row,index)=>[
      String(row?.event_id||row?.id||[row?.type,row?.ts,index].join('-')),row
    ])).values());
    auditHistory=uniqueHistory;
    const recent30=uniqueHistory.filter(row=>now-Number(row.ts||0)<30*60000);
    // start_delay descreve o resultado tardio da mesma tentativa de partida e não
    // representa uma segunda falha física. Contar failure + delay duplicava um único
    // incidente e deixava o Guardian crítico mesmo após o R1 recuperar.
    const failures=recent30.filter(row=>
      ['viveiro_error','viveiro_start_failure'].includes(String(row.type||''))
    );
    if(failures.length>=2){
      issues.push({level:'critical',code:'repeated_failures',message:'Falhas independentes de irrigação se repetiram nos últimos 30 minutos.'});
    }
    const interrupted=recent30.filter(row=>String(row.type||'')==='viveiro_pulse_interrupted');
    if(interrupted.length>=3){
      issues.push({level:'warning',code:'many_interruptions',message:'Três ou mais pulsos foram interrompidos nos últimos 30 minutos.'});
    }
    const restarts=uniqueHistory.filter(row=>
      now-Number(row.ts||0)<60*60000&&
      ['viveiro_server_restart','viveiro_server_resumed','viveiro_cycle_recovered'].includes(String(row.type||''))
    );
    if(restarts.length>=3&&schedule.inside){
      issues.push({level:'warning',code:'restarts_excessive',message:'O controle do Viveiro reiniciou várias vezes durante a janela de irrigação.'});
    }
  }catch(error){
    issues.push({level:'warning',code:'audit_history_unavailable',message:'Auditoria não conseguiu consultar o histórico agora.'});
  }

  try{
    const snapshot=await fetchWeatherSnapshot({maxAgeMs:5000});
    const checked=Number(snapshot?.checked_at||0);
    if(!snapshot?.linked||snapshot?.device?.online===false||snapshot?.error){
      issues.push({level:'critical',code:'weather_offline',message:'Weather2-2 sem comunicação.'});
    }else if(checked&&now-checked>15*60000){
      issues.push({level:'warning',code:'weather_stale',message:'Weather2-2 está há mais de 15 min sem atualização.'});
    }
  }catch{
    issues.push({level:'critical',code:'weather_offline',message:'Weather2-2 sem comunicação.'});
  }

  const previous=state.operational_audit||{};
  const previousCodes=new Set((previous.issues||[]).map(x=>String(x.code)));
  const notifiedCodes=new Set((previous.notified_codes||[]).map(String));
  const activeIncidents={...(previous.active_incidents||{})};
  const currentCodes=new Set(issues.map(x=>String(x.code)));
  const newIssues=issues.filter(x=>!notifiedCodes.has(String(x.code)));
  const cleared=[...previousCodes].filter(code=>!currentCodes.has(code));
  const toNotify=notify?newIssues.slice(0,3):[];
  const nextNotified=new Set(
    [...notifiedCodes].filter(code=>currentCodes.has(code))
  );
  for(const issue of toNotify)nextNotified.add(String(issue.code));
  const severity=auditSeverity(issues);

  // Abre, atualiza e encerra incidentes de forma independente dos avisos.
  for(const issue of issues){
    const code=String(issue.code||'unknown');
    let incident=activeIncidents[code];
    if(!incident){
      const id=(code+'-'+now).replace(/[^A-Za-z0-9_-]/g,'_');
      incident={
        id,code,
        level:issue.level==='critical'?'critical':'warning',
        message:String(issue.message||code),
        opened_at:now,
        last_seen_at:now,
        status:'open',
        source:'viveiro_audit'
      };
      activeIncidents[code]=incident;
      await storeSet(INCIDENT_ROOT+'/'+id,incident).catch(error=>
        console.warn('Falha ao abrir incidente do Viveiro:',error?.message||error)
      );
    }else{
      incident={...incident,last_seen_at:now,level:issue.level==='critical'?'critical':'warning',message:String(issue.message||incident.message)};
      activeIncidents[code]=incident;
      await storeSet(INCIDENT_ROOT+'/'+incident.id,incident).catch(()=>null);
    }
  }

  for(const code of cleared){
    const incident=activeIncidents[code];
    if(!incident)continue;
    const openedAt=Number(incident.opened_at||now);
    const interventionTypes=new Set([
      'viveiro_cycle_start','viveiro_cycle_stop','viveiro_emergency_clear',
      'viveiro_maintenance_start','viveiro_maintenance_end','viveiro_climate_applied'
    ]);
    const manualIntervention=auditHistory.some(row=>
      Number(row.ts||0)>=openedAt&&
      Number(row.ts||0)<=now&&
      interventionTypes.has(String(row.type||''))
    );
    const resolved={
      ...incident,
      status:'resolved',
      resolved_at:now,
      last_seen_at:Number(incident.last_seen_at||now),
      duration_ms:Math.max(0,now-openedAt),
      resolution:manualIntervention?'intervencao':'automatico'
    };
    const recoveryHistory=[
      resolved,
      ...(Array.isArray(state.guardian_recovery_history)?state.guardian_recovery_history:[])
    ].filter((row,index,all)=>all.findIndex(x=>String(x?.id||'')===String(row?.id||''))===index).slice(0,12);
    state={...state,guardian_recovery_history:recoveryHistory,last_guardian_recovery:resolved};
    await storeSet(INCIDENT_ROOT+'/'+incident.id,resolved).catch(error=>
      console.warn('Falha ao encerrar incidente do Viveiro:',error?.message||error)
    );
    delete activeIncidents[code];
  }

  state={
    ...state,
    operational_audit:{
      status:severity,
      checked_at:now,
      issues,
      new_codes:newIssues.map(x=>x.code),
      notified_codes:[...nextNotified],
      cleared_codes:cleared,
      active_incidents:activeIncidents,
      active_count:Object.keys(activeIncidents).length,
      current_fault:Object.keys(activeIncidents).length>0,
      recovered_recently:Object.keys(activeIncidents).length===0&&Boolean(state.last_guardian_recovery)&&now-Number(state.last_guardian_recovery?.resolved_at||0)<60*60000,
      last_recovery:state.last_guardian_recovery||null,
      recovery_history:(Array.isArray(state.guardian_recovery_history)?state.guardian_recovery_history:[]).slice(0,12),
      message:severity==='ok'?'Auditoria operacional sem anomalias.':issues[0]?.message||'Auditoria encontrou uma anomalia.'
    }
  };
  await persist().catch(()=>null);

  if(notify){
    for(const issue of toNotify){
      await pushNotice(
        issue.level==='critical'?'Alerta crítico • Viveiro':'Atenção • Viveiro',
        issue.message,
        'viveiro-audit-'+issue.code,
        issue.level,
        issue.level==='critical'?30:60,
        true
      );
      await event('viveiro_audit_alert',issue.message,{audit_code:issue.code,level:issue.level});
    }
    if(cleared.length&&issues.length===0){
      await event('viveiro_audit_recovered','Auditoria operacional voltou ao estado normal.',{cleared_codes:cleared});
    }
  }
  return state.operational_audit;
}

async function recoverDailyCountersFromReconciliation(){
  ensureDailyCounters();
  const today=localDayKey();
  const hasCurrentCounters=
    Number(state.daily_pulses_started||0)>0||
    Number(state.daily_pulses_completed||0)>0||
    Number(state.daily_pulses_interrupted||0)>0||
    Number(state.daily_irrigated_seconds||0)>0;
  const lastPulse=Number(state.daily_last_pulse_at||state.last_pulse_at||0);
  if(hasCurrentCounters||!lastPulse||localDayKey(lastPulse)!==today)return false;

  try{
    const rows=(await readRecentHistory({
      sinceMs:Date.now()-36*60*60*1000,
      limit:HISTORY_RECENT_LIMIT
    })).filter(row=>
      String(row?.type||'')==='viveiro_accounting_reconciled'&&
      String(row?.day_key||'')===today&&
      row?.before&&typeof row.before==='object'
    ).sort((a,b)=>Number(a.ts||0)-Number(b.ts||0));

    const first=rows[0];
    const before=first?.before||null;
    if(!before)return false;

    const recovered={
      started:Math.max(0,Number(before.started||0)),
      completed:Math.max(0,Number(before.completed||0)),
      interrupted:Math.max(0,Number(before.interrupted||0)),
      irrigated:Math.max(0,Number(before.irrigated||0))
    };
    if(!recovered.started&&!recovered.completed&&!recovered.interrupted&&!recovered.irrigated)return false;

    state={
      ...state,
      daily_day_key:today,
      daily_pulses_started:recovered.started,
      daily_pulses_completed:recovered.completed,
      daily_pulses_interrupted:recovered.interrupted,
      daily_irrigated_seconds:recovered.irrigated,
      daily_last_pulse_at:lastPulse,
      accounting_recovery:{
        status:'recovered',
        recovered_at:Date.now(),
        source:'pre_reconciliation_snapshot',
        source_event_at:Number(first.ts||0)||null,
        values:recovered
      }
    };
    await persist();
    console.warn('Contadores do dia recuperados do snapshot anterior à reconciliação',{today,recovered});
    return true;
  }catch(error){
    console.warn('Recuperação dos contadores do dia indisponível:',error?.message||error);
    return false;
  }
}

async function reconcileDailyAccounting({notify=false}={}){
  ensureDailyCounters();
  const before={
    started:Number(state.daily_pulses_started||0),
    completed:Number(state.daily_pulses_completed||0),
    interrupted:Number(state.daily_pulses_interrupted||0),
    irrigated:Number(state.daily_irrigated_seconds||0)
  };

  await flushPendingHistory().catch(()=>null);
  const pending=Array.isArray(state.pending_history_events)?state.pending_history_events.length:0;
  if(pending){
    state={
      ...state,
      accounting_reconciliation:{
        status:'degraded',
        checked_at:Date.now(),
        day_key:localDayKey(),
        pending_history_events:pending,
        message:'Conferência aguardando eventos pendentes do Firebase.'
      }
    };
    await persist().catch(()=>null);
    return state.accounting_reconciliation;
  }

  try{
    const indexMeta=await historyIndexStatus();
    if(!indexMeta?.legacy_backfill_complete){
      state={
        ...state,
        accounting_reconciliation:{
          status:'warming',
          checked_at:Date.now(),
          day_key:localDayKey(),
          message:'Histórico temporal sendo preparado; contadores ao vivo preservados.'
        }
      };
      await persist().catch(()=>null);
      return state.accounting_reconciliation;
    }

    const rows=(await readLocalHistoryFileRange({
      sinceMs:Date.now()-HISTORY_RECENT_WINDOW_MS,
      limit:HISTORY_RECENT_LIMIT
    })).filter(row=>
      String(row?.source||'').includes('viveiro')||String(row?.type||'').startsWith('viveiro_')
    );
    const accounting=pulseAccountingForDay(rows,localDayKey());
    const expected={
      started:Number(accounting.pulses_started||0),
      completed:Number(accounting.pulses_completed||0),
      interrupted:Number(accounting.pulses_interrupted||0),
      unclosed:Number(accounting.orphaned_starts||0),
      irrigated:Number(accounting.irrigated_seconds||0)
    };
    // Eventos identificados por pulse_id são a fonte canônica do dia. Os contadores
    // em memória podem reiniciar em deploy/reboot e não devem substituir evidência física.
    const stateNeedsRepair=
      before.started!==expected.started||before.completed!==expected.completed||
      before.interrupted!==expected.interrupted||Math.abs(before.irrigated-expected.irrigated)>0.25;
    if(stateNeedsRepair){
      state={...state,
        daily_pulses_started:expected.started,
        daily_pulses_completed:expected.completed,
        daily_pulses_interrupted:expected.interrupted,
        daily_irrigated_seconds:expected.irrigated
      };
    }
    state={...state,accounting_reconciliation:{
      status:'ok',checked_at:Date.now(),day_key:accounting.day_key,
      source_of_truth:'pulse_id_events',repaired_state:stateNeedsRepair,
      previous_live:before,history:expected,
      unclosed_starts:expected.unclosed,
      message:stateNeedsRepair
        ?'Contadores restaurados pelos eventos únicos pulse_id; inícios sem encerramento permanecem separados.'
        :'Contadores conferem com os eventos únicos pulse_id.'
    }};
    await persist();

    return state.accounting_reconciliation;
  }catch(error){
    state={
      ...state,
      accounting_reconciliation:{
        status:'degraded',
        checked_at:Date.now(),
        day_key:localDayKey(),
        message:'Não foi possível conferir a contabilidade no Firebase.',
        error:error?.message||String(error)
      }
    };
    await persist().catch(()=>null);
    console.error('Conferência contábil indisponível:',error?.message||error);
    return state.accounting_reconciliation;
  }
}

async function maintenance(){
  try{
    const m=await storeGet(MAINTENANCE_PATH);
    const active=Boolean(m?.enabled&&Number(m?.until||0)>Date.now());
    return{...(m||{}),active};
  }catch{return{active:false}}
}
async function evaluateClimateControl(){
  if(!state.enabled)return;
  try{
    const [cfg,climateState]=await Promise.all([getClimateConfig(),getClimateState()]);
    if(cfg.enabled===false)return;

    // O Automático 4.0 só atua dentro da janela configurada de irrigação.
    // Fora do horário, o clima pode continuar sendo exibido no painel, mas
    // nenhuma sugestão é criada/aprovada/aplicada e o ciclo não é alterado.
    const schedule=localSchedule(state);
    if(!schedule.inside){
      const nextWindowAt=Date.now()+Math.max(0,secondsUntilNextWindow(state))*1000;
      const alreadyOutside=
        String(climateState?.last_decision||'')==='outside_schedule'&&
        Math.abs(Number(climateState?.next_schedule_window_at||0)-Number(nextWindowAt||0))<60000;
      if(!alreadyOutside){
        await patchClimateState({
          pending:null,
          approved_id:null,
          last_decision:'outside_schedule',
          last_decision_at:Date.now(),
          last_operational_decision:'outside_schedule',
          last_operational_decision_at:Date.now(),
          next_schedule_window_at:nextWindowAt||null,
          last_reason:'Automático 4.0 aguardando o horário programado da irrigação.'
        }).catch(()=>null);
      }
      return;
    }

    if(state.paused_by_weather||['weather_blocked','waiting_after_rain'].includes(String(state.phase||'')))return;
    if(Number(state.climate_post_rain_hold_until||0)>Date.now())return;

    const mode=cfg.observation?'observation':cfg.automatic?'automatic':'manual';
    const pending=climateState?.pending||null;

    const clearStalePending=async(reason,eventType='viveiro_climate_suggestion_stale')=>{
      await patchClimateState({
        pending:null,
        approved_id:null,
        last_decision:'pending_cleared',
        last_decision_at:Date.now(),
        last_reason:String(reason||'Sugestão climática antiga removida.')
      });
      await event(eventType,String(reason||'Sugestão climática antiga removida.'));
    };

    if(pending&&String(climateState?.approved_id||'')===String(pending.id||'')){
      const pendingAge=Date.now()-Number(pending.created_at||0);
      if(!Number(pending.created_at)||pendingAge>60*60*1000){
        await clearStalePending(
          'Sugestão aprovada expirou antes de ser aplicada.',
          'viveiro_climate_suggestion_expired'
        );
        return;
      }

      const baseOn=Math.max(1,Number(state.base_on_seconds||state.on_seconds||30));
      const baseOff=Math.max(1,Number(state.base_off_seconds||state.off_seconds||120));
      const currentOn=Math.max(1,Number(state.on_seconds||30));
      const currentOff=Math.max(1,Number(state.off_seconds||120));
      const pendingBaseOn=Number(pending.base_on_seconds||baseOn);
      const pendingBaseOff=Number(pending.base_off_seconds||baseOff);
      const pendingCurrentOn=Number(pending.current_on_seconds||currentOn);
      const pendingCurrentOff=Number(pending.current_off_seconds||currentOff);

      if(
        pendingBaseOn!==baseOn||pendingBaseOff!==baseOff||
        pendingCurrentOn!==currentOn||pendingCurrentOff!==currentOff
      ){
        await clearStalePending(
          'A programação mudou depois que a sugestão foi criada. A sugestão antiga foi descartada.'
        );
        return;
      }

      const currentWeather=await fetchWeatherSnapshot({maxAgeMs:5000}).catch(()=>null);
      if(!currentWeather?.linked||currentWeather?.device?.online===false||!currentWeather?.metrics||currentWeather.metrics.rainDetected){
        await patchClimateState({
          last_decision:'approved_waiting_weather',
          last_decision_at:Date.now()
        });
        return;
      }

      // Revalida a sugestão com uma leitura atual antes de aplicar uma aprovação antiga.
      const freshSamples=updateClimateSamples(climateState?.samples||[],currentWeather,cfg,Date.now());
      const freshTrend=climateTrend(freshSamples,Date.now());
      const freshSuggestion=climateSuggestion(currentWeather,state,cfg,freshTrend);
      const approvedTargetOn=Math.max(1,Math.min(300,Math.round(Number(pending.target_on_seconds)||currentOn)));
      const approvedTargetOff=Math.max(1,Math.min(900,Math.round(Number(pending.target_off_seconds)||currentOff)));
      if(
        !freshSuggestion.useful||
        Number(freshSuggestion.target_on_seconds)!==approvedTargetOn||
        Number(freshSuggestion.target_off_seconds)!==approvedTargetOff
      ){
        await clearStalePending(
          'O clima mudou desde a sugestão. O ajuste aprovado foi descartado e será recalculado.'
        );
        return;
      }

      state={
        ...state,on_seconds:approvedTargetOn,off_seconds:approvedTargetOff,
        climate_adjusted_at:Date.now(),climate_reason:String(pending.reason||'Ajuste climático aprovado.')
      };
      await persist();
      await patchClimateState({
        samples:freshSamples,
        pending:null,approved_id:null,last_applied_at:Date.now(),
        last_applied_from:currentOn,last_applied_to:approvedTargetOn,
        last_applied_off_from:currentOff,last_applied_off_to:approvedTargetOff,
        normal_streak:0,last_reason:String(pending.reason||'Ajuste climático aprovado.'),
        last_decision:'approved_applied',last_decision_at:Date.now()
      });
      await event('viveiro_climate_applied','Ajuste climático aplicado após aprovação.',{
        from_seconds:currentOn,to_seconds:approvedTargetOn,
        from_off_seconds:currentOff,to_off_seconds:approvedTargetOff,
        reason:pending.reason||'',confidence:pending.confidence||''
      });
      await pushNotice(
        'Irrigação ajustada',
        currentOn+'s/'+currentOff+'s → '+approvedTargetOn+'s/'+approvedTargetOff+'s. '+String(pending.reason||''),
        'viveiro-climate-applied-'+Date.now()
      );
      return;
    }

    const lastEval=Number(climateState?.last_evaluated_at||0);
    const sinceLastEval=Math.max(0,Date.now()-lastEval);
    const configuredEvalMs=Math.max(5,Number(cfg.evaluation_minutes||5))*60000;
    if(sinceLastEval<60000)return;

    let snapshot=null;
    if(sinceLastEval<configuredEvalMs){
      snapshot=await fetchWeatherSnapshot({maxAgeMs:5000}).catch(()=>null);
      const liveTemp=Number(snapshot?.metrics?.temperature?.value);
      const liveHumidity=Number(snapshot?.metrics?.humidity?.value);
      const liveVpd=vaporPressureDeficit(liveTemp,liveHumidity);
      const extremeNow=
        Number.isFinite(liveTemp)&&Number.isFinite(liveHumidity)&&(
          liveTemp>=33||
          liveHumidity<=40||
          (Number.isFinite(liveVpd)&&liveVpd>=2.0)
        );
      // Situação normal mantém a cadência configurada. Calor/sequidão fortes
      // podem antecipar uma avaliação, sem ignorar os limites e cooldowns.
      if(!extremeNow)return;
    }

    snapshot=snapshot||await fetchWeatherSnapshot({maxAgeMs:5000}).catch(()=>null);
    const samples=updateClimateSamples(climateState?.samples||[],snapshot||{},cfg,Date.now());
    const trend=climateTrend(samples,Date.now());
    // Histórico divergente nunca pode aumentar confiança nem alimentar aprendizagem automática.
    const accountingTrusted=String(state.accounting_reconciliation?.status||'')==='ok';
    const safeTrend=accountingTrusted?trend:{...trend,confidence:'low',confidence_label:'Baixa'};
    const suggestion=climateSuggestion(snapshot||{},state,cfg,safeTrend);
    const suggestionId=[
      localDayKey(),
      suggestion.base_on_seconds,suggestion.base_off_seconds,
      suggestion.target_on_seconds,suggestion.target_off_seconds,
      suggestion.confidence,suggestion.level
    ].join('-');
    const previousNormal=Math.max(0,Number(climateState?.normal_streak||0));
    const normalCandidate=suggestion.level==='normal'||Boolean(suggestion.returning_to_base);
    const normalStreak=normalCandidate?previousNormal+1:0;

    await patchClimateState({
      samples,
      last_evaluated_at:Date.now(),
      last_climate_evaluated_at:Date.now(),
      last_temperature:suggestion.temperature,
      last_humidity:suggestion.humidity,
      last_vpd:suggestion.vpd,
      last_reason:suggestion.reason,
      last_target_on_seconds:suggestion.target_on_seconds,
      last_target_off_seconds:suggestion.target_off_seconds,
      drying_level:suggestion.level,
      drying_level_label:suggestion.level_label,
      water_factor:suggestion.water_factor,
      confidence:suggestion.confidence,
      confidence_label:suggestion.confidence_label,
      confidence_adjust_limit_percent:suggestion.confidence_adjust_limit_percent,
      effective_adjust_limit_percent:suggestion.effective_adjust_limit_percent,
      extreme_level:suggestion.extreme_level,
      base_on_seconds:suggestion.base_on_seconds,
      base_off_seconds:suggestion.base_off_seconds,
      trend_temperature:trend.temperature,
      trend_humidity:trend.humidity,
      trend_vpd:trend.vpd,
      learning_history_trusted:accountingTrusted,
      trend_vpd_delta:trend.vpd_delta,
      trend_temp_delta:trend.temp_delta,
      trend_humidity_delta:trend.humidity_delta,
      trend_vpd_slope_per_10m:trend.vpd_slope_per_10m,
      trend_temp_slope_per_10m:trend.temp_slope_per_10m,
      trend_humidity_slope_per_10m:trend.humidity_slope_per_10m,
      trend_samples:trend.samples,
      sample_age_minutes:trend.age_minutes,
      temp_range:trend.temp_range,
      humidity_range:trend.humidity_range,
      normal_streak:normalStreak,
      last_mode:mode,
      version:2,
      last_condition_signature:[
        suggestion.level,
        suggestion.extreme_level||'normal'
      ].join(':')
    });

    const conditionSignature=[
      suggestion.level,
      suggestion.extreme_level||'normal'
    ].join(':');
    const previousCondition=String(climateState?.last_condition_signature||'');
    if(
      previousCondition&&
      previousCondition!==conditionSignature&&
      suggestion.confidence!=='low'
    ){
      await event('viveiro_climate_condition',
        'Condição climática mudou para '+String(suggestion.level_label||suggestion.level)+'.',{
          temperature:suggestion.temperature,
          humidity:suggestion.humidity,
          vpd:suggestion.vpd,
          level:suggestion.level,
          extreme_level:suggestion.extreme_level,
          confidence:suggestion.confidence,
          detail:
            String(suggestion.level_label||suggestion.level)+
            ' • '+Number(suggestion.temperature||0).toFixed(1)+' °C'+
            ' • '+Number(suggestion.humidity||0).toFixed(0)+'%'+
            ' • VPD '+Number(suggestion.vpd||0).toFixed(2)+' kPa'
        }
      );
    }

    console.log('Automatico 4.0 evaluation',{
      mode,
      useful:Boolean(suggestion.useful),
      level:suggestion.level,
      confidence:suggestion.confidence,
      samples:trend.samples,
      temperature:suggestion.temperature==null?null:Number(suggestion.temperature.toFixed?.(1)??suggestion.temperature),
      humidity:suggestion.humidity==null?null:Number(suggestion.humidity.toFixed?.(0)??suggestion.humidity),
      vpd:suggestion.vpd==null?null:Number(suggestion.vpd.toFixed?.(2)??suggestion.vpd),
      base:String(suggestion.base_on_seconds)+'/'+String(suggestion.base_off_seconds),
      current:String(suggestion.current_on_seconds)+'/'+String(suggestion.current_off_seconds),
      target:String(suggestion.target_on_seconds)+'/'+String(suggestion.target_off_seconds),
      effectiveLimitPercent:Number(suggestion.effective_adjust_limit_percent||suggestion.confidence_adjust_limit_percent||0),
      extremeLevel:String(suggestion.extreme_level||'normal')
    });

    if(!suggestion.useful){
      if(pending){
        await patchClimateState({
          pending:null,
          approved_id:null,
          last_decision:'no_change_pending_cleared',
          last_decision_at:Date.now()
        });
      }else{
        await patchClimateState({last_decision:'no_change',last_decision_at:Date.now()});
      }
      return;
    }

    if(cfg.observation){
      if(pending){
        await patchClimateState({pending:null,approved_id:null});
      }
      const sameObservation=String(climateState?.last_observation_id||'')===String(suggestionId);
      await patchClimateState({last_decision:'observation',last_decision_at:Date.now()});
      if(!sameObservation){
        await patchClimateState({last_observation_id:suggestionId,last_observation_at:Date.now()});
        await event('viveiro_climate_observation','Automático 4.0 em observação: ajuste identificado sem alterar o ciclo.',{
          from_seconds:suggestion.current_on_seconds,to_seconds:suggestion.target_on_seconds,
          from_off_seconds:suggestion.current_off_seconds,to_off_seconds:suggestion.target_off_seconds,
          temperature:suggestion.temperature,humidity:suggestion.humidity,vpd:suggestion.vpd,
          confidence:suggestion.confidence,reason:suggestion.reason
        });
      }
      return;
    }

    const queueSuggestion=async(reasonTag='manual')=>{
      const samePending=String(pending?.id||'')===String(suggestionId);
      const alreadyRejected=String(climateState?.rejected_id||'')===String(suggestionId);
      if(samePending||alreadyRejected)return;
      const newPending={
        id:suggestionId,created_at:Date.now(),
        base_on_seconds:suggestion.base_on_seconds,base_off_seconds:suggestion.base_off_seconds,
        current_on_seconds:suggestion.current_on_seconds,current_off_seconds:suggestion.current_off_seconds,
        target_on_seconds:suggestion.target_on_seconds,target_off_seconds:suggestion.target_off_seconds,
        temperature:suggestion.temperature,humidity:suggestion.humidity,vpd:suggestion.vpd,
        level:suggestion.level,level_label:suggestion.level_label,
        confidence:suggestion.confidence,confidence_label:suggestion.confidence_label,
        confidence_adjust_limit_percent:suggestion.confidence_adjust_limit_percent,
        effective_adjust_limit_percent:suggestion.effective_adjust_limit_percent,
        extreme_level:suggestion.extreme_level,
        reason:suggestion.reason,returning_to_base:Boolean(suggestion.returning_to_base),
        requires_confirmation:true,reason_tag:reasonTag
      };
      await patchClimateState({
        pending:newPending,approved_id:null,
        last_decision:'pending_confirmation',last_decision_at:Date.now()
      });
      await event('viveiro_climate_suggestion','Sugestão do Automático 4.0 aguardando aprovação.',newPending);
      await pushNotice(
        'Sugestão de ajuste no viveiro',
        suggestion.current_on_seconds+'s/'+suggestion.current_off_seconds+'s → '+
        suggestion.target_on_seconds+'s/'+suggestion.target_off_seconds+'s. '+newPending.reason,
        'viveiro-climate-suggest-'+suggestionId
      );
    };

    const lowConfidence=suggestion.confidence==='low';
    const configuredCooldownMinutes=Math.max(20,Number(cfg.cooldown_minutes||30));
    const extremeLevel=String(suggestion.extreme_level||'normal');
    const dryingIncrease=
      Number(suggestion.target_off_seconds||0)<Number(suggestion.current_off_seconds||0);
    let effectiveCooldownMinutes=configuredCooldownMinutes;
    if(suggestion.confidence==='high'&&dryingIncrease){
      if(extremeLevel==='critico')effectiveCooldownMinutes=Math.min(configuredCooldownMinutes,10);
      else if(extremeLevel==='severo')effectiveCooldownMinutes=Math.min(configuredCooldownMinutes,15);
      else if(extremeLevel==='quente_seco')effectiveCooldownMinutes=Math.min(configuredCooldownMinutes,20);
    }
    const cooldownMs=effectiveCooldownMinutes*60000;
    const baseOffForCatchup=Math.max(1,Number(suggestion.base_off_seconds||state.base_off_seconds||120));
    const criticalCatchup=
      suggestion.confidence==='high'&&
      extremeLevel==='critico'&&
      dryingIncrease&&
      Number(suggestion.current_off_seconds||baseOffForCatchup)>=baseOffForCatchup*.95;
    const cooldownActive=
      !criticalCatchup&&
      Date.now()-Number(climateState?.last_applied_at||0)<cooldownMs;

    if(cfg.automatic){
      // No Automático, confiança baixa não é ignorada: vira sugestão para confirmação.
      if(lowConfidence){
        await queueSuggestion('automatic_low_confidence');
        return;
      }
      if(suggestion.returning_to_base&&normalStreak<Math.max(2,Number(cfg.normal_confirmations||2))){
        await patchClimateState({
          last_decision:'waiting_normal_confirmation',
          last_decision_at:Date.now()
        });
        return;
      }
      if(cooldownActive){
        await patchClimateState({
          last_decision:'cooldown',
          last_decision_at:Date.now(),
          next_automatic_change_at:Number(climateState?.last_applied_at||0)+cooldownMs
        });
        return;
      }

      const oldOn=Math.max(1,Number(state.on_seconds||30));
      const oldOff=Math.max(1,Number(state.off_seconds||120));
      const targetOn=Math.max(1,Math.min(300,Math.round(Number(suggestion.target_on_seconds)||oldOn)));
      const targetOff=Math.max(1,Math.min(900,Math.round(Number(suggestion.target_off_seconds)||oldOff)));
      if(targetOn===oldOn&&targetOff===oldOff){
        await patchClimateState({last_decision:'no_change',last_decision_at:Date.now()});
        return;
      }

      state={
        ...state,
        on_seconds:targetOn,off_seconds:targetOff,
        climate_adjusted_at:Date.now(),climate_reason:suggestion.reason,
        climate_vpd:suggestion.vpd,climate_level:suggestion.level
      };
      await persist();
      await patchClimateState({
        pending:null,approved_id:null,rejected_id:null,last_applied_at:Date.now(),
        last_applied_from:oldOn,last_applied_to:targetOn,
        last_applied_off_from:oldOff,last_applied_off_to:targetOff,
        last_reason:suggestion.reason,automatic:true,confidence:suggestion.confidence,
        normal_streak:0,version:2,
        last_decision:'automatic_applied',last_decision_at:Date.now(),
        next_automatic_change_at:Date.now()+cooldownMs,
        effective_cooldown_minutes:effectiveCooldownMinutes,
        effective_adjust_limit_percent:suggestion.effective_adjust_limit_percent,
        extreme_level:suggestion.extreme_level
      });
      const type=suggestion.returning_to_base?'viveiro_climate_return_base':'viveiro_climate_auto_change';
      await event(type,suggestion.returning_to_base?'Automático 4.0 retornou ao ciclo-base.':'Automático 4.0 ajustou o intervalo pelo clima.',{
        from_seconds:oldOn,to_seconds:targetOn,from_off_seconds:oldOff,to_off_seconds:targetOff,
        temperature:suggestion.temperature,humidity:suggestion.humidity,vpd:suggestion.vpd,
        water_factor:suggestion.water_factor,level:suggestion.level,
        confidence:suggestion.confidence,reason:suggestion.reason
      });
      // Ajustes automáticos normais ficam na linha do tempo. Só viram alerta
      // quando a condição climática chegou ao nível crítico.
      if(String(suggestion.extreme_level||'')==='critico'){
        await pushNotice(
          'Calor crítico • irrigação ajustada',
          oldOn+'s ligado / '+oldOff+'s intervalo → '+targetOn+'s / '+targetOff+'s. '+
            'VPD '+Number(suggestion.vpd||0).toFixed(2)+' kPa. O Automático 4.0 aumentou a irrigação.',
          'viveiro-climate-critical-'+suggestionId,
          'warning',
          30,
          true
        );
      }
      return;
    }

    await queueSuggestion('manual');
  }catch(error){
    console.warn('climate control:',error?.message||error);
  }
}

async function persist(){
  // Mantém somente o prazo que pertence à fase atual.
  // Isso impede um horário antigo de uma fase anterior virar falso atraso na interface.
  state={
    ...state,
    state_updated_at:Date.now(),
    expected_off_at:String(state.phase||'')==='on'?Number(state.expected_off_at||0):0,
    expected_next_on_at:String(state.phase||'')==='off'?Number(state.expected_next_on_at||0):0
  };
  // Envia para a tela imediatamente. Persistência local/Firebase acontece em seguida
  // e não segura mais a atualização visual.
  publishLive('seconds',{state:publicSecondsState(state)});

  let localOk=false;
  try{
    await fs.mkdir(path.dirname(STATE_FILE),{recursive:true});
    await fs.writeFile(STATE_FILE,JSON.stringify(state,null,2),'utf8');
    localOk=true;
  }catch(error){
    console.warn('seconds local persist indisponível:',error?.message||error);
  }

  const shouldTryRemote=remoteStoreAvailable!==false||Date.now()>=Number(remoteStoreRetryAt||0);
  if(shouldTryRemote){
    try{
      await storeSet(REMOTE_STATE_PATH,state);
      remoteStoreAvailable=true;
      remoteStoreRetryAt=0;
    }catch(error){
      console.warn('seconds Firebase persist indisponível:',error?.message||error);
      remoteStoreAvailable=false;
      remoteStoreRetryAt=Date.now()+30000;
    }
  }

  return localOk||remoteStoreAvailable===true;
}

async function load(){
  if(remoteStoreAvailable!==false||Date.now()>=Number(remoteStoreRetryAt||0)){
    try{
      const remote=await storeGet(REMOTE_STATE_PATH);
      if(remote&&typeof remote==='object'){
        // Prefer the newest state. Firebase can lag behind the local controller
        // after a restart/deploy and must not resurrect an old stopped_external.
        let local=null;
        try{local=JSON.parse(await fs.readFile(STATE_FILE,'utf8'))}catch{}
        const remoteAt=Number(remote.state_updated_at||remote.server_read_at||0);
        const localAt=Number(local?.state_updated_at||local?.server_read_at||0);
        state=(local&&typeof local==='object'&&localAt>remoteAt)?local:remote;
        remoteStoreAvailable=true;
        remoteStoreRetryAt=0;
        return;
      }
      remoteStoreAvailable=true;
      remoteStoreRetryAt=0;
    }catch(error){
      console.warn('seconds Firebase load indisponível:',error?.message||error);
      remoteStoreAvailable=false;
      remoteStoreRetryAt=Date.now()+30000;
    }
  }

  try{
    const raw=await fs.readFile(STATE_FILE,'utf8');
    const parsed=JSON.parse(raw);
    if(parsed&&typeof parsed==='object')state=parsed;
  }catch{}
}

function rainAmountMm(metrics={}){
  const values=[metrics.rain24h,metrics.rainToday,metrics.rainGeneric].map(x=>Number(x?.value)).filter(Number.isFinite);
  return values.length?Math.max(...values):null;
}

async function weather(){
  const cfg=(await storeGet(WEATHER_CONFIG_PATH).catch(()=>null))||{};
  if(cfg.enabled===false){
    return{
      usable:true,
      raining:false,
      rainingNow:false,
      rainMm:null,
      thresholdReached:false,
      protectionEnabled:false,
      resumeDelayMinutes:Math.max(0,Number(cfg?.resumeDelayMinutes??state.resume_delay_minutes??0)),
      snapshot:null
    };
  }

  try{
    const w=await fetchWeatherSnapshot({maxAgeMs:5000});
    const rainMm=rainAmountMm(w?.metrics||{});
    const threshold=Math.max(0,Number(cfg?.rainThresholdMm??5));
    const rainingNow=Boolean(w?.metrics?.rainDetected);
    const thresholdReached=threshold>0&&Number.isFinite(rainMm)&&rainMm>=threshold;
    return{
      usable:Boolean(w?.linked&&w?.metrics&&w?.device?.online!==false),
      raining:Boolean(rainingNow&&(cfg?.blockWhileRaining!==false||thresholdReached)),
      rainingNow,
      rainMm,
      thresholdReached,
      protectionEnabled:true,
      resumeDelayMinutes:Math.max(0,Number(cfg?.resumeDelayMinutes??state.resume_delay_minutes??0)),
      snapshot:w
    };
  }catch(error){
    return{usable:false,raining:false,protectionEnabled:true,error:error?.message||String(error)};
  }
}

async function safeOff(reason='safety'){
  const requestedAt=Date.now();
  try{
    let result=null;
    try{
      result=await setViveiroRelay(false,{attempts:10,source:'seconds_manager',reason:String(reason||'safety')});
    }catch(firstError){
      // Segunda tentativa independente: OFF é sempre o comando de maior prioridade.
      await sleep(250);
      result=await setViveiroRelay(false,{attempts:10,source:'seconds_manager',reason:String(reason||'safety')});
    }
    const confirmedAt=Number(result?.confirmed_at||Date.now());
    addConfirmationLatencySample(
      'off',
      Number(result?.confirmation_latency_ms||0),
      String(result?.confirmed_by||'unknown'),
      confirmedAt
    );
    state={
      ...state,
      device_relay:false,
      relay_expected:false,
      last_command:'off',
      last_command_at:Number(result?.command_sent_at||requestedAt),
      last_command_reason:String(reason||'safety'),
      last_confirmation_at:confirmedAt,
      last_confirmation_latency_ms:Number(result?.confirmation_latency_ms||0),
      last_confirmation_source:String(result?.confirmed_by||'unknown'),
      last_off_confirmed_at:confirmedAt,
      watchdog:{
        status:'ok',
        checked_at:confirmedAt,
        reason:String(reason||'safety'),
        message:'Saída R1 OFF confirmada pelo ESP32.'
      }
    };
    publishLive('confirmation',{
      command:'off',
      requested_at:requestedAt,
      confirmed_at:confirmedAt,
      latency_ms:Number(result?.confirmation_latency_ms||0),
      source:String(result?.confirmed_by||'unknown'),
      reason:String(reason||'safety')
    });
    return true;
  }catch(error){
    const failedAt=Date.now();
    state={
      ...state,
      relay_expected:false,
      last_command:'off',
      last_command_at:requestedAt,
      watchdog:{
        status:'critical',
        checked_at:failedAt,
        reason:String(reason||'safety'),
        message:'R1 OFF não confirmado pelo ESP32.',
        error:error?.message||String(error)
      }
    };
    publishLive('watchdog',{status:'critical',at:failedAt,reason:String(reason||'safety'),error:error?.message||String(error)});
    console.error('safeOff',error?.message||error);
    await pushNotice(
      'ALERTA • desligamento não confirmado',
      'O servidor mandou desligar o viveiro, mas não recebeu confirmação do R1 OFF pelo ESP32. Verifique o controlador.',
      'viveiro-watchdog-off',
      'critical',
      5,
      true
    );
    return false;
  }
}

async function safetyCountdown(seconds){
  // Best effort: alguns EKAZA expõem countdown_1. O laço do servidor continua
  // sendo o controlador principal; o countdown serve apenas como proteção extra.
  try{
    const { sendViveiroCommands } = await import('../api/_viveiro_transport.js');
    await sendViveiroCommands([
      {code:'countdown_1',value:Math.max(1,Math.round(Number(seconds)||30))}
    ]);
    return true;
  }catch{
    return false;
  }
}

function activeWindowStartAt(schedule){
  if(!schedule?.inside)return 0;
  const elapsed=Math.max(0,Number(schedule.now_seconds||0)-Number(schedule.start_seconds||0));
  return Math.floor((Date.now()-elapsed*1000)/60000)*60000;
}
async function active(force=false){
  if(!state.enabled)return false;
  const now=Date.now();
  if(!force&&ownershipCheckedAt&&now-ownershipCheckedAt<3000){
    return ownershipActive;
  }
  ownershipCheckedAt=now;
  ownershipActive=Boolean(await pulseStillActive(state,{force:true}).catch(()=>false));
  return ownershipActive;
}

async function finishAndRestore(reason='stopped'){
  const previous={...state};
  state={...state,enabled:false,phase:reason,relay_expected:false,stopped_at:Date.now()};
  await persist();
  await event('viveiro_cycle_stop','Ciclo rápido encerrado.',{reason});
  await stopServerPulse({
    restoreNative:false,
    nativeCycleRaw:previous.native_cycle_raw||'',
    disabledCycleRaw:previous.disabled_cycle_raw||''
  }).catch(async()=>{await safeOff()});
  return state;
}

async function activateEkazaFailover(){
  if(state.failover_active)return true;
  if(!state.native_cycle_raw||state.native_cycle_was_enabled===false)return false;
  await writeViveiroCycle(state.native_cycle_raw);
  const check=await readViveiroDevice({force:true,maxAgeMs:0});
  if(String(check?.cycleRaw||'')!==String(state.native_cycle_raw||''))throw new Error('EKAZA não confirmou a programação de contingência.');
  state={...state,failover_active:true,control_owner:'ekaza_failover',failover_started_at:Date.now(),relay_expected:false,last_error:'ESP32 indisponível; EKAZA assumiu a programação de contingência.'};
  await persist();
  await event('viveiro_ekaza_failover_start','ESP32 permaneceu offline. EKAZA assumiu a programação de segurança.',{confirm_ms:EKAZA_FAILOVER_CONFIRM_MS});
  await pushNotice('Contingência ativa • Fazenda 2E','ESP32 ficou offline por 60 s. O EKAZA assumiu a programação de segurança.','viveiro-ekaza-failover','critical',5,true);
  return true;
}
async function reclaimEspPrimary(){
  if(!state.failover_active)return true;
  if(!state.disabled_cycle_raw)throw new Error('Programação segura do EKAZA não encontrada para devolver controle ao ESP32.');
  await writeViveiroCycle(state.disabled_cycle_raw);
  const check=await readViveiroDevice({force:true,maxAgeMs:0});
  if(String(check?.cycleRaw||'')!==String(state.disabled_cycle_raw||''))throw new Error('EKAZA não confirmou saída da contingência.');
  state={...state,failover_active:false,control_owner:'esp32_primary',controller_offline_since:0,failover_recovered_at:Date.now(),phase:'starting',last_error:null};
  await persist();
  await event('viveiro_ekaza_failover_end','ESP32 voltou e foi confirmado. EKAZA saiu da contingência antes da retomada do ESP32.');
  await pushNotice('ESP32 recuperado • Fazenda 2E','EKAZA foi desativado e confirmado. O controle voltou com segurança ao ESP32.','viveiro-esp32-recovered','info',5,true);
  return true;
}

async function run(){
  while(state.enabled){
    if(await emergencyLatched().catch(()=>false)){
      await safeOff('emergency');
      state={...state,enabled:false,phase:'emergency_stopped',relay_expected:false,last_error:null,emergency_stopped_at:Date.now()};
      await persist();
      await event('viveiro_emergency_stop','Parada de emergência manteve o ciclo rápido desligado.');
      break;
    }

    if(!(await active())){
      // Heartbeat isolado não transfere autoridade. O EKAZA só assume após
      // indisponibilidade contínua confirmada por 60 s.
      await safeOff('controller_unavailable').catch(()=>false);
      const firstOffline=!Number(state.controller_offline_since||0);
      const offlineSince=Number(state.controller_offline_since||Date.now());
      state={...state,phase:state.failover_active?'ekaza_failover':'controller_unavailable',control_owner:state.failover_active?'ekaza_failover':'none',controller_offline_since:offlineSince,relay_expected:false,last_error:state.failover_active?'ESP32 offline; EKAZA em contingência.':'Aguardando confirmação da indisponibilidade do ESP32.'};
      await persist();
      if(firstOffline)await pushNotice('ESP32 sem comunicação • Fazenda 2E','Aguardando 60 s de confirmação antes de liberar a contingência EKAZA.','viveiro-esp32-offline','warning',5,true);
      if(!state.failover_active&&Date.now()-offlineSince>=EKAZA_FAILOVER_CONFIRM_MS){
        await activateEkazaFailover().catch(async error=>{
          state={...state,last_error:'Falha ao ativar contingência EKAZA: '+(error?.message||error)};
          await persist();
        });
      }
      await sleep(3000);
      continue;
    }

    // O ESP32 nunca retoma enquanto o EKAZA ainda possui a programação ativa.
    // Primeiro desabilita e confirma o EKAZA; somente depois R1 volta a ter autoridade.
    if(state.failover_active){
      try{await reclaimEspPrimary()}catch(error){
        state={...state,phase:'failover_reclaim_wait',control_owner:'ekaza_failover',relay_expected:false,last_error:'Aguardando EKAZA confirmar devolução do controle: '+(error?.message||error)};
        await persist();await sleep(3000);continue;
      }
    }else if(state.controller_offline_since){
      state={...state,controller_offline_since:0,control_owner:'esp32_primary',last_error:null};
      await persist();
    }else if(state.control_owner!=='esp32_primary'){
      state={...state,control_owner:'esp32_primary'};
      await persist();
    }

    const maint=await maintenance();
    if(maint.active){
      await safeOff('maintenance');
      const wasMaintenance=state.phase==='maintenance';
      state={...state,phase:'maintenance',relay_expected:false,maintenance_until:Number(maint.until||0),last_error:null};
      await persist();
      if(!wasMaintenance)await event('viveiro_maintenance_start','Modo manutenção ativo.',{until:Number(maint.until||0)});
      await sleep(10000);
      continue;
    }else if(state.phase==='maintenance'){
      state={...state,phase:'starting',maintenance_until:0};
      await persist();
      await event('viveiro_maintenance_end','Modo manutenção encerrado.');
    }

    await evaluateClimateControl();

    const schedule=localSchedule(state);
    if(!schedule.inside){
      await safeOff('outside_schedule');
      const waitSeconds=secondsUntilNextWindow(state);
      const wasWaiting=state.phase==='waiting_window';
      state={
        ...state,
        phase:'waiting_window',
        relay_expected:false,
        on_seconds:Number(state.base_on_seconds||state.on_seconds||30),
        off_seconds:Number(state.base_off_seconds||state.off_seconds||120),
        climate_reason:'Fora do horário: ciclo-base restaurado até a próxima janela.',
        expected_off_at:0,
        expected_next_on_at:0,
        next_window_at:Date.now()+waitSeconds*1000,
        last_error:null
      };
      await persist();
      if(!wasWaiting){
        await event('viveiro_waiting_window','Ciclo rápido aguardando o próximo horário de início.',{
          next_window_at:state.next_window_at
        });
      }
      await sleep(Math.min(30000,Math.max(5000,waitSeconds*1000)));
      continue;
    }

    const windowStartAt=activeWindowStartAt(schedule);
    if(Number(state.active_window_start_at||0)!==windowStartAt){
      state={
        ...state,
        active_window_start_at:windowStartAt,
        first_pulse_window_at:0,
        start_alert_window_at:0
      };
      await persist();
    }

    if(state.next_window_at){
      state={...state,next_window_at:0,phase:'starting'};
      await persist();
      await event('viveiro_window_start','Horário de início atingido. Ciclo rápido liberado.',{
        window_start_at:windowStartAt
      });
    }

    const w=await weather();
    if(!w.usable){
      const firstUnavailable=state.phase!=='weather_unavailable';
      await safeOff();
      state={...state,phase:'weather_unavailable',relay_expected:false,last_error:'Weather2-2 sem dados.'};
      await persist();
      if(firstUnavailable){
        await event('viveiro_weather_unavailable','Weather2-2 ficou indisponível. Irrigação mantida desligada por segurança.');
        await pushNotice(
          'Atenção • sensor climático offline',
          'A Weather2-2 ficou sem dados. Por segurança, o viveiro foi mantido desligado até o sensor voltar.',
          'viveiro-weather-unavailable',
          'critical',
          30,
          true
        );
      }
      await sleep(30000);
      continue;
    }

    if(state.phase==='weather_unavailable'){
      await event('viveiro_weather_recovered','Weather2-2 voltou a responder.');
      await pushNotice(
        'Sensor climático recuperado',
        'A Weather2-2 voltou a responder. O sistema vai retomar conforme chuva, horário e proteção configurados.',
        'viveiro-weather-recovered',
        'info',
        20,
        true
      );
    }

    if(w.raining){
      const firstRainPause=state.phase!=='weather_blocked';
      await safeOff();
      state={
        ...state,
        phase:'weather_blocked',
        relay_expected:false,
        paused_by_weather:true,
        rain_last_at:Date.now(),
        last_error:null
      };
      await persist();
      if(firstRainPause){
        await event('viveiro_weather_pause','Irrigação pausada por chuva.',{rain_mm:w.rainMm});
        await pushNotice('Viveiro pausado pela chuva','A Weather2-2 detectou chuva e a irrigação foi pausada.','viveiro-rain-'+localDayKey(),'warning');
      }
      await sleep(30000);
      continue;
    }

    // Usa a configuração de chuva atual, sem exigir rearmar o ciclo quando
    // o usuário altera o tempo de retomada no aplicativo.
    const holdMs=Math.max(0,Number(w.resumeDelayMinutes??state.resume_delay_minutes??0))*60000;
    const rainLast=Number(state.rain_last_at||0);
    if(rainLast&&Date.now()<rainLast+holdMs){
      await safeOff();
      state={...state,phase:'waiting_after_rain',relay_expected:false,paused_by_weather:true};
      await persist();
      await sleep(Math.min(30000,Math.max(5000,rainLast+holdMs-Date.now())));
      continue;
    }

    const resumedFromRain=Boolean(state.paused_by_weather||state.phase==='waiting_after_rain'||state.phase==='weather_blocked');
    if(resumedFromRain){
      const cc=await getClimateConfig().catch(()=>({post_rain_hold_minutes:30}));
      state={
        ...state,
        paused_by_weather:false,phase:'starting',last_error:null,
        on_seconds:Number(state.base_on_seconds||30),
        off_seconds:Number(state.base_off_seconds||120),
        climate_post_rain_hold_until:Date.now()+Math.max(15,Number(cc.post_rain_hold_minutes||30))*60000,
        climate_reason:'Pós-chuva: ciclo-base mantido antes de novos ajustes.'
      };
      await persist();
      await event('viveiro_weather_resume','Proteção por chuva liberada. Retomada no ciclo-base antes de novos ajustes climáticos.');
      await pushNotice(
        'Viveiro liberado após chuva',
        'A irrigação foi liberada no ciclo-base '+Number(state.base_on_seconds||state.on_seconds||30)+' s ligado / '+Number(state.base_off_seconds||state.off_seconds||120)+' s desligado. O Automático 4.0 aguardará novas leituras antes de ajustar novamente.',
        'viveiro-rain-resume-'+localDayKey(),
        'info',
        20,
        true
      );
    }else{
      state={...state,paused_by_weather:false,phase:'starting',last_error:null};
      await persist();
    }

    if(!state.first_pulse_at&&!state.start_delay_alerted&&state.window_opened_at&&Date.now()>Number(state.window_opened_at)+30000){
      state={...state,start_delay_alerted:true};
      await persist();
      await event('viveiro_start_delay','Ciclo não confirmou o primeiro pulso em até 30 segundos após o horário de início.');
      await pushNotice('Atenção • viveiro não iniciou','O primeiro pulso não foi confirmado em até 30 segundos após o horário programado.','viveiro-start-delay-'+String(state.window_day_key||localDayKey()),'critical');
    }
    const maxOn=Math.max(1,Math.min(
      Number(state.on_seconds||30),
      localSchedule(state).seconds_until_end||Number(state.on_seconds||30)
    ));

    let relayOnAt=0;
    let relayOnCommandAt=0;
    let pulseId='';
    try{
      const previousOffConfirmedAt=Number(state.last_off_confirmed_at||0);
      const onResult=await setViveiroRelay(true,{attempts:30,source:'seconds_manager',reason:'pulse_start'});
      relayOnAt=Number(onResult?.confirmed_at||Date.now());
      relayOnCommandAt=Number(onResult?.command_sent_at||onResult?.command_started_at||relayOnAt);
      addConfirmationLatencySample(
        'on',
        Number(onResult?.confirmation_latency_ms||0),
        String(onResult?.confirmed_by||'unknown'),
        relayOnAt
      );
      const scheduledOnAt=Number(state.expected_next_on_at||0);
      if(scheduledOnAt>0){
        addSchedulerPrecisionSample(
          'on_command',
          scheduledOnAt,
          Number(onResult?.command_sent_at||onResult?.command_started_at||relayOnAt),
          relayOnAt
        );
      }
      pulseId='pulse-'+localDayKey(relayOnAt).replaceAll('-','')+'-'+relayOnAt+'-'+randomUUID().slice(0,8);
      if(previousOffConfirmedAt>0&&relayOnAt>previousOffConfirmedAt){
        addPrecisionSample('interval',Number(state.off_seconds||120)*1000,relayOnAt-previousOffConfirmedAt,relayOnAt);
      }
      ensureDailyCounters(relayOnAt);
      state={
        ...state,
        device_relay:true,
        last_command:'on',
        last_command_at:Number(onResult?.command_sent_at||relayOnAt),
        last_confirmation_at:relayOnAt,
        last_confirmation_latency_ms:Number(onResult?.confirmation_latency_ms||0),
        last_confirmation_source:String(onResult?.confirmed_by||'unknown'),
        last_on_confirmed_at:relayOnAt,
        current_pulse_id:pulseId,
        daily_pulses_started:Number(state.daily_pulses_started||0)+1,
        daily_last_pulse_at:relayOnAt,
        start_recovery_attempts:0,
        last_physical_ack_at:relayOnAt,
        last_physical_ack_attempts:Number(onResult?.attempts_used||0),
        watchdog:{status:'ok',checked_at:relayOnAt,reason:'pulse_start',message:'R1 ON confirmado fisicamente pelo ESP32.'}
      };
      publishLive('confirmation',{
        command:'on',
        requested_at:Number(onResult?.command_started_at||relayOnAt),
        confirmed_at:relayOnAt,
        latency_ms:Number(onResult?.confirmation_latency_ms||0),
        source:String(onResult?.confirmed_by||'unknown'),
        reason:'pulse_start'
      });
      // O countdown nativo é uma proteção extra. Não bloqueia o relógio local:
      // a latência da nuvem jamais pode prolongar um pulso.
      // EKAZA must remain fully passive while ESP32 owns the nursery cycle.
      // Do not arm countdown_1: on this controller it can interfere with/invert the pump cycle.
      // R1/ESP32 watchdog is the active pulse safety layer.
    }catch(error){
      await safeOff('start_failure');
      const expectedFrom=Math.max(Number(windowStartAt||0),Number(state.configured_at||0));
      const late=Date.now()-expectedFrom>=30000;
      const shouldAlert=late&&Number(state.start_alert_window_at||0)!==Number(windowStartAt||0)&&!Number(state.first_pulse_window_at||0);
      const recoveryAttempts=Number(state.start_recovery_attempts||0)+1;
      state={
        ...state,
        phase:'retry_wait',
        relay_expected:false,
        start_recovery_attempts:recoveryAttempts,
        last_recovery_at:Date.now(),
        last_recovery_reason:'r1_on_not_confirmed',
        last_error:error?.message||String(error),
        watchdog:{
          status:recoveryAttempts>=3?'critical':'recovering',
          checked_at:Date.now(),
          reason:'r1_on_not_confirmed',
          attempts:recoveryAttempts,
          message:recoveryAttempts>=3
            ?'R1 não confirmou após 3 tentativas de recuperação; novas tentativas seguras continuarão sem ignorar os intertravamentos.'
            :'R1 não confirmou; Guardian fará nova tentativa segura.'
        },
        ...(shouldAlert?{start_alert_window_at:windowStartAt}: {})
      };
      await persist();
      if(recoveryAttempts===3){
        await event('viveiro_physical_ack_critical','Guardian atingiu 3 falhas consecutivas de confirmação física do R1.',{
          attempts:recoveryAttempts,error:state.last_error
        });
        await pushNotice(
          'Falha crítica • confirmação do R1',
          'O ESP32 não confirmou o acionamento do viveiro após 3 tentativas. O Guardian continuará tentando somente enquanto todas as proteções permitirem.',
          'viveiro-r1-ack-critical-'+String(windowStartAt||localDayKey()),
          'critical',20,true
        );
      }
      if(shouldAlert){
        await event('viveiro_start_failure','Alerta: o ciclo não iniciou até 30 segundos após o horário esperado.',{
          window_start_at:windowStartAt,
          error:state.last_error
        });
        await pushNotice(
          'Falha ao iniciar irrigação',
          'O viveiro não confirmou o primeiro pulso no horário esperado. '+String(state.last_error||''),
          'viveiro-start-failure-'+String(windowStartAt||localDayKey()),
          'critical',
          20,
          true
        );
      }else{
        await event('viveiro_error','Falha ao ligar o viveiro.',{error:state.last_error});
      }
      await sleep(10000);
      continue;
    }

    const expectedFrom=Math.max(Number(windowStartAt||0),Number(state.configured_at||0));
    const firstPulseOfWindow=!Number(state.first_pulse_window_at||0);
    const delayed=firstPulseOfWindow&&Date.now()-expectedFrom>=30000;
    state={
      ...state,
      phase:'on',
      relay_expected:true,
      pulse_started_at:relayOnAt||Date.now(),
      current_pulse_id:pulseId,
      // O tempo de água começa quando o ESP32 confirma R1 fisicamente ON.
      // Latência entre envio e confirmação não pode encurtar o pulso.
      expected_off_at:(relayOnAt||Date.now())+maxOn*1000,
      first_pulse_window_at:Number(state.first_pulse_window_at||0)||(relayOnAt||Date.now()),
      ...(delayed&&Number(state.start_alert_window_at||0)!==Number(windowStartAt||0)?{start_alert_window_at:windowStartAt}: {})
    };
    await persist();
    if(delayed){
      await event('viveiro_start_delay','Alerta: o primeiro pulso iniciou com mais de 30 segundos de atraso.',{
        window_start_at:windowStartAt,
        pulse_started_at:state.pulse_started_at,
        pulse_id:pulseId
      });
      await pushNotice(
        'Irrigação iniciou com atraso',
        'O primeiro pulso foi confirmado, mas iniciou com mais de 30 segundos de atraso.',
        'viveiro-start-delay-'+String(windowStartAt||localDayKey()),
        'warning',
        20,
        true
      );
    }
    await event('viveiro_pulse_start','Pulso de irrigação iniciado.',{
      pulse_id:pulseId,
      pulse_started_at:state.pulse_started_at,
      duration_seconds:maxOn,
      first_of_window:firstPulseOfWindow
    });
    if(firstPulseOfWindow&&!delayed){
      await pushNotice(
        'Irrigação iniciada',
        'Primeiro pulso confirmado. Ciclo atual: '+Number(state.on_seconds||30)+' s ligado / '+Number(state.off_seconds||120)+' s desligado.',
        'viveiro-window-start-'+String(windowStartAt||localDayKey()),
        'info',
        20,
        true
      );
    }

    let interrupted=false;
    const onDeadline=Number(state.expected_off_at||0)||(Date.now()+maxOn*1000);
    while(state.enabled){
      const remainingMs=onDeadline-Date.now();
      if(remainingMs<=0)break;
      await sleep(Math.min(1000,remainingMs));

      // Se o prazo terminou durante o sleep, desliga sem fazer nenhuma consulta
      // de rede antes. Isso evita que Weather/Smart Life prolonguem o pulso.
      if(Date.now()>=onDeadline)break;
      // Durante um pulso curto, nenhuma chamada de rede pode ficar no caminho do OFF.
      // Chuva, ownership e Weather2-2 são verificados antes de ligar e novamente no
      // intervalo. Assim, mesmo com Smart Life lenta, o comando OFF sai no prazo local.
      if(!localSchedule(state).inside){interrupted=true;break}
    }

    const offRequestedAt=Date.now();
    const offConfirmed=await safeOff(interrupted?'pulse_interrupted':'pulse_deadline');
    if(!interrupted&&onDeadline>0){
      // Mede o disparo local real do OFF, não um timestamp compartilhado por outros comandos.
      addSchedulerPrecisionSample(
        'off_command',
        onDeadline,
        offRequestedAt,
        Number(state.last_off_confirmed_at||Date.now())
      );
    }
    const physicalOnAt=Number(state.last_on_confirmed_at||relayOnAt||state.pulse_started_at||0);
    const confirmedOffAt=Number(state.last_off_confirmed_at||0);
    // Nunca reutiliza um OFF de um pulso anterior. Sem confirmação nova, a duração física
    // é desconhecida e permanece explicitamente não confirmada.
    const physicalOffAt=offConfirmed&&confirmedOffAt>=physicalOnAt?confirmedOffAt:0;
    let actualPulseSeconds=null;
    if(physicalOnAt>0&&physicalOffAt>=physicalOnAt){
      const actualMs=physicalOffAt-physicalOnAt;
      actualPulseSeconds=Math.max(0,actualMs/1000);
      addPrecisionSample('on',maxOn*1000,actualMs,physicalOffAt);
      ensureDailyCounters(physicalOnAt||physicalOffAt);
      state={
        ...state,
        daily_irrigated_seconds:Number(state.daily_irrigated_seconds||0)+Math.min(maxOn,actualPulseSeconds),
        daily_last_pulse_at:physicalOffAt
      };
    }

    const pulseCompleted=
      !interrupted&&
      Number.isFinite(actualPulseSeconds)&&
      actualPulseSeconds>=Math.max(0,maxOn-0.75);
    const finalInterrupted=!pulseCompleted;
    ensureDailyCounters(physicalOnAt||physicalOffAt);

    state={
      ...state,
      pulse_count:Number(state.pulse_count||0)+(pulseCompleted?1:0),
      daily_pulses_completed:Number(state.daily_pulses_completed||0)+(pulseCompleted?1:0),
      daily_pulses_interrupted:Number(state.daily_pulses_interrupted||0)+(finalInterrupted?1:0),
      last_pulse_at:physicalOffAt||Date.now(),
      current_pulse_id:null,
      pulse_started_at:0,
      expected_off_at:0
    };
    await persist();

    if(pulseCompleted){
      await event('viveiro_pulse_complete','Pulso de irrigação concluído.',{
        pulse_id:pulseId,
        pulse_started_at:physicalOnAt,
        pulse_finished_at:physicalOffAt,
        duration_seconds:maxOn,
        actual_duration_seconds:Number(actualPulseSeconds.toFixed(3)),
        timing_error_ms:Math.round((actualPulseSeconds-maxOn)*1000),
        pulse_count:Number(state.pulse_count||0)
      });
    }else{
      await event('viveiro_pulse_interrupted','Pulso interrompido antes do tempo programado.',{
        pulse_id:pulseId,
        pulse_started_at:physicalOnAt,
        pulse_finished_at:physicalOffAt,
        planned_duration_seconds:maxOn,
        actual_duration_seconds:Number.isFinite(actualPulseSeconds)?Number(actualPulseSeconds.toFixed(3)):null,
        timing_error_ms:Number.isFinite(actualPulseSeconds)?Math.round((actualPulseSeconds-maxOn)*1000):null,
        off_confirmed:Boolean(physicalOffAt),
        reason:String(state.phase||'interrupted')
      });
    }

    if(!state.enabled)break;
    if(!(await active())){
      state={...state,phase:'controller_unavailable',relay_expected:false,last_error:'Aguardando ESP32 responder.'};
      await persist();
      await sleep(3000);
      continue;
    }

    if(!localSchedule(state).inside){
      const waitSeconds=secondsUntilNextWindow(state);
      state={
        ...state,
        phase:'waiting_window',
        relay_expected:false,
        on_seconds:Number(state.base_on_seconds||state.on_seconds||30),
        off_seconds:Number(state.base_off_seconds||state.off_seconds||120),
        climate_reason:'Horário encerrado: ciclo-base restaurado para a próxima janela.',
        expected_off_at:0,
        expected_next_on_at:0,
        next_window_at:Date.now()+waitSeconds*1000
      };
      await persist();
      await event('viveiro_window_end','Horário final atingido. Aguardando o próximo horário de início.',{
        next_window_at:state.next_window_at
      });
      ensureDailyCounters();
      await reconcileDailyAccounting({notify:true}).catch(()=>null);
      const irrigatedSeconds=Number(state.daily_irrigated_seconds||0);
      await pushNotice(
        'Resumo do viveiro',
        'Horário encerrado • '+Number(state.daily_pulses_started||0)+' pulsos • '+Math.round(irrigatedSeconds/60)+' min irrigados.',
        'viveiro-summary-'+localDayKey()
      );
      continue;
    }

    if(finalInterrupted){
      state={...state,relay_expected:false};
      await persist();
      await sleep(5000);
      continue;
    }

    state={
      ...state,
      phase:'off',
      relay_expected:false,
      expected_next_on_at:Number(state.last_off_confirmed_at||Date.now())+Number(state.off_seconds||120)*1000
    };
    await persist();

    const offDeadline=Number(state.expected_next_on_at||0)
      ||(Date.now()+Math.max(1,Number(state.off_seconds||120))*1000);
    while(state.enabled){
      const remainingMs=offDeadline-Date.now();
      if(remainingMs<=0)break;
      await sleep(Math.min(1000,remainingMs));

      // O intervalo termina pelo relógio absoluto. Não executa uma chamada de rede
      // depois que o prazo já venceu, evitando acumular atraso ciclo após ciclo.
      if(Date.now()>=offDeadline)break;
      if(!(await active()))break;
      if(!localSchedule(state).inside)break;

      const nowWeather=await weather();
      if(!nowWeather.usable){
        state={...state,phase:'weather_unavailable',relay_expected:false,last_error:'Weather2-2 sem dados.'};
        await persist();
        break;
      }
      if(nowWeather.raining){
        state={
          ...state,
          phase:'weather_blocked',
          relay_expected:false,
          paused_by_weather:true,
          rain_last_at:Date.now(),
          last_error:null
        };
        await persist();
        break;
      }
    }
  }
}

function ensureLoop(){
  if(loopPromise)return;
  state={...state,state_updated_at:Date.now()};
  persist().catch(()=>null);
  loopPromise=run()
    .catch(async error=>{
      console.error('seconds loop',error);
      await safeOff();
      state={...state,phase:'error',relay_expected:false,last_error:error?.message||String(error)};
      await persist();
      await event('viveiro_error','Erro no controlador do ciclo rápido.',{error:state.last_error});
    })
    .finally(()=>{loopPromise=null});
}

export async function initSecondsManager(){
  await load();
  await recoverDailyCountersFromReconciliation();

  await reconcileDailyAccounting({notify:false}).catch(error=>
    console.warn('Reconciliação inicial indisponível:',error?.message||error)
  );
  if(!accountingTimer){
    accountingTimer=setInterval(()=>{
      reconcileDailyAccounting({notify:true}).catch(error=>
        console.warn('Reconciliação periódica indisponível:',error?.message||error)
      );
    },ACCOUNTING_RECONCILE_MS);
    accountingTimer.unref?.();
  }
  await runOperationalAudit({notify:false}).catch(error=>
    console.warn('Auditoria operacional inicial indisponível:',error?.message||error)
  );

  try{
    const now=Date.now();
    const rows=(await readRecentHistory({sinceMs:now-8*86400000,limit:1000}))
      .filter(row=>String(row?.source||'').includes('viveiro')||String(row?.type||'').startsWith('viveiro_'));
    const byDay={};
    for(const row of rows){
      const key=localDayKey(Number(row?.ts||Date.parse(row?.at||0)||now));
      if(!byDay[key])byDay[key]={total:0,types:{}};
      byDay[key].total+=1;
      const type=String(row?.type||'unknown');
      byDay[key].types[type]=(byDay[key].types[type]||0)+1;
    }
    console.log('Viveiro history diagnostic JSON',JSON.stringify({
      daily_state:{
        day_key:String(state.daily_day_key||''),
        started:Number(state.daily_pulses_started||0),
        completed:Number(state.daily_pulses_completed||0),
        interrupted:Number(state.daily_pulses_interrupted||0),
        irrigated_seconds:Number(state.daily_irrigated_seconds||0),
        last_pulse_at:Number(state.daily_last_pulse_at||state.last_pulse_at||0)||null,
        last_on_confirmed_at:Number(state.last_on_confirmed_at||0)||null,
        last_off_confirmed_at:Number(state.last_off_confirmed_at||0)||null,
        configured_at:Number(state.configured_at||0)||null,
        start_minutes:Number(state.start_minutes||0),
        end_minutes:Number(state.end_minutes||0)
      },
      audit:{
        status:String(state.operational_audit?.status||''),
        issues:(state.operational_audit?.issues||[]).map(x=>({code:x.code,level:x.level,message:x.message}))
      },
      by_day:byDay,
      reconciliation_events:rows
        .filter(row=>String(row?.type||'')==='viveiro_accounting_reconciled')
        .slice(0,10)
        .map(row=>({
          ts:Number(row.ts||0),
          before:row.before||null,
          expected:row.expected||null,
          day_key:row.day_key||null
        }))
    }));
  }catch(error){
    console.warn('Diagnóstico do histórico indisponível:',error?.message||error);
  }
  if(!operationalAuditTimer){
    operationalAuditTimer=setInterval(()=>{
      runOperationalAudit({notify:true}).catch(error=>
        console.warn('Auditoria operacional indisponível:',error?.message||error)
      );
    },OPERATIONAL_AUDIT_MS);
    operationalAuditTimer.unref?.();
  }

  const [startupClimateConfig,startupClimateState]=await Promise.all([
    getClimateConfig().catch(()=>null),
    getClimateState().catch(()=>null)
  ]);
  console.log('Automatico 4.0 startup',{
    cycle_enabled:Boolean(state.enabled),
    phase:String(state.phase||''),
    automatic:Boolean(startupClimateConfig?.automatic),
    observation:Boolean(startupClimateConfig?.observation),
    climate_enabled:startupClimateConfig?.enabled!==false,
    last_evaluated_at:Number(startupClimateState?.last_evaluated_at||0)||null,
    last_applied_at:Number(startupClimateState?.last_applied_at||0)||null,
    last_decision:String(startupClimateState?.last_decision||''),
    confidence:String(startupClimateState?.confidence||''),
    samples:Number(startupClimateState?.trend_samples||0),
    last_target_on_seconds:Number(startupClimateState?.last_target_on_seconds||0)||null,
    last_target_off_seconds:Number(startupClimateState?.last_target_off_seconds||0)||null,
    pending:Boolean(startupClimateState?.pending)
  });

  const baseOn=Math.max(1,Math.min(300,Math.round(Number(state.base_on_seconds||state.on_seconds)||30)));
  const baseOff=Math.max(1,Math.min(900,Math.round(Number(state.base_off_seconds||state.off_seconds)||120)));
  if(Number(state.base_on_seconds)!==baseOn||Number(state.base_off_seconds)!==baseOff){
    state={...state,base_on_seconds:baseOn,base_off_seconds:baseOff};
    await persist();
  }

  if(await emergencyLatched().catch(()=>false)){
    await safeOff();
    state={...state,enabled:false,phase:'emergency_stopped',relay_expected:false,emergency_stopped_at:Date.now()};
    await persist();
    return;
  }

  // Recuperação da programação: se o ciclo contínuo ficou desarmado sem emergência/manutenção,
  // mas ainda possui uma programação válida, rearma o controlador ao iniciar o servidor.
  // Isso evita perder a janela diária após uma parada externa/estado persistido antigo.
  if(!state.enabled&&['stopped_external','stopped_after_restart'].includes(String(state.phase||''))){
    const maint=await maintenance().catch(()=>({active:false}));
    const scheduleOk=Number(state.start_minutes)>=0&&Number(state.end_minutes)>Number(state.start_minutes)&&Number(state.days_mask)>0;
    if(!maint.active&&scheduleOk){
      const current=await readViveiroDevice({force:true,maxAgeMs:0}).catch(()=>null);
      if(current?.online&&current?.cycleConfig){
        state={...state,enabled:true,phase:'queued',relay_expected:false,last_error:null,recovered_schedule_at:Date.now()};
        ownershipActive=true;ownershipCheckedAt=Date.now();
        await persist();
        await event('viveiro_schedule_rearmed','Programação diária rearmada automaticamente após estado parado.',{previous_phase:String(state.phase||'')});
      }
    }
  }

  if(state.enabled){
    if(await active(true)){
      // Recalcula imediatamente a fase persistida. Assim um reinício/publicação
      // não deixa a interface presa em waiting_window quando a janela já abriu.
      const startupSchedule=localSchedule(state);
      const staleWaiting=state.phase==='waiting_window'&&startupSchedule.inside;
      const staleRunning=!startupSchedule.inside&&['queued','starting','running','off'].includes(String(state.phase||''));
      if(staleWaiting||staleRunning){
        const waitSeconds=startupSchedule.inside?0:secondsUntilNextWindow(state);
        state={
          ...state,
          phase:startupSchedule.inside?'starting':'waiting_window',
          next_window_at:startupSchedule.inside?0:Date.now()+waitSeconds*1000,
          expected_off_at:0,
          expected_next_on_at:0,
          last_command_reason:startupSchedule.inside?'schedule_recovered':'outside_schedule',
          last_error:null
        };
        await persist();
      }
      ensureLoop();
      await pushNotice(
        'Irrigação online novamente',
        'O servidor foi reiniciado e retomou o controle mantendo o ciclo configurado: '+Number(state.on_seconds||baseOn)+' s ligado / '+Number(state.off_seconds||baseOff)+' s desligado.',
        'viveiro-server-resumed-'+localDayKey(),
        'info',
        10,
        true
      );
    }else{
      state={...state,enabled:false,phase:'stopped_after_restart',relay_expected:false};
      await persist();
      await pushNotice(
        'Atenção • ciclo não retomado',
        'Após o reinício, o servidor não confirmou a posse do ciclo do viveiro. A irrigação automática ficou parada.',
        'viveiro-server-not-resumed-'+localDayKey(),
        'critical',
        30,
        true
      );
    }
  }
}

export async function configureSeconds(input={}){
  const wasEnabled=Boolean(state.enabled);
  if(wasEnabled){
    // Reprogramação segura: derruba a saída, encerra o laço atual e preserva
    // a contabilidade diária antes de armar a nova geração.
    await safeOff('reprogramming');
    state={...state,enabled:false,phase:'reprogramming',relay_expected:false,reprogramming_at:Date.now()};
    await persist();
    if(loopPromise)await Promise.race([loopPromise,new Promise(resolve=>setTimeout(resolve,5000))]);
    if(loopPromise)throw new Error('O controlador ainda está finalizando o ciclo anterior. Tente novamente em alguns segundos.');
  }
  if(await emergencyLatched().catch(()=>false)){
    throw new Error('A parada de emergência está ativa. Libere a emergência antes de armar a irrigação.');
  }
  const maint=await maintenance();
  if(maint.active){
    throw new Error('O modo manutenção está ativo. Encerre a manutenção antes de armar a irrigação.');
  }

  await createConfigBackup('antes_de_alterar_programacao_do_viveiro').catch(()=>null);

  // Rearmar a programação não pode apagar a contabilidade já confirmada do dia.
  ensureDailyCounters();
  const dailySnapshot={
    daily_day_key:String(state.daily_day_key||localDayKey()),
    daily_pulses_started:Number(state.daily_pulses_started||0),
    daily_pulses_completed:Number(state.daily_pulses_completed||0),
    daily_pulses_interrupted:Number(state.daily_pulses_interrupted||0),
    daily_irrigated_seconds:Number(state.daily_irrigated_seconds||0),
    daily_last_pulse_at:Number(state.daily_last_pulse_at||0)
  };

  // A programação pode ser armada com chuva; o laço contínuo mantém a saída
  // desligada até o clima ficar seguro e o atraso pós-chuva terminar.
  const prepared=await prepareServerPulse({
    onSeconds:input.on_seconds,
    offSeconds:input.off_seconds,
    resumeDelayMinutes:input.resume_delay_minutes,
    startMinutes:input.start_minutes,
    endMinutes:input.end_minutes,
    daysMask:input.days_mask
  });

  ownershipCheckedAt=0;
  ownershipActive=true;
  state={
    ...prepared,
    ...dailySnapshot,
    base_on_seconds:prepared.on_seconds,
    base_off_seconds:prepared.off_seconds,
    phase:'queued',
    climate_reason:'Ciclo-base definido pela programação salva.'
  };
  await persist();
  await patchClimateState({
    pending:null,
    approved_id:null,
    rejected_id:null,
    normal_streak:0,
    cycle_base_on_seconds:Number(state.base_on_seconds||state.on_seconds||30),
    cycle_base_off_seconds:Number(state.base_off_seconds||state.off_seconds||120),
    cycle_rearmed_at:Date.now(),
    last_decision:'cycle_rearmed',
    last_decision_at:Date.now(),
    last_reason:'Nova programação armada. Sugestões climáticas antigas foram descartadas.'
  }).catch(()=>null);
  await event(wasEnabled?'viveiro_cycle_reprogrammed':'viveiro_cycle_start',wasEnabled?'Programação atualizada com troca segura.':'Ciclo rápido configurado e armado.',{
    on_seconds:state.on_seconds,off_seconds:state.off_seconds,
    start_minutes:state.start_minutes,end_minutes:state.end_minutes,days_mask:state.days_mask
  });
  ensureLoop();
  return state;
}

export async function disableSeconds(){
  if(!state.enabled)return state;
  await finishAndRestore('stopped');
  return state;
}

export async function emergencyStopAll(reason='Parada de emergência pelo aplicativo'){
  state={
    ...state,
    enabled:false,
    phase:'emergency_stopped',
    relay_expected:false,
    device_relay:false,
    emergency_stopped_at:Date.now()
  };
  await persist();
  const safety=await activateEmergency(reason);
  await safeOff();
  await event('viveiro_emergency_stop','PARADA DE EMERGÊNCIA acionada.',{reason});
  await pushNotice(
    'PARADA DE EMERGÊNCIA',
    'A automação do viveiro foi bloqueada e a saída foi desligada. É necessário liberar a emergência e rearmar manualmente.',
    'viveiro-emergency-stop',
    'critical',
    0,
    true
  );
  return{state,safety};
}

export async function clearEmergencyStop(){
  const safety=await clearEmergency();
  await safeOff();
  state={...state,enabled:false,phase:'stopped',relay_expected:false,device_relay:false};
  await persist();
  await event('viveiro_emergency_clear','Parada de emergência liberada. A irrigação continua parada até novo rearme.');
  return{state,safety};
}

export async function suspendSecondsForRestart(){
  if(!state.enabled)return state;
  const wasOn=String(state.phase||'')==='on'&&Boolean(state.current_pulse_id);
  const pulseId=String(state.current_pulse_id||'');
  const pulseStartedAt=Number(state.last_on_confirmed_at||state.pulse_started_at||0);
  const plannedSeconds=Math.max(0,Number(state.on_seconds||state.base_on_seconds||0));

  await safeOff('server_restart');
  const stoppedAt=Number(state.last_off_confirmed_at||Date.now());

  if(wasOn&&pulseId&&pulseStartedAt>0){
    const actualSeconds=Math.max(0,(stoppedAt-pulseStartedAt)/1000);
    ensureDailyCounters(pulseStartedAt);
    state={
      ...state,
      daily_pulses_interrupted:Number(state.daily_pulses_interrupted||0)+1,
      daily_irrigated_seconds:Number(state.daily_irrigated_seconds||0)+Math.min(plannedSeconds||actualSeconds,actualSeconds),
      daily_last_pulse_at:stoppedAt,
      last_pulse_at:stoppedAt
    };
    // Registra o desfecho real antes de encerrar o processo. O event_id é
    // determinístico pelo pulse_id, portanto uma eventual repetição é idempotente.
    await event('viveiro_pulse_interrupted','Pulso interrompido por reinício do servidor.',{
      pulse_id:pulseId,
      pulse_started_at:pulseStartedAt,
      pulse_finished_at:stoppedAt,
      planned_duration_seconds:plannedSeconds,
      actual_duration_seconds:Number(actualSeconds.toFixed(3)),
      timing_error_ms:Math.round((actualSeconds-plannedSeconds)*1000),
      reason:'server_restart'
    }).catch(error=>console.warn('Falha ao registrar pulso interrompido no reinício:',error?.message||error));
  }

  state={
    ...state,
    phase:'server_restarting',
    relay_expected:false,
    device_relay:false,
    current_pulse_id:null,
    pulse_started_at:0,
    expected_off_at:0,
    restart_suspended_at:Date.now()
  };
  await persist();
  return state;
}

export function peekSecondsManagerState(){return publicSecondsState(state)}

export async function getSecondsManagerState(){
  if(state.enabled){
    const lastChecked=Number(state.checked_at||0);
    const needsLiveCheck=!lastChecked||Date.now()-lastChecked>30000;
    if(needsLiveCheck){
      const current=await readViveiroDevice({force:true,maxAgeMs:0}).catch(()=>null);
      if(current){
        const relay=current.relay===true;
        state={...state,device_relay:relay,checked_at:Date.now()};
        if(state.phase==='on')state={...state,relay_expected:relay};
      }
    }
  }
  return{...state,server_read_at:Date.now()};
}
