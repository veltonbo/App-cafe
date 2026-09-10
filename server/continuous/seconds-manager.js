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
const HISTORY_RECENT_LIMIT=3000;
const ACCOUNTING_RECONCILE_MS=5*60*1000;
const OPERATIONAL_AUDIT_MS=5*60*1000;
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
  const previous=Array.isArray(state.precision_samples)?state.precision_samples:[];
  const samples=[...previous,sample].slice(-24);
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
  const previous=Array.isArray(state.scheduler_precision_samples)?state.scheduler_precision_samples:[];
  const samples=[...previous,sample].slice(-24);
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
  const issues=[];
  let auditHistory=[];
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

  const schedulerPrecision=state.scheduler_precision||{};
  if(Number(schedulerPrecision.samples||0)>=6&&Number(schedulerPrecision.avg_abs_error_ms||0)>1500){
    issues.push({
      level:'warning',
      code:'scheduler_delay_high',
      message:'O relógio local do ciclo está enviando comandos com mais de 1,5 s de atraso médio.'
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
      message:'A confirmação da Smart Life está levando mais de 12 s em média.'
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
    auditHistory=history;
    const recent30=history.filter(row=>now-Number(row.ts||0)<30*60000);
    const failures=recent30.filter(row=>
      ['viveiro_error','viveiro_start_failure','viveiro_start_delay'].includes(String(row.type||''))
    );
    if(failures.length>=2){
      issues.push({level:'critical',code:'repeated_failures',message:'Falhas repetidas de irrigação nos últimos 30 minutos.'});
    }
    const interrupted=recent30.filter(row=>String(row.type||'')==='viveiro_pulse_interrupted');
    if(interrupted.length>=3){
      issues.push({level:'warning',code:'many_interruptions',message:'Três ou mais pulsos foram interrompidos nos últimos 30 minutos.'});
    }
    const restarts=history.filter(row=>
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

    const rows=(await readRecentHistory({
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
      irrigated:Number(accounting.irrigated_seconds||0)
    };
    const mismatch=
      before.started!==expected.started||
      before.completed!==expected.completed||
      before.interrupted!==expected.interrupted||
      Math.abs(before.irrigated-expected.irrigated)>0.25;

    // O estado ao vivo é a fonte primária do dia corrente. O histórico serve
    // para conferência, mas nunca mais altera automaticamente esses contadores.
    state={
      ...state,
      accounting_reconciliation:{
        status:mismatch?'mismatch':'ok',
        checked_at:Date.now(),
        day_key:accounting.day_key,
        live:before,
        history:expected,
        message:mismatch
          ?'Histórico e contadores ao vivo divergem; os valores ao vivo foram preservados.'
          :'Contadores ao vivo e histórico conferem.'
      }
    };
    await persist();

    if(mismatch){
      console.warn('Divergência contábil preservada sem alterar o estado ao vivo',{before,expected});
    }
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

    // O Automático 2.0 só atua dentro da janela configurada de irrigação.
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
          next_schedule_window_at:nextWindowAt||null,
          last_reason:'Automático 2.0 aguardando o horário programado da irrigação.'
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
    const suggestion=climateSuggestion(snapshot||{},state,cfg,trend);
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

    console.log('Automatico 2.0 evaluation',{
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
        await event('viveiro_climate_observation','Automático 2.0 em observação: ajuste identificado sem alterar o ciclo.',{
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
      await event('viveiro_climate_suggestion','Sugestão do Automático 2.0 aguardando aprovação.',newPending);
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
      await event(type,suggestion.returning_to_base?'Automático 2.0 retornou ao ciclo-base.':'Automático 2.0 ajustou o intervalo pelo clima.',{
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
            'VPD '+Number(suggestion.vpd||0).toFixed(2)+' kPa. O Automático 2.0 aumentou a irrigação.',
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
        state=remote;
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
      result=await setViveiroRelay(false,{attempts:10});
    }catch(firstError){
      // Segunda tentativa independente: OFF é sempre o comando de maior prioridade.
      await sleep(250);
      result=await setViveiroRelay(false,{attempts:10});
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
        message:'Saída OFF confirmada pela Smart Life.'
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
        message:'OFF não confirmado pela Smart Life.',
        error:error?.message||String(error)
      }
    };
    publishLive('watchdog',{status:'critical',at:failedAt,reason:String(reason||'safety'),error:error?.message||String(error)});
    console.error('safeOff',error?.message||error);
    await pushNotice(
      'ALERTA • desligamento não confirmado',
      'O servidor mandou desligar o viveiro, mas não recebeu confirmação do estado OFF pela Smart Life. Verifique o equipamento.',
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
  if(!force&&ownershipCheckedAt&&now-ownershipCheckedAt<30000){
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
      state={...state,enabled:false,phase:'stopped_external',relay_expected:false};
      await persist();
      await event('viveiro_cycle_stop','Ciclo rápido interrompido externamente.',{reason:'stopped_external'});
      await pushNotice(
        'Atenção • irrigação interrompida',
        'O ciclo automático foi interrompido externamente e ficou parado.',
        'viveiro-stopped-external-'+localDayKey(),
        'critical',
        20,
        true
      );
      break;
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
        'A irrigação foi liberada no ciclo-base '+Number(state.base_on_seconds||state.on_seconds||30)+' s ligado / '+Number(state.base_off_seconds||state.off_seconds||120)+' s desligado. O Automático 2.0 aguardará novas leituras antes de ajustar novamente.',
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
    let pulseId='';
    try{
      const previousOffConfirmedAt=Number(state.last_off_confirmed_at||0);
      const onResult=await setViveiroRelay(true,{attempts:5});
      relayOnAt=Number(onResult?.confirmed_at||Date.now());
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
        watchdog:{status:'ok',checked_at:relayOnAt,reason:'pulse_start',message:'Saída ON confirmada pela Smart Life.'}
      };
      publishLive('confirmation',{
        command:'on',
        requested_at:Number(onResult?.command_started_at||relayOnAt),
        confirmed_at:relayOnAt,
        latency_ms:Number(onResult?.confirmation_latency_ms||0),
        source:String(onResult?.confirmed_by||'unknown'),
        reason:'pulse_start'
      });
      // O countdown nativo continua sendo uma proteção extra.
      await safetyCountdown(maxOn);
    }catch(error){
      await safeOff('start_failure');
      const expectedFrom=Math.max(Number(windowStartAt||0),Number(state.configured_at||0));
      const late=Date.now()-expectedFrom>=30000;
      const shouldAlert=late&&Number(state.start_alert_window_at||0)!==Number(windowStartAt||0)&&!Number(state.first_pulse_window_at||0);
      state={
        ...state,
        phase:'retry_wait',
        relay_expected:false,
        last_error:error?.message||String(error),
        ...(shouldAlert?{start_alert_window_at:windowStartAt}: {})
      };
      await persist();
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
      if(!(await active())){interrupted=true;break}
      if(!localSchedule(state).inside){interrupted=true;break}

      const nowWeather=await weather();
      if(!nowWeather.usable){
        state={...state,phase:'weather_unavailable',last_error:'Weather2-2 sem dados durante o pulso.'};
        interrupted=true;
        break;
      }
      if(nowWeather.raining){
        state={
          ...state,
          phase:'weather_blocked',
          paused_by_weather:true,
          rain_last_at:Date.now(),
          last_error:null
        };
        interrupted=true;
        break;
      }
    }

    await safeOff(interrupted?'pulse_interrupted':'pulse_deadline');
    if(!interrupted&&onDeadline>0){
      addSchedulerPrecisionSample(
        'off_command',
        onDeadline,
        Number(state.last_command_at||Date.now()),
        Number(state.last_off_confirmed_at||Date.now())
      );
    }
    const physicalOffAt=Number(state.last_off_confirmed_at||Date.now());
    const physicalOnAt=Number(state.last_on_confirmed_at||relayOnAt||state.pulse_started_at||0);
    let actualPulseSeconds=0;
    if(physicalOnAt>0&&physicalOffAt>=physicalOnAt){
      const actualMs=physicalOffAt-physicalOnAt;
      actualPulseSeconds=Math.max(0,actualMs/1000);
      addPrecisionSample('on',maxOn*1000,actualMs,physicalOffAt);
      ensureDailyCounters(physicalOnAt||physicalOffAt);
      state={
        ...state,
        daily_irrigated_seconds:Number(state.daily_irrigated_seconds||0)+actualPulseSeconds,
        daily_last_pulse_at:physicalOffAt
      };
    }

    const pulseCompleted=
      !interrupted&&
      actualPulseSeconds>=Math.max(0,maxOn-0.75);
    const finalInterrupted=!pulseCompleted;
    ensureDailyCounters(physicalOnAt||physicalOffAt);

    state={
      ...state,
      pulse_count:Number(state.pulse_count||0)+(pulseCompleted?1:0),
      daily_pulses_completed:Number(state.daily_pulses_completed||0)+(pulseCompleted?1:0),
      daily_pulses_interrupted:Number(state.daily_pulses_interrupted||0)+(finalInterrupted?1:0),
      last_pulse_at:physicalOffAt,
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
        actual_duration_seconds:Number(actualPulseSeconds.toFixed(3)),
        timing_error_ms:Math.round((actualPulseSeconds-maxOn)*1000),
        reason:String(state.phase||'interrupted')
      });
    }

    if(!state.enabled)break;
    if(!(await active()))break;

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
    const rows=(await readRecentHistory({sinceMs:now-8*86400000,limit:12000}))
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
  console.log('Automatico 2.0 startup',{
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

  if(state.enabled){
    if(await active(true)){
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
  if(state.enabled)throw new Error('O modo em segundos já está ativo.');
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
  await event('viveiro_cycle_start','Ciclo rápido configurado e armado.',{
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

export async function getSecondsManagerState(){
  if(state.enabled){
    const lastChecked=Number(state.checked_at||0);
    const needsLiveCheck=!lastChecked||Date.now()-lastChecked>30000;
    if(needsLiveCheck){
      const current=await readViveiroDevice({force:true,maxAgeMs:0}).catch(()=>null);
      if(current){
        state={...state,device_relay:current.relay,relay_expected:current.relay===true,checked_at:Date.now()};
      }
    }
  }
  return{...state,server_read_at:Date.now()};
}
