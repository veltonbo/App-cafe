import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchWeatherSnapshot } from '../api/weather/_weather.js';
import { appendHistory, storeGet, storeSet } from '../api/irrigation/_store.js';
import { notifyIrrigation } from '../api/irrigation/_notify.js';
import { createConfigBackup } from '../api/irrigation/_backup.js';
import { climateSuggestion, climateTrend, getClimateConfig, getClimateState, patchClimateState, setClimateConfig, updateClimateSamples } from '../api/viveiro/_climate.js';
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
let remoteStoreAvailable=null;
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
    if(state.paused_by_weather||['weather_blocked','waiting_after_rain'].includes(String(state.phase||'')))return;
    if(Number(state.climate_post_rain_hold_until||0)>Date.now())return;

    const pending=climateState?.pending||null;
    if(pending&&String(climateState?.approved_id||'')===String(pending.id||'')){
      const oldOn=Math.max(1,Number(state.on_seconds||30));
      const oldOff=Math.max(1,Number(state.off_seconds||120));
      const targetOn=Math.max(1,Math.min(300,Math.round(Number(pending.target_on_seconds)||oldOn)));
      const targetOff=Math.max(1,Math.min(900,Math.round(Number(pending.target_off_seconds)||oldOff)));
      state={
        ...state,on_seconds:targetOn,off_seconds:targetOff,
        climate_adjusted_at:Date.now(),climate_reason:String(pending.reason||'Ajuste climático aprovado.')
      };
      await persist();
      await patchClimateState({
        pending:null,approved_id:null,last_applied_at:Date.now(),
        last_applied_from:oldOn,last_applied_to:targetOn,
        last_applied_off_from:oldOff,last_applied_off_to:targetOff,
        normal_streak:0,last_reason:String(pending.reason||'Ajuste climático aprovado.')
      });
      await event('viveiro_climate_applied','Ajuste climático aplicado após aprovação.',{
        from_seconds:oldOn,to_seconds:targetOn,from_off_seconds:oldOff,to_off_seconds:targetOff,
        reason:pending.reason||'',confidence:pending.confidence||''
      });
      await pushNotice(
        'Irrigação ajustada',
        oldOn+'s/'+oldOff+'s → '+targetOn+'s/'+targetOff+'s. '+String(pending.reason||''),
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
      localDayKey(),suggestion.target_on_seconds,suggestion.target_off_seconds,
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
      trend_temperature:trend.temperature,
      trend_humidity:trend.humidity,
      trend_vpd:trend.vpd,
      trend_vpd_delta:trend.vpd_delta,
      trend_temp_delta:trend.temp_delta,
      trend_humidity_delta:trend.humidity_delta,
      trend_samples:trend.samples,
      sample_age_minutes:trend.age_minutes,
      temp_range:trend.temp_range,
      humidity_range:trend.humidity_range,
      normal_streak:normalStreak,
      version:2
    });

    if(!suggestion.useful)return;

    if(cfg.observation){
      const sameObservation=String(climateState?.last_observation_id||'')===String(suggestionId);
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

    const lowConfidence=suggestion.confidence==='low';
    const cooldownMs=Math.max(20,Number(cfg.cooldown_minutes||30))*60000;
    const cooldownActive=Date.now()-Number(climateState?.last_applied_at||0)<cooldownMs;

    if(cfg.automatic){
      if(lowConfidence)return;
      if(suggestion.returning_to_base&&normalStreak<Math.max(2,Number(cfg.normal_confirmations||2)))return;
      if(cooldownActive)return;

      const oldOn=Math.max(1,Number(state.on_seconds||30));
      const oldOff=Math.max(1,Number(state.off_seconds||120));
      const targetOn=Math.max(1,Math.min(300,Math.round(Number(suggestion.target_on_seconds)||oldOn)));
      const targetOff=Math.max(1,Math.min(900,Math.round(Number(suggestion.target_off_seconds)||oldOff)));
      if(targetOn===oldOn&&targetOff===oldOff)return;

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
        normal_streak:0,version:2
      });
      const type=suggestion.returning_to_base?'viveiro_climate_return_base':'viveiro_climate_auto_change';
      await event(type,suggestion.returning_to_base?'Automático 2.0 retornou ao ciclo-base.':'Automático 2.0 ajustou o intervalo pelo clima.',{
        from_seconds:oldOn,to_seconds:targetOn,from_off_seconds:oldOff,to_off_seconds:targetOff,
        temperature:suggestion.temperature,humidity:suggestion.humidity,vpd:suggestion.vpd,
        water_factor:suggestion.water_factor,level:suggestion.level,
        confidence:suggestion.confidence,reason:suggestion.reason
      });
      await pushNotice(
        suggestion.returning_to_base?'Irrigação voltou ao padrão':'Automático 2.0 ajustou a irrigação',
        oldOn+'s ligado / '+oldOff+'s intervalo → '+targetOn+'s / '+targetOff+'s. '+
          'VPD '+Number(suggestion.vpd||0).toFixed(2)+' kPa • '+suggestion.confidence_label+'. '+suggestion.reason,
        'viveiro-climate-auto-'+suggestionId,
        suggestion.level==='muito_seco'?'warning':'info',
        20,
        true
      );
      return;
    }

    const samePending=String(pending?.id||'')===String(suggestionId);
    const alreadyRejected=String(climateState?.rejected_id||'')===String(suggestionId);
    if(samePending||alreadyRejected)return;

    const newPending={
      id:suggestionId,created_at:Date.now(),
      current_on_seconds:suggestion.current_on_seconds,current_off_seconds:suggestion.current_off_seconds,
      target_on_seconds:suggestion.target_on_seconds,target_off_seconds:suggestion.target_off_seconds,
      temperature:suggestion.temperature,humidity:suggestion.humidity,vpd:suggestion.vpd,
      level:suggestion.level,level_label:suggestion.level_label,
      confidence:suggestion.confidence,confidence_label:suggestion.confidence_label,
      reason:suggestion.reason,returning_to_base:Boolean(suggestion.returning_to_base)
    };
    await patchClimateState({pending:newPending,approved_id:null});
    await event('viveiro_climate_suggestion','Sugestão do Automático 2.0 aguardando aprovação.',newPending);
    await pushNotice(
      'Sugestão de ajuste no viveiro',
      suggestion.current_on_seconds+'s/'+suggestion.current_off_seconds+'s → '+
      suggestion.target_on_seconds+'s/'+suggestion.target_off_seconds+'s. '+newPending.reason,
      'viveiro-climate-suggest-'+suggestionId
    );
  }catch(error){
    console.warn('climate control:',error?.message||error);
  }
}
async function persist(){
  let localOk=false;
  try{
    await fs.mkdir(path.dirname(STATE_FILE),{recursive:true});
    await fs.writeFile(STATE_FILE,JSON.stringify(state,null,2),'utf8');
    localOk=true;
  }catch(error){
    console.warn('seconds local persist indisponível:',error?.message||error);
  }

  if(remoteStoreAvailable!==false){
    try{
      await storeSet(REMOTE_STATE_PATH,state);
      remoteStoreAvailable=true;
    }catch(error){
      if(remoteStoreAvailable!==false){
        console.warn('seconds Firebase persist indisponível:',error?.message||error);
      }
      remoteStoreAvailable=false;
    }
  }

  return localOk||remoteStoreAvailable===true;
}

async function load(){
  if(remoteStoreAvailable!==false){
    try{
      const remote=await storeGet(REMOTE_STATE_PATH);
      if(remote&&typeof remote==='object'){
        state=remote;
        remoteStoreAvailable=true;
        return;
      }
      remoteStoreAvailable=true;
    }catch(error){
      console.warn('seconds Firebase load indisponível:',error?.message||error);
      remoteStoreAvailable=false;
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
  try{
    const [w,cfg]=await Promise.all([
      fetchWeatherSnapshot(),
      storeGet(WEATHER_CONFIG_PATH).catch(()=>null)
    ]);
    const rainMm=rainAmountMm(w?.metrics||{});
    const threshold=Math.max(0,Number(cfg?.rainThresholdMm??5));
    const rainingNow=Boolean(w?.metrics?.rainDetected);
    const thresholdReached=threshold>0&&Number.isFinite(rainMm)&&rainMm>=threshold;
    return{
      usable:Boolean(w?.linked&&w?.metrics),
      raining:Boolean(rainingNow&&(cfg?.blockWhileRaining!==false||thresholdReached)),
      rainingNow,
      rainMm,
      thresholdReached,
      snapshot:w
    };
  }catch(error){
    return{usable:false,raining:false,error:error?.message||String(error)};
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
async function active(){
  return Boolean(state.enabled&&await pulseStillActive(state).catch(()=>false));
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

    // Migração da lógica antiga: versões anteriores podiam atualizar rain_last_at
    // pelo acumulado diário mesmo sem chuva atual, reiniciando indevidamente os 30 min.
    // Só limpa uma vez estados antigos; novos eventos de chuva continuam usando o atraso normal.
    if(state.paused_by_weather&&!state.legacy_weather_hold_cleared_at&&state.rain_last_at){
      state={
        ...state,
        rain_last_at:0,
        paused_by_weather:false,
        legacy_weather_hold_cleared_at:Date.now(),
        phase:'weather_clear'
      };
      await persist();
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

    const wasPausedByWeather=Boolean(state.paused_by_weather);
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
        'A irrigação foi liberada no padrão 30 s / 120 s. O Automático 2.0 aguardará novas leituras antes de ajustar novamente.',
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
    if(wasPausedByWeather){
      await event('viveiro_weather_resume','Proteção por chuva liberada. Irrigação retomada.',{
        rain_last_at:Number(state.rain_last_at||0)
      });
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

  const currentClimate=await getClimateConfig().catch(()=>({}));
  await setClimateConfig({
    ...currentClimate,
    automatic:true,
    observation:false,
    enabled:true,
    trend_minutes:30,
    evaluation_minutes:5,
    max_adjust_percent:30,
    min_change_seconds:3,
    min_change_off_seconds:6,
    cooldown_minutes:30,
    normal_confirmations:2,
    post_rain_hold_minutes:30
  }).catch(()=>null);

  const baseChanged=Number(state.base_on_seconds||0)!==30||Number(state.base_off_seconds||0)!==120;
  if(baseChanged||state.enabled){
    state={
      ...state,
      base_on_seconds:30,
      base_off_seconds:120,
      ...(state.enabled?{
        on_seconds:30,
        off_seconds:120,
        climate_reason:'Automático 2.0 iniciado no ciclo-base 30 s / 120 s.',
        climate_level:'normal'
      }:{})
    };
    await persist();
  }

  if(state.enabled){
    if(await active()){
      ensureLoop();
      await pushNotice(
        'Irrigação online novamente',
        'O servidor foi reiniciado e retomou o controle no padrão-base 30 s ligado / 120 s desligado.',
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

  await createConfigBackup('antes_de_alterar_programacao_do_viveiro').catch(()=>null);

  // A programação pode ser armada mesmo com chuva ou clima temporariamente indisponível.
  // O laço contínuo mantém a saída desligada e só libera os pulsos quando o clima estiver seguro.
  const prepared=await prepareServerPulse({
    onSeconds:input.on_seconds,
    offSeconds:input.off_seconds,
    resumeDelayMinutes:input.resume_delay_minutes,
    startMinutes:input.start_minutes,
    endMinutes:input.end_minutes,
    daysMask:input.days_mask
  });

  state={...prepared,base_on_seconds:30,base_off_seconds:120,phase:'queued'};
  await persist();
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
      const current=await readViveiroDevice().catch(()=>null);
      if(current){
        state={...state,device_relay:current.relay,relay_expected:current.relay===true,checked_at:Date.now()};
      }
    }
  }
  return state;
}
