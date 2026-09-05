import { getDeviceId, tuyaRequest } from '../_tuya.js';
import { decodeCycle, encodeCycle } from '../_cycle.js';

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}

function normalizeStatus(result){
  if(Array.isArray(result))return result;
  if(Array.isArray(result?.status))return result.status;
  if(Array.isArray(result?.result))return result.result;
  return[];
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
    relay:typeof sm.switch_1==='boolean'?sm.switch_1:null
  };
}

export async function setViveiroRelay(on,{verify=true,attempts=6}={}){
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

    if(!verify)return{ok:true,on:Boolean(on)};

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

export async function prepareServerPulse({onSeconds=30,offSeconds=90,resumeDelayMinutes=30}={}){
  const current=await readViveiroDevice();
  const cycle=current.cycleConfig;
  if(!cycle)throw new Error('Atualize a programação do EKAZA antes de ativar o modo em segundos.');

  const on=Math.max(1,Math.min(3600,Math.round(Number(onSeconds)||30)));
  const off=Math.max(1,Math.min(3600,Math.round(Number(offSeconds)||90)));
  const resumeDelay=Math.max(0,Math.min(1440,Math.round(Number(resumeDelayMinutes)||0)));

  const nativeCycleRaw=current.cycleRaw;
  const nativeCycleWasEnabled=Boolean(cycle.enabled);

  if(cycle.enabled){
    await writeViveiroCycle(disabledCycle(current.cycleRaw,cycle));
  }

  // Começa sempre em estado seguro.
  await setViveiroRelay(false).catch(()=>null);

  return{
    enabled:true,
    engine:'vercel_workflow',
    on_seconds:on,
    off_seconds:off,
    resume_delay_minutes:resumeDelay,
    start_minutes:Number(cycle.startMinutes),
    end_minutes:Number(cycle.endMinutes),
    days_mask:Number(cycle.daysMask),
    native_cycle_raw:nativeCycleRaw,
    native_cycle_was_enabled:nativeCycleWasEnabled,
    relay_expected:false,
    phase:'starting',
    configured_at:Date.now()
  };
}

export async function stopServerPulse({nativeCycleRaw='',restoreNative=true}={}){
  await setViveiroRelay(false).catch(()=>null);

  if(restoreNative&&nativeCycleRaw){
    await writeViveiroCycle(nativeCycleRaw);
  }

  return{
    enabled:false,
    engine:'vercel_workflow',
    relay_expected:false,
    phase:'stopped',
    stopped_at:Date.now()
  };
}
