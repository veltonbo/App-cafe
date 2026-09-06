import { randomUUID } from 'node:crypto';
import { getDeviceId, tuyaRequest } from '../_tuya.js';
import { decodeCycle, encodeCycle } from '../_cycle.js';

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
    today_allowed:todayAllowed,
    before_start:todayAllowed&&nowSec<startSec,
    after_end:todayAllowed&&nowSec>=endSec,
    day,
    now_seconds:nowSec,
    start_seconds:startSec,
    end_seconds:endSec,
    seconds_until_start:todayAllowed&&nowSec<startSec?Math.max(0,startSec-nowSec):0,
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

export async function pulseStillActive(state={}){
  if(!state?.enabled||!state?.disabled_cycle_raw)return false;
  const current=await readViveiroDevice().catch(()=>null);
  return Boolean(current&&String(current.cycleRaw||'')===String(state.disabled_cycle_raw||''));
}

export async function prepareServerPulse({onSeconds=30,offSeconds=90,resumeDelayMinutes=30}={}){
  const current=await readViveiroDevice();
  const cycle=current.cycleConfig;
  if(!cycle)throw new Error('Atualize a programação do EKAZA antes de ativar o modo em segundos.');

  const on=Math.max(1,Math.min(60,Math.round(Number(onSeconds)||30)));
  const off=Math.max(1,Math.min(180,Math.round(Number(offSeconds)||90)));
  if(on+off>240)throw new Error('Neste servidor, ligado + desligado deve totalizar no máximo 240 segundos.');

  const nativeCycleRaw=current.cycleRaw;
  const disabledRaw=disabledCycle(current.cycleRaw,cycle);

  if(cycle.enabled){
    await writeViveiroCycle(disabledRaw);
  }else if(String(current.cycleRaw||'')!==String(disabledRaw||'')){
    await writeViveiroCycle(disabledRaw);
  }

  await setViveiroRelay(false).catch(()=>null);

  return{
    enabled:true,
    engine:'railway_continuous',
    generation:randomUUID(),
    on_seconds:on,
    off_seconds:off,
    resume_delay_minutes:Math.max(0,Math.min(1440,Math.round(Number(resumeDelayMinutes)||0))),
    start_minutes:Number(cycle.startMinutes),
    end_minutes:Number(cycle.endMinutes),
    days_mask:Number(cycle.daysMask),
    native_cycle_raw:nativeCycleRaw,
    native_cycle_was_enabled:Boolean(cycle.enabled),
    disabled_cycle_raw:disabledRaw,
    relay_expected:false,
    phase:'queued',
    rain_last_at:0,
    paused_by_weather:false,
    pulse_count:0,
    configured_at:Date.now()
  };
}

export async function rollbackPreparedPulse(state={},detail=''){
  await setViveiroRelay(false).catch(()=>null);
  const current=await readViveiroDevice().catch(()=>null);
  const ownsCycle=current&&state?.disabled_cycle_raw&&String(current.cycleRaw||'')===String(state.disabled_cycle_raw);
  if(ownsCycle&&state?.native_cycle_raw){
    await writeViveiroCycle(state.native_cycle_raw).catch(()=>null);
  }
  return{
    ...state,
    enabled:false,
    relay_expected:false,
    phase:'rollback',
    last_error:detail||'Falha ao iniciar o controlador em segundos.',
    rollback_at:Date.now()
  };
}

export async function stopServerPulse({restoreNative=true,nativeCycleRaw='',disabledCycleRaw=''}={}){
  await setViveiroRelay(false).catch(()=>null);

  const current=await readViveiroDevice().catch(()=>null);
  const canRestore=!disabledCycleRaw||(
    current&&String(current.cycleRaw||'')===String(disabledCycleRaw||'')
  );

  if(restoreNative&&nativeCycleRaw&&canRestore){
    await writeViveiroCycle(nativeCycleRaw);
  }

  return{
    enabled:false,
    engine:'railway_continuous',
    generation:randomUUID(),
    relay_expected:false,
    phase:'stopped',
    disabled_at:Date.now()
  };
}

export async function probeServerPulse(state={}){
  if(!state?.enabled||!state?.disabled_cycle_raw){
    return{...state,enabled:false,phase:'stopped',relay_expected:false};
  }

  const current=await readViveiroDevice();
  const active=String(current.cycleRaw||'')===String(state.disabled_cycle_raw||'');
  if(!active){
    return{
      ...state,
      enabled:false,
      relay_expected:false,
      phase:'stopped',
      stopped_at:Date.now()
    };
  }

  const schedule=localSchedule(state);
  return{
    ...state,
    enabled:true,
    relay_expected:current.relay===true,
    phase:schedule.inside?'running':(schedule.before_start?'waiting_window':'finishing'),
    device_relay:current.relay,
    checked_at:Date.now()
  };
}

// Compatibilidade com telas antigas. O servidor contínuo mantém o estado
// persistido no Firebase e valida a posse do cycle_time diretamente no EKAZA.
export async function getSecondsState(){
  return null;
}
