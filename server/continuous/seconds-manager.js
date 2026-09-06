import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchWeatherSnapshot } from '../api/weather/_weather.js';
import { storeGet, storeSet } from '../api/irrigation/_store.js';
import {
  localSchedule,
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
// Railway auto-deploy marker v2

function sleep(ms){return new Promise(r=>setTimeout(r,ms))}

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
    const current=await readViveiroDevice();
    const deviceId=current.deviceId;
    const { tuyaRequest } = await import('../api/_tuya.js');
    await tuyaRequest('POST',`/v1.0/iot-03/devices/${deviceId}/commands`,{
      commands:[{code:'countdown_1',value:Math.max(1,Math.round(Number(seconds)||30))}]
    });
    return true;
  }catch{
    return false;
  }
}

async function active(){
  return Boolean(state.enabled&&await pulseStillActive(state).catch(()=>false));
}

async function finishAndRestore(reason='stopped'){
  const previous={...state};
  state={...state,enabled:false,phase:reason,relay_expected:false,stopped_at:Date.now()};
  await persist();
  await stopServerPulse({
    restoreNative:true,
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
      break;
    }

    const schedule=localSchedule(state);
    if(!schedule.inside){
      await safeOff();
      if(schedule.before_start){
        state={...state,phase:'waiting_window',relay_expected:false};
        await persist();
        await sleep(Math.min(30000,Math.max(5000,(schedule.seconds_until_start||30)*1000)));
        continue;
      }
      await finishAndRestore('window_finished');
      break;
    }

    const w=await weather();
    if(!w.usable){
      await safeOff();
      state={...state,phase:'weather_unavailable',relay_expected:false,last_error:'Weather2-2 sem dados.'};
      await persist();
      await sleep(30000);
      continue;
    }

    if(w.raining){
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

    state={...state,paused_by_weather:false,phase:'starting',last_error:null};
    await persist();

    const maxOn=Math.max(1,Math.min(
      Number(state.on_seconds||30),
      localSchedule(state).seconds_until_end||Number(state.on_seconds||30)
    ));

    try{
      await setViveiroRelay(true,{attempts:5});
      await safetyCountdown(maxOn);
    }catch(error){
      await safeOff();
      state={...state,phase:'retry_wait',relay_expected:false,last_error:error?.message||String(error)};
      await persist();
      await sleep(10000);
      continue;
    }

    state={
      ...state,
      phase:'on',
      relay_expected:true,
      pulse_started_at:Date.now(),
      expected_off_at:Date.now()+maxOn*1000
    };
    await persist();

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
      await finishAndRestore('window_finished');
      break;
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
      expected_next_on_at:Date.now()+Number(state.off_seconds||90)*1000
    };
    await persist();

    let offElapsed=0;
    const offSeconds=Math.max(1,Number(state.off_seconds||90));
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
    })
    .finally(()=>{loopPromise=null});
}

export async function initSecondsManager(){
  await load();
  if(state.enabled){
    if(await active())ensureLoop();
    else{
      state={...state,enabled:false,phase:'stopped_after_restart',relay_expected:false};
      await persist();
    }
  }
}

export async function configureSeconds(input={}){
  if(state.enabled)throw new Error('O modo em segundos já está ativo.');

  const w=await weather();
  if(!w.usable)throw new Error('Weather2-2 sem dados. O modo rápido não será iniciado por segurança.');
  if(w.raining)throw new Error('A Weather2-2 está detectando chuva. O modo rápido não será iniciado agora.');

  const prepared=await prepareServerPulse({
    onSeconds:input.on_seconds,
    offSeconds:input.off_seconds,
    resumeDelayMinutes:input.resume_delay_minutes
  });

  state={...prepared,phase:'queued'};
  await persist();
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
    const current=await readViveiroDevice().catch(()=>null);
    if(current){
      state={...state,device_relay:current.relay,relay_expected:current.relay===true,checked_at:Date.now()};
    }
  }
  return state;
}
