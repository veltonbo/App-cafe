import { getDeviceId, tuyaRequest } from '../_tuya.js';
import { decodeCycle, encodeCycle } from '../_cycle.js';
import { storeGet, storeSet } from '../irrigation/_store.js';

const PATH='IrrigacaoFazenda2E/viveiroSeconds';
const TZ='America/Porto_Velho';

function localTime(){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
    timeZone:TZ,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(new Date()).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  const map={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  return{day:map[parts.weekday]??0,minutes:Number(parts.hour)*60+Number(parts.minute)};
}
function insideWindow(cfg){
  if(!cfg)return false;
  const t=localTime();
  return Boolean(Number(cfg.daysMask||0)&(1<<t.day))&&t.minutes>=Number(cfg.startMinutes)&&t.minutes<Number(cfg.endMinutes);
}
async function setRelay(deviceId,on){
  return tuyaRequest('POST',`/v1.0/iot-03/devices/${deviceId}/commands`,{
    commands:[{code:'switch_1',value:Boolean(on)}]
  });
}
function encodeInching(currentRaw,enabled,seconds){
  let b=Buffer.alloc(3);
  try{
    const current=Buffer.from(String(currentRaw||''),'base64');
    if(current.length>=3)b=Buffer.from(current.subarray(0,3));
  }catch{}
  const channelBits=b[0]&0xfe;
  b[0]=enabled?(channelBits|0x01):channelBits;
  b.writeUInt16BE(Math.max(1,Math.min(65535,Math.round(Number(seconds)||30))),1);
  return b.toString('base64');
}
async function readDevice(deviceId){
  const [statusR,shadowR]=await Promise.allSettled([
    tuyaRequest('GET',`/v1.0/iot-03/devices/${deviceId}/status`),
    tuyaRequest('GET',`/v2.0/cloud/thing/${deviceId}/shadow/properties`)
  ]);
  const status=Array.isArray(statusR.value)?statusR.value:[];
  const sm=Object.fromEntries(status.map(x=>[x.code,x.value]));
  const props=Array.isArray(shadowR.value?.properties)?shadowR.value.properties:[];
  const shm=Object.fromEntries(props.map(x=>[x.code,x.value]));
  const cycleRaw=typeof shm.cycle_time==='string'?shm.cycle_time:(typeof sm.cycle_time==='string'?sm.cycle_time:'');
  const inchingRaw=typeof shm.switch_inching==='string'?shm.switch_inching:(typeof sm.switch_inching==='string'?sm.switch_inching:'');
  return{
    cycleRaw,
    cycleConfig:decodeCycle(cycleRaw),
    inchingRaw,
    relay:typeof sm.switch_1==='boolean'?sm.switch_1:null
  };
}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
async function sendDp(deviceId,code,value){
  const attempts=[];
  const paths=[
    {
      name:'iot-03 commands',
      run:()=>tuyaRequest('POST',`/v1.0/iot-03/devices/${deviceId}/commands`,{
        commands:[{code,value}]
      })
    },
    {
      name:'legacy commands',
      run:()=>tuyaRequest('POST',`/v1.0/devices/${deviceId}/commands`,{
        commands:[{code,value}]
      })
    },
    {
      name:'shadow property',
      run:()=>tuyaRequest('POST',`/v2.0/cloud/thing/${deviceId}/shadow/properties/issue`,{
        properties:JSON.stringify({[code]:value})
      })
    }
  ];
  for(const p of paths){
    try{
      await p.run();
      return{transport:p.name,attempts};
    }catch(error){
      attempts.push(p.name+': '+(error?.message||String(error)));
    }
  }
  throw new Error(code+' recusado. '+attempts.join(' | '));
}
async function waitProperty(deviceId,key,target,attempts=5){
  let last='';
  for(let i=0;i<attempts;i++){
    if(i)await sleep(500);
    const d=await readDevice(deviceId).catch(()=>null);
    last=key==='switch_inching'?String(d?.inchingRaw||''):String(d?.cycleRaw||'');
    if(last===String(target||''))return{confirmed:true,last};
  }
  return{confirmed:false,last};
}
async function writeInching(deviceId,raw){
  const sent=await sendDp(deviceId,'switch_inching',raw);
  const verify=await waitProperty(deviceId,'switch_inching',raw,6);
  if(!verify.confirmed){
    throw new Error('switch_inching enviado por '+sent.transport+', mas o EKAZA não confirmou os 30 segundos. Último valor: '+(verify.last||'vazio'));
  }
  return{...sent,verified:true};
}
async function writeCycle(deviceId,raw){
  const sent=await sendDp(deviceId,'cycle_time',raw);
  const verify=await waitProperty(deviceId,'cycle_time',raw,6);
  if(!verify.confirmed){
    throw new Error('cycle_time enviado por '+sent.transport+', mas o EKAZA não confirmou a nova programação.');
  }
  return{...sent,verified:true};
}
function modeCycleRaw(currentRaw,currentConfig,enabled,onSeconds,offSeconds){
  const fullSeconds=Number(onSeconds)+Number(offSeconds);
  if(fullSeconds%60!==0){
    throw new Error('A soma do tempo ligado + desligado precisa ser múltipla de 60 segundos. Para 30 s + 90 s = 120 s, está correto.');
  }
  if(Number(onSeconds)>60){
    throw new Error('Neste modo seguro, o tempo ligado pode ser no máximo 60 segundos.');
  }
  const periodMinutes=fullSeconds/60;
  if(periodMinutes<2){
    throw new Error('O ciclo total precisa ter pelo menos 120 segundos.');
  }
  return encodeCycle({
    enabled,
    daysMask:currentConfig.daysMask,
    startMinutes:currentConfig.startMinutes,
    endMinutes:currentConfig.endMinutes,
    onMinutes:1,
    offMinutes:periodMinutes-1
  },currentRaw);
}

export async function getSecondsState(){
  return(await storeGet(PATH).catch(()=>null))||{enabled:false};
}

export async function setSecondsAutomationsEnabled(enabled){
  const state=await getSecondsState();
  if(!state.enabled)return state;

  const deviceId=getDeviceId();
  const current=await readDevice(deviceId);
  const cfg=current.cycleConfig||{
    daysMask:state.days_mask,
    startMinutes:state.start_minutes,
    endMinutes:state.end_minutes
  };
  if(!cfg)throw new Error('Programação do EKAZA não disponível.');

  const encoded=modeCycleRaw(
    current.cycleRaw||state.mode_cycle_raw||state.native_cycle_raw,
    cfg,
    Boolean(enabled),
    state.on_seconds,
    state.off_seconds
  );
  await writeCycle(deviceId,encoded.raw);

  const next={
    ...state,
    automations_enabled:Boolean(enabled),
    paused_by_weather:enabled?false:state.paused_by_weather,
    mode_cycle_raw:encoded.raw,
    updated_at:Date.now()
  };
  await storeSet(PATH,next);
  return next;
}

export async function configureSecondsMode({onSeconds=30,offSeconds=90}={}){
  const deviceId=getDeviceId();
  const current=await readDevice(deviceId);
  const cycle=current.cycleConfig;
  if(!cycle)throw new Error('Atualize a programação do EKAZA antes de ativar o modo em segundos.');

  onSeconds=Math.max(1,Math.min(60,Math.round(Number(onSeconds)||30)));
  offSeconds=Math.max(1,Math.min(65535,Math.round(Number(offSeconds)||90)));

  const modeCycle=modeCycleRaw(current.cycleRaw,cycle,true,onSeconds,offSeconds);
  const inchingRaw=encodeInching(current.inchingRaw,true,onSeconds);

  const previous=await getSecondsState();
  try{
    // Primeiro garante o desligamento local curto.
    await writeInching(deviceId,inchingRaw);

    // Depois troca o ciclo nativo para o período total desejado.
    await writeCycle(deviceId,modeCycle.raw);

    const state={
      enabled:true,
      engine:'native_cycle+inching',
      on_seconds:onSeconds,
      off_seconds:offSeconds,
      cycle_period_minutes:(onSeconds+offSeconds)/60,
      native_cycle_on_minutes:1,
      native_cycle_off_minutes:((onSeconds+offSeconds)/60)-1,
      start_minutes:cycle.startMinutes,
      end_minutes:cycle.endMinutes,
      days_mask:cycle.daysMask,
      native_cycle_raw:previous?.enabled?previous.native_cycle_raw:current.cycleRaw,
      native_cycle_was_enabled:previous?.enabled?Boolean(previous.native_cycle_was_enabled):Boolean(cycle.enabled),
      native_inching_raw:previous?.enabled?(previous.native_inching_raw||''):(current.inchingRaw||''),
      inching_raw:inchingRaw,
      mode_cycle_raw:modeCycle.raw,
      auto_off_local:true,
      automations_enabled:true,
      paused_by_weather:false,
      configured_at:Date.now()
    };
    await storeSet(PATH,state);

    if(insideWindow(cycle)){
      await setRelay(deviceId,true);
    }else{
      await setRelay(deviceId,false);
    }
    return state;
  }catch(error){
    // Se algo falhar, restaura imediatamente as configurações anteriores.
    if(current.inchingRaw)await writeInching(deviceId,current.inchingRaw).catch(()=>null);
    if(current.cycleRaw)await writeCycle(deviceId,current.cycleRaw).catch(()=>null);
    throw error;
  }
}

export async function disableSecondsMode({restoreNative=true}={}){
  const deviceId=getDeviceId();
  const state=await getSecondsState();

  await setRelay(deviceId,false).catch(()=>null);

  if(state.native_inching_raw){
    await writeInching(deviceId,state.native_inching_raw).catch(()=>null);
  }else if(state.inching_raw){
    await writeInching(deviceId,encodeInching(state.inching_raw,false,state.on_seconds||30)).catch(()=>null);
  }

  if(restoreNative&&state.native_cycle_raw){
    await writeCycle(deviceId,state.native_cycle_raw).catch(()=>null);
  }

  const next={
    ...state,
    enabled:false,
    automations_enabled:false,
    paused_by_weather:false,
    disabled_at:Date.now()
  };
  await storeSet(PATH,next);
  return next;
}

export async function pauseSecondsForWeather(){
  const state=await getSecondsState();
  if(!state.enabled)return state;

  const paused=await setSecondsAutomationsEnabled(false);
  await setRelay(getDeviceId(),false).catch(()=>null);

  const next={
    ...paused,
    paused_by_weather:true,
    weather_paused_at:Date.now()
  };
  await storeSet(PATH,next);
  return next;
}

export async function resumeSecondsAfterWeather(){
  const state=await getSecondsState();
  if(!state.enabled)return state;

  const resumed=await setSecondsAutomationsEnabled(true);
  const cfg={
    daysMask:resumed.days_mask,
    startMinutes:resumed.start_minutes,
    endMinutes:resumed.end_minutes
  };
  if(insideWindow(cfg))await setRelay(getDeviceId(),true);
  else await setRelay(getDeviceId(),false);

  const next={
    ...resumed,
    paused_by_weather:false,
    weather_resumed_at:Date.now()
  };
  await storeSet(PATH,next);
  return next;
}
