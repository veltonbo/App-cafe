import { randomUUID } from 'node:crypto';
import { getDeviceId, tuyaRequest } from '../_tuya.js';
import { decodeCycle, encodeCycle } from '../_cycle.js';
import { storeGet, storePatch, storeSet } from '../irrigation/_store.js';
import { getViveiroWeatherConfig } from './_weather_logic.js';

const PATH='IrrigacaoFazenda2E/viveiroSeconds';
const TZ='America/Porto_Velho';

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}

function normalizeStatus(result){
  if(Array.isArray(result))return result;
  if(Array.isArray(result?.status))return result.status;
  if(Array.isArray(result?.result))return result.result;
  return[];
}

export function localSchedule(state,nowDate=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
    timeZone:TZ,
    weekday:'short',
    hour:'2-digit',
    minute:'2-digit',
    second:'2-digit',
    hourCycle:'h23'
  }).formatToParts(nowDate).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));

  const dayMap={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  const day=dayMap[parts.weekday]??0;
  const nowSec=Number(parts.hour)*3600+Number(parts.minute)*60+Number(parts.second);
  const startSec=Number(state.start_minutes||0)*60;
  const endSec=Number(state.end_minutes||0)*60;
  const mask=Number(state.days_mask||0);
  const todayAllowed=Boolean(mask&(1<<day));

  return{
    inside:todayAllowed&&nowSec>=startSec&&nowSec<endSec,
    day,
    now_seconds:nowSec,
    start_seconds:startSec,
    end_seconds:endSec,
    seconds_until_end:todayAllowed&&nowSec<endSec?Math.max(0,endSec-nowSec):0
  };
}

export async function readViveiroDevice(){
  const deviceId=getDeviceId();
  const [statusR,shadowR]=await Promise.allSettled([
    tuyaRequest('GET',`/v1.0/iot-03/devices/${deviceId}/status`),
    tuyaRequest('GET',`/v2.0/cloud/thing/${deviceId}/shadow/properties`)
  ]);

  const status=statusR.status==='fulfilled'?normalizeStatus(statusR.value):[];
  const sm=Object.fromEntries(status.map(x=>[x.code,x.value]));
  const props=shadowR.status==='fulfilled'&&Array.isArray(shadowR.value?.properties)?shadowR.value.properties:[];
  const shm=Object.fromEntries(props.map(x=>[x.code,x.value]));

  const cycleRaw=typeof shm.cycle_time==='string'
    ?shm.cycle_time
    :(typeof sm.cycle_time==='string'?sm.cycle_time:'');

  return{
    deviceId,
    cycleRaw,
    cycleConfig:decodeCycle(cycleRaw),
    relay:typeof sm.switch_1==='boolean'?sm.switch_1:null,
    online:true
  };
}

export async function setViveiroRelay(on,{attempts=on?4:10}={}){
  const deviceId=getDeviceId();
  let lastError='';

  for(let i=0;i<Math.max(1,attempts);i++){
    try{
      await tuyaRequest('POST',`/v1.0/iot-03/devices/${deviceId}/commands`,{
        commands:[{code:'switch_1',value:Boolean(on)}]
      });
    }catch(error){
      lastError=error?.message||String(error);
    }

    await sleep(450);

    try{
      const r=await tuyaRequest('GET',`/v1.0/iot-03/devices/${deviceId}/status`);
      const map=Object.fromEntries(normalizeStatus(r).map(x=>[x.code,x.value]));
      if(map.switch_1===Boolean(on))return{ok:true,on:Boolean(on)};
    }catch(error){
      lastError=error?.message||String(error);
    }
  }

  throw new Error(
    (on?'Não foi possível confirmar que o viveiro ligou. ':'Não foi possível confirmar que o viveiro desligou. ')+lastError
  );
}

export async function writeViveiroCycle(raw){
  const deviceId=getDeviceId();
  await tuyaRequest('POST',`/v1.0/iot-03/devices/${deviceId}/commands`,{
    commands:[{code:'cycle_time',value:raw}]
  });

  for(let i=0;i<6;i++){
    if(i)await sleep(450);
    const current=await readViveiroDevice().catch(()=>null);
    if(String(current?.cycleRaw||'')===String(raw||''))return true;
  }
  throw new Error('O EKAZA não confirmou a alteração do cycle_time.');
}

function disabledCycle(currentRaw,cfg){
  return encodeCycle({
    enabled:false,
    daysMask:cfg.daysMask,
    startMinutes:cfg.startMinutes,
    endMinutes:cfg.endMinutes,
    onMinutes:cfg.onMinutes,
    offMinutes:cfg.offMinutes
  },currentRaw).raw;
}

export async function getSecondsState(){
  return(await storeGet(PATH).catch(()=>null))||{enabled:false,phase:'idle'};
}

export async function patchSecondsState(patch={}){
  await storePatch(PATH,{...patch,updated_at:Date.now()});
  return getSecondsState();
}

export async function prepareServerPulse({onSeconds=30,offSeconds=90}={}){
  const current=await readViveiroDevice();
  const cycle=current.cycleConfig;
  if(!cycle)throw new Error('Atualize a programação do EKAZA antes de ativar o modo em segundos.');

  const on=Math.max(1,Math.min(180,Math.round(Number(onSeconds)||30)));
  const off=Math.max(1,Math.min(240,Math.round(Number(offSeconds)||90)));
  const weatherCfg=await getViveiroWeatherConfig().catch(()=>({resumeDelayMinutes:30}));

  const previous=await getSecondsState();
  const nativeCycleRaw=previous?.enabled&&previous?.native_cycle_raw?previous.native_cycle_raw:current.cycleRaw;
  const nativeCycleWasEnabled=previous?.enabled
    ?Boolean(previous.native_cycle_was_enabled)
    :Boolean(cycle.enabled);

  if(cycle.enabled){
    await writeViveiroCycle(disabledCycle(current.cycleRaw,cycle));
  }
  await setViveiroRelay(false).catch(()=>null);

  const generation=randomUUID();
  const state={
    enabled:true,
    engine:'vercel_chained_function',
    generation,
    on_seconds:on,
    off_seconds:off,
    resume_delay_minutes:Math.max(0,Math.min(1440,Number(weatherCfg.resumeDelayMinutes||0))),
    start_minutes:Number(cycle.startMinutes),
    end_minutes:Number(cycle.endMinutes),
    days_mask:Number(cycle.daysMask),
    native_cycle_raw:nativeCycleRaw,
    native_cycle_was_enabled:nativeCycleWasEnabled,
    relay_expected:false,
    phase:'queued',
    worker_lease_until:0,
    worker_token:null,
    rain_last_at:Number(previous?.rain_last_at||0),
    pulse_count:Number(previous?.pulse_count||0),
    last_pulse_at:previous?.last_pulse_at||null,
    last_error:null,
    configured_at:Date.now()
  };
  await storeSet(PATH,state);
  return state;
}

export async function stopServerPulse({restoreNative=true}={}){
  const current=await getSecondsState();

  await storePatch(PATH,{
    enabled:false,
    generation:randomUUID(),
    relay_expected:false,
    phase:'stopping',
    worker_lease_until:0,
    worker_token:null,
    stopped_at:Date.now()
  });

  await setViveiroRelay(false).catch(()=>null);

  if(restoreNative&&current.native_cycle_raw){
    await writeViveiroCycle(current.native_cycle_raw);
  }

  const next={
    ...current,
    enabled:false,
    engine:'vercel_chained_function',
    generation:randomUUID(),
    relay_expected:false,
    phase:'stopped',
    worker_lease_until:0,
    worker_token:null,
    disabled_at:Date.now()
  };
  await storeSet(PATH,next);
  return next;
}

export async function tryClaimWorker(generation,leaseMs){
  const state=await getSecondsState();
  const now=Date.now();
  if(!state.enabled||state.generation!==generation)return{claimed:false,state,reason:'inactive'};
  if(Number(state.worker_lease_until||0)>now)return{claimed:false,state,reason:'busy'};

  const token=randomUUID();
  await storePatch(PATH,{
    worker_token:token,
    worker_lease_until:now+Math.max(30000,Number(leaseMs||180000)),
    phase:'running'
  });

  const verify=await getSecondsState();
  return{
    claimed:Boolean(verify.enabled&&verify.generation===generation&&verify.worker_token===token),
    token,
    state:verify,
    reason:verify.worker_token===token?'claimed':'race'
  };
}

export async function releaseWorker(generation,token,patch={}){
  const state=await getSecondsState();
  if(state.generation!==generation||state.worker_token!==token)return state;
  await storePatch(PATH,{
    ...patch,
    worker_token:null,
    worker_lease_until:0
  });
  return getSecondsState();
}
