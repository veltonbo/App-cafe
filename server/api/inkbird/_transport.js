import { smartLifeReadDevice, smartLifeSendCommands } from '../_smartlife.js';
import { resolveInkbirdDevice } from './_device.js';
import { decodeDp45 } from './_iic800.js';

function parseValues(values){
  if(!values)return{};
  if(typeof values==='object')return values;
  try{return JSON.parse(values)}catch{return{}}
}

export function inkbirdFunctionList(device){
  const source=device?.function||{};
  if(Array.isArray(source))return source;
  return Object.entries(source).map(([code,value])=>({
    code,
    type:value?.type||null,
    values:parseValues(value?.values),
    name:value?.name||code
  }));
}

export function inkbirdStatusSpec(device){
  const source=device?.status_range||{};
  if(Array.isArray(source))return source;
  return Object.entries(source).map(([code,value])=>({
    code,
    type:value?.type||null,
    values:parseValues(value?.values),
    name:value?.name||code
  }));
}

export function inkbirdRuntimeFromStatus(statusMap={}){
  const dp45=decodeDp45(statusMap.irrigation_time_all);
  let activeMask=0;
  let pendingMask=0;
  for(let zone=1;zone<=8;zone++){
    const running=Number(dp45?.running_time?.[zone]||0);
    const duration=Number(dp45?.duration?.[zone]||0);
    if(running>0)activeMask|=(1<<(zone-1));
    else if(duration>0)pendingMask|=(1<<(zone-1));
  }
  return{
    provider:'smartlife',
    operation_mode:(activeMask||pendingMask)?'Manual':'Auto',
    irrigation_mode:statusMap.irrigation_mode??null,
    zonerun_state:activeMask,
    pendingzone_state:pendingMask,
    active_mask:activeMask,
    pending_mask:pendingMask,
    dp45
  };
}

export async function readInkbirdState({deviceId='',force=false,maxAgeMs=2000}={}){
  const resolved=await resolveInkbirdDevice(deviceId);
  if(!resolved.id)throw new Error('IIC-800 não encontrado no Smart Life.');
  const device=await smartLifeReadDevice({
    deviceId:resolved.id,
    force,
    maxAgeMs
  });
  const statusMap=device?.status&&typeof device.status==='object'?device.status:{};
  return{
    provider:'smartlife',
    deviceId:device.id,
    online:device.online!==false,
    device,
    resolved,
    statusMap,
    functions:inkbirdFunctionList(device),
    statusSpec:inkbirdStatusSpec(device),
    runtime:inkbirdRuntimeFromStatus(statusMap)
  };
}

export async function sendInkbirdCommands({deviceId='',commands=[],priority=false}={}){
  if(!Array.isArray(commands)||!commands.length)throw new Error('Nenhum comando do IIC-800 informado.');
  const resolved=await resolveInkbirdDevice(deviceId);
  if(!resolved.id)throw new Error('IIC-800 não encontrado no Smart Life.');
  const device=await smartLifeSendCommands({
    deviceId:resolved.id,
    commands,
    priority
  });
  const statusMap=device?.status&&typeof device.status==='object'?device.status:{};
  return{
    provider:'smartlife',
    deviceId:device?.id||resolved.id,
    online:device?.online!==false,
    device,
    statusMap,
    runtime:inkbirdRuntimeFromStatus(statusMap)
  };
}

export function hasInkbirdCode(state,code){
  return state?.functions?.some(item=>item?.code===code)||
    Object.prototype.hasOwnProperty.call(state?.statusMap||{},code);
}
