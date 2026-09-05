import { randomUUID } from 'node:crypto';
import { getDeviceId, tuyaRequest } from '../_tuya.js';
import { decodeCycle, encodeCycle } from '../_cycle.js';
import { storeGet, storePatch, storeSet } from '../irrigation/_store.js';

const PATH='IrrigacaoFazenda2E/viveiroSeconds';

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}

function normalizeStatus(result){
  if(Array.isArray(result))return result;
  if(Array.isArray(result?.status))return result.status;
  if(Array.isArray(result?.result))return result.result;
  return[];
}

async function readDevice(deviceId){
  const [statusR,shadowR]=await Promise.allSettled([
    tuyaRequest('GET',`/v1.0/iot-03/devices/${deviceId}/status`),
    tuyaRequest('GET',`/v2.0/cloud/thing/${deviceId}/shadow/properties`)
  ]);
  const status=statusR.status==='fulfilled'?normalizeStatus(statusR.value):[];
  const sm=Object.fromEntries(status.map(x=>[x.code,x.value]));
  const props=shadowR.status==='fulfilled'&&Array.isArray(shadowR.value?.properties)?shadowR.value.properties:[];
  const shm=Object.fromEntries(props.map(x=>[x.code,x.value]));
  const cycleRaw=typeof shm.cycle_time==='string'?shm.cycle_time:(typeof sm.cycle_time==='string'?sm.cycle_time:'');
  return{
    cycleRaw,
    cycleConfig:decodeCycle(cycleRaw),
    relay:typeof sm.switch_1==='boolean'?sm.switch_1:null
  };
}

async function setRelay(deviceId,on){
  await tuyaRequest('POST',`/v1.0/iot-03/devices/${deviceId}/commands`,{
    commands:[{code:'switch_1',value:Boolean(on)}]
  });
}

async function writeCycle(deviceId,raw){
  await tuyaRequest('POST',`/v1.0/iot-03/devices/${deviceId}/commands`,{
    commands:[{code:'cycle_time',value:raw}]
  });
  for(let i=0;i<5;i++){
    if(i)await sleep(450);
    const current=await readDevice(deviceId).catch(()=>null);
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
  return(await storeGet(PATH).catch(()=>null))||{enabled:false};
}

export async function patchSecondsState(patch={}){
  await storePatch(PATH,{...patch,updated_at:Date.now()});
  return getSecondsState();
}

export async function configureSecondsMode({onSeconds=30,offSeconds=90}={}){
  const deviceId=getDeviceId();
  const current=await readDevice(deviceId);
  const cycle=current.cycleConfig;
  if(!cycle)throw new Error('Atualize a programação do EKAZA antes de ativar o modo em segundos.');

  onSeconds=Math.max(1,Math.min(3600,Math.round(Number(onSeconds)||30)));
  offSeconds=Math.max(1,Math.min(3600,Math.round(Number(offSeconds)||90)));

  const previous=await getSecondsState();
  const nativeRaw=previous?.enabled&&previous?.native_cycle_raw?previous.native_cycle_raw:current.cycleRaw;
  const nativeWasEnabled=previous?.enabled
    ?Boolean(previous.native_cycle_was_enabled)
    :Boolean(cycle.enabled);

  // Evita conflito: enquanto o servidor comanda os pulsos, o cycle_time nativo fica pausado.
  if(cycle.enabled){
    await writeCycle(deviceId,disabledCycle(current.cycleRaw,cycle));
  }
  await setRelay(deviceId,false).catch(()=>null);

  const generation=randomUUID();
  const state={
    enabled:true,
    engine:'vercel_queue',
    on_seconds:onSeconds,
    off_seconds:offSeconds,
    start_minutes:cycle.startMinutes,
    end_minutes:cycle.endMinutes,
    days_mask:cycle.daysMask,
    native_cycle_raw:nativeRaw,
    native_cycle_was_enabled:nativeWasEnabled,
    generation,
    queue_message_id:null,
    relay_expected:false,
    expected_action:'on',
    transition_seq:0,
    phase:'starting',
    paused_by_weather:false,
    pulse_count:Number(previous?.pulse_count||0),
    last_pulse_at:previous?.last_pulse_at||null,
    last_error:null,
    configured_at:Date.now()
  };
  await storeSet(PATH,state);
  return state;
}

export async function disableSecondsMode({restoreNative=true}={}){
  const deviceId=getDeviceId();
  const state=await getSecondsState();

  // Invalida imediatamente qualquer execução antiga do workflow.
  await storePatch(PATH,{
    enabled:false,
    generation:randomUUID(),
    phase:'stopping',
    relay_expected:false,
    stopped_at:Date.now()
  });
  await setRelay(deviceId,false).catch(()=>null);

  if(restoreNative&&state.native_cycle_raw){
    await writeCycle(deviceId,state.native_cycle_raw);
  }

  const next={
    ...state,
    enabled:false,
    engine:'vercel_queue',
    automations_enabled:false,
    paused_by_weather:false,
    queue_message_id:null,
    relay_expected:false,
    phase:'stopped',
    expected_action:null,
    transition_seq:Number(state.transition_seq||0)+1,
    generation:randomUUID(),
    disabled_at:Date.now()
  };
  await storeSet(PATH,next);
  return next;
}

// Chamado pelo monitor Weather2-2. O workflow é quem decide quando o próximo pulso pode começar.
export async function pauseSecondsForWeather(){
  const state=await getSecondsState();
  if(!state.enabled)return state;
  await setRelay(getDeviceId(),false).catch(()=>null);
  return patchSecondsState({
    paused_by_weather:true,
    relay_expected:false,
    phase:'weather_blocked',
    weather_paused_at:Date.now()
  });
}

export async function resumeSecondsAfterWeather(){
  const state=await getSecondsState();
  if(!state.enabled)return state;
  return patchSecondsState({
    paused_by_weather:false,
    phase:'waiting',
    weather_resumed_at:Date.now()
  });
}
