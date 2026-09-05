import { getDeviceId, tuyaRequest } from '../_tuya.js';
import { decodeCycle } from '../_cycle.js';
import { storeGet, storeSet } from '../irrigation/_store.js';

const PATH='IrrigacaoFazenda2E/viveiroSeconds';
const CATEGORY='fazenda2e_seconds';
const TZ='America/Porto_Velho';
const TZ_OFFSET='-04:00';

function hhmm(mins){
  const n=Math.max(0,Math.min(1439,Number(mins)||0));
  return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
}
function loopsFromMask(mask){
  return [0,1,2,3,4,5,6].map(i=>(Number(mask||0)&(1<<i))?'1':'0').join('');
}
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
async function getCycle(deviceId){
  const [statusR,shadowR]=await Promise.allSettled([
    tuyaRequest('GET',`/v1.0/iot-03/devices/${deviceId}/status`),
    tuyaRequest('GET',`/v2.0/cloud/thing/${deviceId}/shadow/properties`)
  ]);
  const status=Array.isArray(statusR.value)?statusR.value:[];
  const sm=Object.fromEntries(status.map(x=>[x.code,x.value]));
  const props=Array.isArray(shadowR.value?.properties)?shadowR.value.properties:[];
  const shm=Object.fromEntries(props.map(x=>[x.code,x.value]));
  const raw=typeof shm.cycle_time==='string'?shm.cycle_time:(typeof sm.cycle_time==='string'?sm.cycle_time:'');
  const inching=typeof shm.switch_inching==='string'?shm.switch_inching:(typeof sm.switch_inching==='string'?sm.switch_inching:'');
  return{raw,config:decodeCycle(raw),inchingRaw:inching};
}
async function writeInching(deviceId,raw){
  return tuyaRequest('POST',`/v1.0/iot-03/devices/${deviceId}/commands`,{
    commands:[{code:'switch_inching',value:raw}]
  });
}
async function writeCycle(deviceId,raw){
  if(!raw)return;
  return tuyaRequest('POST',`/v1.0/iot-03/devices/${deviceId}/commands`,{
    commands:[{code:'cycle_time',value:raw}]
  });
}
function disabledCycleRaw(current){
  if(!current?.raw||!current?.config)return current?.raw||'';
  const b=Buffer.from(current.raw,'base64');
  if(b.length>=1)b[0]=b[0]&0xfe;
  return b.toString('base64');
}
function buildPulseMinutes(startMinutes,endMinutes,intervalMinutes){
  const out=[];
  for(let m=Number(startMinutes);m<Number(endMinutes);m+=intervalMinutes)out.push(m);
  return out;
}
async function deleteTimerCategory(deviceId){
  try{
    await tuyaRequest('DELETE',`/v1.0/devices/${deviceId}/timers/categories/${CATEGORY}`);
  }catch{}
}
async function addTimerGroup(deviceId,loops,times,index){
  const instruct=times.map(minute=>({
    functions:[{code:'switch_1',value:true}],
    date:'',
    time:hhmm(minute)
  }));
  return tuyaRequest('POST',`/v1.0/devices/${deviceId}/timers`,{
    category:CATEGORY,
    loops,
    time_zone:TZ_OFFSET,
    timezone_id:TZ,
    alias_name:`F2E Viveiro pulsos ${index+1}`,
    instruct
  });
}
async function setTimerGroupEnabled(deviceId,groupId,enabled){
  if(!groupId)return;
  return tuyaRequest('PUT',`/v1.0/devices/${deviceId}/timers/categories/${CATEGORY}/groups/${groupId}/status`,{
    value:enabled?'1':'0'
  });
}
async function cleanLegacySceneAutomations(state){
  const ids=Object.values(state?.automation_ids||{});
  for(const id of ids){
    try{await tuyaRequest('DELETE',`/v2.0/iot-03/automations/${id}`)}catch{}
  }
}

export async function getSecondsState(){
  return(await storeGet(PATH).catch(()=>null))||{enabled:false};
}

export async function setSecondsAutomationsEnabled(enabled){
  const s=await getSecondsState();
  const deviceId=getDeviceId();
  const groups=Array.isArray(s.timer_group_ids)?s.timer_group_ids:[];
  await Promise.allSettled(groups.map(id=>setTimerGroupEnabled(deviceId,id,enabled)));
  s.automations_enabled=Boolean(enabled);
  s.updated_at=Date.now();
  await storeSet(PATH,s);
  return s;
}

export async function configureSecondsMode({onSeconds=30,offSeconds=90}={}){
  const deviceId=getDeviceId();
  const cycle=await getCycle(deviceId);
  if(!cycle.config)throw new Error('Atualize a programação do EKAZA antes de ativar o modo em segundos.');

  onSeconds=Math.max(1,Math.min(65535,Math.round(Number(onSeconds)||30)));
  offSeconds=Math.max(1,Math.min(65535,Math.round(Number(offSeconds)||90)));

  const fullCycleSeconds=onSeconds+offSeconds;
  if(fullCycleSeconds%60!==0){
    throw new Error('Para repetir continuamente sem Scene Automation, a soma ligado + desligado precisa ser múltipla de 60 segundos. Exemplo: 30 + 90 = 120 s.');
  }
  const intervalMinutes=fullCycleSeconds/60;
  if(intervalMinutes<1)throw new Error('Intervalo inválido.');

  const loops=loopsFromMask(cycle.config.daysMask);
  if(!loops.includes('1'))throw new Error('Nenhum dia da semana está selecionado no ciclo atual.');

  const pulseMinutes=buildPulseMinutes(cycle.config.startMinutes,cycle.config.endMinutes,intervalMinutes);
  if(!pulseMinutes.length)throw new Error('A janela programada é curta demais para criar os pulsos.');

  const previous=await getSecondsState();
  await cleanLegacySceneAutomations(previous);
  await deleteTimerCategory(deviceId);

  const createdGroups=[];
  const chunkSize=25;
  let nativeCycleDisabled=false;
  let inchingRaw='';
  try{
    if(cycle.config.enabled){
      const disabled=disabledCycleRaw(cycle);
      await writeCycle(deviceId,disabled);
      nativeCycleDisabled=true;
    }

    inchingRaw=encodeInching(cycle.inchingRaw,true,onSeconds);
    await writeInching(deviceId,inchingRaw);

    for(let i=0;i<pulseMinutes.length;i+=chunkSize){
      const chunk=pulseMinutes.slice(i,i+chunkSize);
      const result=await addTimerGroup(deviceId,loops,chunk,createdGroups.length);
      const groupId=String(result?.group_id||result?.id||result||'').trim();
      if(!groupId)throw new Error('A Tuya não retornou o ID do grupo de temporização.');
      createdGroups.push(groupId);
    }

    const state={
      enabled:true,
      engine:'device_timer+inching',
      on_seconds:onSeconds,
      off_seconds:offSeconds,
      interval_minutes:intervalMinutes,
      start_minutes:cycle.config.startMinutes,
      end_minutes:cycle.config.endMinutes,
      days_mask:cycle.config.daysMask,
      native_cycle_raw:cycle.raw,
      native_cycle_was_enabled:Boolean(cycle.config.enabled),
      native_inching_raw:cycle.inchingRaw||'',
      inching_raw:inchingRaw,
      auto_off_local:true,
      timer_category:CATEGORY,
      timer_group_ids:createdGroups,
      pulse_count:pulseMinutes.length,
      automations_enabled:true,
      configured_at:Date.now()
    };
    await storeSet(PATH,state);

    if(insideWindow(cycle.config)){
      await setRelay(deviceId,true);
    }else{
      await setRelay(deviceId,false);
    }
    return state;
  }catch(error){
    await deleteTimerCategory(deviceId).catch(()=>null);
    if(cycle.inchingRaw)await writeInching(deviceId,cycle.inchingRaw).catch(()=>null);
    else if(inchingRaw)await writeInching(deviceId,encodeInching(inchingRaw,false,onSeconds)).catch(()=>null);
    if(nativeCycleDisabled&&cycle.raw)await writeCycle(deviceId,cycle.raw).catch(()=>null);
    throw error;
  }
}

export async function disableSecondsMode({restoreNative=true}={}){
  const deviceId=getDeviceId();
  const state=await getSecondsState();

  await deleteTimerCategory(deviceId);
  await cleanLegacySceneAutomations(state);
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
    timer_group_ids:[],
    automation_ids:{},
    disabled_at:Date.now()
  };
  await storeSet(PATH,next);
  return next;
}

export async function pauseSecondsForWeather(){
  const state=await getSecondsState();
  if(!state.enabled)return state;
  await setSecondsAutomationsEnabled(false);
  await setRelay(getDeviceId(),false).catch(()=>null);
  const next={...(await getSecondsState()),paused_by_weather:true,weather_paused_at:Date.now()};
  await storeSet(PATH,next);
  return next;
}

export async function resumeSecondsAfterWeather(){
  const state=await getSecondsState();
  if(!state.enabled)return state;
  await setSecondsAutomationsEnabled(true);
  const cfg={daysMask:state.days_mask,startMinutes:state.start_minutes,endMinutes:state.end_minutes};
  if(insideWindow(cfg))await setRelay(getDeviceId(),true);
  else await setRelay(getDeviceId(),false);
  const next={...(await getSecondsState()),paused_by_weather:false,weather_resumed_at:Date.now()};
  await storeSet(PATH,next);
  return next;
}
