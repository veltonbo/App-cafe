import { storeGet, storePatch, storeSet } from '../irrigation/_store.js';
import { encodeCycle } from '../_cycle.js';
import {
  readViveiroDevice,
  setViveiroRelay,
  writeViveiroCycle
} from './_seconds.js';

const ROOT='IrrigacaoFazenda2E';
const SAFETY_PATH=ROOT+'/viveiroSafety';
const MAINTENANCE_PATH=ROOT+'/viveiroMaintenance';
const SECONDS_PATH=ROOT+'/viveiroSecondsState';

function now(){return Date.now()}

export async function getViveiroSafety(){
  return(await storeGet(SAFETY_PATH).catch(()=>null))||{};
}

export async function getViveiroMaintenance(){
  const raw=(await storeGet(MAINTENANCE_PATH).catch(()=>null))||{};
  return{
    ...raw,
    active:Boolean(raw?.enabled&&Number(raw?.until||0)>now())
  };
}

export async function emergencyLatched(){
  const s=await getViveiroSafety();
  return Boolean(s?.emergency_latched);
}

export async function maintenanceActive(){
  const m=await getViveiroMaintenance();
  return Boolean(m.active);
}

function disabledCycleRaw(current){
  const cfg=current?.cycleConfig;
  if(!cfg||!current?.cycleRaw)return null;
  return encodeCycle({
    enabled:false,
    daysMask:cfg.daysMask,
    startMinutes:cfg.startMinutes,
    endMinutes:cfg.endMinutes,
    onMinutes:cfg.onMinutes,
    offMinutes:cfg.offMinutes
  },current.cycleRaw).raw;
}

async function secondsRunning(){
  const s=await storeGet(SECONDS_PATH).catch(()=>null);
  return Boolean(s?.enabled);
}

async function pauseNativeCycle(recordPath,record){
  if(await secondsRunning()){
    const current=await readViveiroDevice({maxAgeMs:2000}).catch(()=>null);
    if(current?.relay===true){
      await setViveiroRelay(false,{attempts:6}).catch(()=>null);
    }
    return record;
  }

  const current=await readViveiroDevice({force:true,maxAgeMs:0}).catch(()=>null);
  if(!current){
    await setViveiroRelay(false,{attempts:6}).catch(()=>null);
    return record;
  }

  let next={...(record||{})};
  const cfg=current.cycleConfig;
  const raw=current.cycleRaw||'';

  if(cfg?.enabled){
    const disabled=disabledCycleRaw(current);
    if(disabled){
      await writeViveiroCycle(disabled);
      next={
        ...next,
        native_cycle_raw:raw,
        disabled_cycle_raw:disabled,
        native_cycle_was_enabled:true,
        native_paused_at:now()
      };
      await storePatch(recordPath,next).catch(()=>null);
    }
  }

  if(current?.relay===true){
    await setViveiroRelay(false,{attempts:6}).catch(()=>null);
  }
  return next;
}

async function restoreMaintenanceCycle(record){
  if(!record?.native_cycle_was_enabled||!record?.native_cycle_raw)return false;
  if(await secondsRunning())return false;
  if(await emergencyLatched())return false;

  const current=await readViveiroDevice({force:true,maxAgeMs:0}).catch(()=>null);
  if(!current)return false;

  const owns=record?.disabled_cycle_raw
    ?String(current.cycleRaw||'')===String(record.disabled_cycle_raw||'')
    :current.cycleConfig?.enabled===false;

  if(!owns)return false;
  await writeViveiroCycle(record.native_cycle_raw);
  return true;
}

export async function activateEmergency(reason='Parada de emergência'){
  const previous=await getViveiroSafety();
  const payload={
    ...previous,
    emergency_latched:true,
    emergency_at:now(),
    emergency_reason:String(reason||'Parada de emergência'),
    cleared_at:0
  };
  await storeSet(SAFETY_PATH,payload);
  const next=await pauseNativeCycle(SAFETY_PATH,payload);
  return{...next,emergency_latched:true};
}

export async function clearEmergency(){
  const previous=await getViveiroSafety();
  const payload={
    ...previous,
    emergency_latched:false,
    cleared_at:now(),
    cleared_requires_manual_rearm:true
  };
  await storeSet(SAFETY_PATH,payload);
  await setViveiroRelay(false,{attempts:6}).catch(()=>null);
  return payload;
}

export async function setMaintenanceInterlock(minutes,reason='Modo manutenção'){
  const mins=Math.max(0,Math.min(1440,Math.round(Number(minutes)||0)));
  const previous=await getViveiroMaintenance();

  if(mins>0){
    const payload={
      ...previous,
      enabled:true,
      active:true,
      minutes:mins,
      until:now()+mins*60000,
      reason:String(reason||'Modo manutenção'),
      started_at:now(),
      updated_at:now()
    };
    await storeSet(MAINTENANCE_PATH,payload);
    const next=await pauseNativeCycle(MAINTENANCE_PATH,payload);
    return{...next,active:true};
  }

  const restored=await restoreMaintenanceCycle(previous).catch(()=>false);
  const payload={
    ...previous,
    enabled:false,
    active:false,
    until:0,
    minutes:0,
    ended_at:now(),
    restored_native_cycle:Boolean(restored),
    updated_at:now(),
    native_cycle_raw:null,
    disabled_cycle_raw:null,
    native_cycle_was_enabled:false
  };
  await storeSet(MAINTENANCE_PATH,payload);
  if(!restored){
    await setViveiroRelay(false,{attempts:6}).catch(()=>null);
  }
  return payload;
}

export async function enforceViveiroInterlocks(){
  const [safety,maintenance]=await Promise.all([
    getViveiroSafety(),
    getViveiroMaintenance()
  ]);

  if(safety?.emergency_latched){
    await pauseNativeCycle(SAFETY_PATH,safety).catch(()=>null);
    return{
      blocked:true,
      reason:'emergency',
      emergency:safety,
      maintenance
    };
  }

  if(maintenance.active){
    await pauseNativeCycle(MAINTENANCE_PATH,maintenance).catch(()=>null);
    return{
      blocked:true,
      reason:'maintenance',
      emergency:safety,
      maintenance
    };
  }

  if(maintenance?.enabled&&!maintenance.active){
    await setMaintenanceInterlock(0,maintenance.reason||'Modo manutenção').catch(()=>null);
  }

  return{
    blocked:false,
    reason:null,
    emergency:await getViveiroSafety(),
    maintenance:await getViveiroMaintenance()
  };
}
