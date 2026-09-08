import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchWeatherSnapshot } from '../api/weather/_weather.js';
import { appendHistory, storeGet, storeSet } from '../api/irrigation/_store.js';
import { notifyIrrigation } from '../api/irrigation/_notify.js';
import { createConfigBackup } from '../api/irrigation/_backup.js';
import { climateSuggestion, climateTrend, getClimateConfig, getClimateState, patchClimateState, updateClimateSamples } from '../api/viveiro/_climate.js';
import { activateEmergency, clearEmergency, emergencyLatched } from '../api/viveiro/_interlock.js';
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
// Railway auto-deploy marker v2

function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function event(type,detail,extra={}){
  await appendHistory({
    type,
    detail,
    source:'viveiro_fast',
    status:String(state.phase||''),
    ...extra
  }).catch(()=>null);
}
async function pushNotice(title,body,tag,level='info',cooldownMinutes=0,whatsapp=true){
  await notifyIrrigation({title,body,tag,url:'/irrigacao/',level,cooldownMinutes,whatsapp}).catch(()=>null);
}
function localDayKey(ts=Date.now()){
  return new Intl.DateTimeFormat('en-CA',{
    timeZone:'America/Porto_Velho',year:'numeric',month:'2-digit',day:'2-digit'
  }).format(new Date(ts));
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
    if(Date.now()-lastEval<Math.max(5,Number(cfg.evaluation_minutes||5))*60000)return;

    const snapshot=await fetchWeatherSnapshot().catch(()=>null);
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
      snapshot:w
    };
  }catch(error){
    return{usable:false,raining:false,protectionEnabled:true,error:error?.message||String(error)};
  }
}

async function safeOff(){
  try{
    await setViveiroRelay(false,{attempts:10});
    return true;
  }catch(error){
    console.error('safeOff',error?.message||error);
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
      await safeOff();
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
      await safeOff();
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
      await safeOff();
      const waitSeconds=secondsUntilNextWindow(state);
      const wasWaiting=state.phase==='waiting_window';
      state={
        ...state,
        phase:'waiting_window',
        relay_expected:false,
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

    const holdMs=Math.max(0,Number(state.resume_delay_minutes||0))*60000;
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

    try{
      await setViveiroRelay(true,{attempts:5});
      await safetyCountdown(maxOn);
    }catch(error){
      await safeOff();
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
      pulse_started_at:Date.now(),
      expected_off_at:Date.now()+maxOn*1000,
      first_pulse_window_at:Number(state.first_pulse_window_at||0)||Date.now(),
      ...(delayed&&Number(state.start_alert_window_at||0)!==Number(windowStartAt||0)?{start_alert_window_at:windowStartAt}: {})
    };
    await persist();
    if(delayed){
      await event('viveiro_start_delay','Alerta: o primeiro pulso iniciou com mais de 30 segundos de atraso.',{
        window_start_at:windowStartAt,
        pulse_started_at:state.pulse_started_at
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
    await event('viveiro_pulse_start','Pulso de irrigação iniciado.',{duration_seconds:maxOn,first_of_window:firstPulseOfWindow});
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

    let elapsed=0;
    let interrupted=false;
    while(state.enabled&&elapsed<maxOn){
      const chunk=Math.min(5,maxOn-elapsed);
      await sleep(chunk*1000);
      elapsed+=chunk;

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

    await safeOff();

    if(!state.enabled)break;
    if(!(await active()))break;

    if(!localSchedule(state).inside){
      const waitSeconds=secondsUntilNextWindow(state);
      state={
        ...state,
        phase:'waiting_window',
        relay_expected:false,
        next_window_at:Date.now()+waitSeconds*1000
      };
      await persist();
      await event('viveiro_window_end','Horário final atingido. Aguardando o próximo horário de início.',{
        next_window_at:state.next_window_at
      });
      const irrigatedSeconds=Number(state.pulse_count||0)*Number(state.on_seconds||0);
      await pushNotice(
        'Resumo do viveiro',
        'Horário encerrado • '+Number(state.pulse_count||0)+' pulsos • '+Math.round(irrigatedSeconds/60)+' min irrigados.',
        'viveiro-summary-'+localDayKey()
      );
      continue;
    }

    if(interrupted){
      state={...state,relay_expected:false};
      await persist();
      await sleep(5000);
      continue;
    }

    state={
      ...state,
      phase:'off',
      relay_expected:false,
      pulse_count:Number(state.pulse_count||0)+1,
      last_pulse_at:Date.now(),
      expected_next_on_at:Date.now()+Number(state.off_seconds||120)*1000
    };
    await persist();
    await event('viveiro_pulse_complete','Pulso de irrigação concluído.',{
      duration_seconds:maxOn,
      pulse_count:Number(state.pulse_count||0)
    });

    let offElapsed=0;
    const offSeconds=Math.max(1,Number(state.off_seconds||120));
    while(state.enabled&&offElapsed<offSeconds){
      const chunk=Math.min(10,offSeconds-offElapsed);
      await sleep(chunk*1000);
      offElapsed+=chunk;

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
  await safeOff();
  state={
    ...state,
    phase:'server_restarting',
    relay_expected:false,
    device_relay:false,
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
