import { getDeviceId, tuyaRequest } from '../_tuya.js';
import { decodeCycle } from '../_cycle.js';
import { storeGet, storeSet } from '../irrigation/_store.js';

const PATH='IrrigacaoFazenda2E/viveiroSeconds';
const TZ='America/Porto_Velho';

function hhmm(mins){
  const n=Math.max(0,Math.min(1439,Number(mins)||0));
  return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
}
function days(mask){
  return [0,1,2,3,4,5,6].filter(i=>Number(mask||0)&(1<<i)).join(',');
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
function bodyDeviceTrigger(name,deviceId,statusValue,delaySeconds,nextValue,preStart,preEnd,dayList){
  return{
    name,
    dsl:{
      conditions:[{
        trigger_type:'deviceReport',
        trigger_id:deviceId,
        trigger_rule:{status_code:'switch_1',comparator:'==',status_value:statusValue},
        rule_num:1
      }],
      conditions_rule:'all',
      actions:[
        {execution_type:'delay',execution_rule:{delay_seconds:delaySeconds}},
        {execution_type:'deviceIssue',execution_rule:{execution_id:deviceId,function_code:'switch_1',function_value:nextValue}}
      ]
    },
    preconditions:{
      trigger_type:'timeCheck',
      precondition_trigger_rule:{timer_format:`${preStart}-${preEnd} * * ${dayList} *`}
    }
  };
}
function bodyTimer(name,deviceId,time,dayList,value){
  return{
    name,
    dsl:{
      conditions:[{
        trigger_type:'timer',
        trigger_id:'timer',
        trigger_rule:{timer_format:`${time} * * ${dayList} *`},
        rule_num:1
      }],
      conditions_rule:'all',
      actions:[{
        execution_type:'deviceIssue',
        execution_rule:{execution_id:deviceId,function_code:'switch_1',function_value:value}
      }]
    }
  };
}
async function createAutomation(body){
  return tuyaRequest('POST','/v2.0/iot-03/automations',body);
}
async function enableAutomation(id,enabled){
  if(!id)return;
  return tuyaRequest('PUT',`/v2.0/iot-03/automations/${id}/${enabled?'enable':'disable'}`);
}
async function deleteAutomation(id){
  if(!id)return;
  try{return await tuyaRequest('DELETE',`/v2.0/iot-03/automations/${id}`)}catch{return null}
}
async function setRelay(deviceId,on){
  return tuyaRequest('POST',`/v1.0/iot-03/devices/${deviceId}/commands`,{commands:[{code:'switch_1',value:Boolean(on)}]});
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
  return tuyaRequest('POST',`/v1.0/iot-03/devices/${deviceId}/commands`,{commands:[{code:'switch_inching',value:raw}]});
}
async function writeCycle(deviceId,raw){
  if(!raw)return;
  return tuyaRequest('POST',`/v1.0/iot-03/devices/${deviceId}/commands`,{commands:[{code:'cycle_time',value:raw}]});
}
function disabledCycleRaw(current){
  if(!current?.raw||!current?.config)return current?.raw||'';
  const b=Buffer.from(current.raw,'base64');
  if(b.length>=1)b[0]=b[0]&0xfe;
  return b.toString('base64');
}
export async function getSecondsState(){
  return(await storeGet(PATH).catch(()=>null))||{enabled:false};
}
export async function setSecondsAutomationsEnabled(enabled){
  const s=await getSecondsState();
  const ids=s.automation_ids||{};
  await Promise.allSettled(Object.values(ids).map(id=>enableAutomation(id,enabled)));
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
  offSeconds=Math.max(1,Math.min(18000,Math.round(Number(offSeconds)||90)));
  const dayList=days(cycle.config.daysMask);
  if(!dayList)throw new Error('Nenhum dia da semana está selecionado no ciclo atual.');

  const start=hhmm(cycle.config.startMinutes),end=hhmm(cycle.config.endMinutes);
  const safeEndMinutes=Math.max(Number(cycle.config.startMinutes)+1,Number(cycle.config.endMinutes)-Math.max(1,Math.ceil(offSeconds/60)));
  const safeEnd=hhmm(safeEndMinutes);

  const created=[];
  try{
    const offToOn=await createAutomation(bodyDeviceTrigger('F2E Viveiro • OFF→ON',deviceId,false,offSeconds,true,start,safeEnd,dayList));created.push(offToOn);
    const startId=await createAutomation(bodyTimer('F2E Viveiro • início',deviceId,start,dayList,true));created.push(startId);
    const endId=await createAutomation(bodyTimer('F2E Viveiro • fim',deviceId,end,dayList,false));created.push(endId);

    await Promise.allSettled(created.map(id=>enableAutomation(id,false)));

    const previous=await getSecondsState();
    if(previous?.automation_ids){
      await Promise.allSettled(Object.values(previous.automation_ids).map(deleteAutomation));
    }

    const inchingRaw=encodeInching(cycle.inchingRaw,true,onSeconds);
    await writeInching(deviceId,inchingRaw);

    if(cycle.config.enabled){
      const disabled=disabledCycleRaw(cycle);
      await writeCycle(deviceId,disabled);
    }

    const state={
      enabled:true,
      on_seconds:onSeconds,
      off_seconds:offSeconds,
      start_minutes:cycle.config.startMinutes,
      end_minutes:cycle.config.endMinutes,
      days_mask:cycle.config.daysMask,
      native_cycle_raw:cycle.raw,
      native_cycle_was_enabled:Boolean(cycle.config.enabled),
      native_inching_raw:cycle.inchingRaw||'',
      inching_raw:inchingRaw,
      auto_off_local:true,
      automation_ids:{off_to_on:offToOn,start:startId,end:endId},
      automations_enabled:true,
      configured_at:Date.now()
    };
    await storeSet(PATH,state);
    await Promise.all(Object.values(state.automation_ids).map(id=>enableAutomation(id,true)));

    if(insideWindow(cycle.config)){
      await setRelay(deviceId,true);
    }else{
      await setRelay(deviceId,false);
    }
    return state;
  }catch(error){
    await Promise.allSettled(created.map(deleteAutomation));
    throw error;
  }
}
export async function disableSecondsMode({restoreNative=true}={}){
  const deviceId=getDeviceId();
  const state=await getSecondsState();
  await Promise.allSettled(Object.values(state.automation_ids||{}).map(id=>enableAutomation(id,false)));
  await setRelay(deviceId,false).catch(()=>null);
  if(state.native_inching_raw){
    await writeInching(deviceId,state.native_inching_raw).catch(()=>null);
  }else if(state.inching_raw){
    await writeInching(deviceId,encodeInching(state.inching_raw,false,state.on_seconds||30)).catch(()=>null);
  }
  if(restoreNative&&state.native_cycle_raw){
    await writeCycle(deviceId,state.native_cycle_raw).catch(()=>null);
  }
  await Promise.allSettled(Object.values(state.automation_ids||{}).map(deleteAutomation));
  const next={...state,enabled:false,automations_enabled:false,automation_ids:{},disabled_at:Date.now()};
  await storeSet(PATH,next);
  return next;
}
export async function pauseSecondsForWeather(){
  const state=await getSecondsState();
  if(!state.enabled)return state;
  await setSecondsAutomationsEnabled(false);
  await setRelay(getDeviceId(),false).catch(()=>null);
  const next={...(await getSecondsState()),paused_by_weather:true,weather_paused_at:Date.now()};
  await storeSet(PATH,next);return next;
}
export async function resumeSecondsAfterWeather(){
  const state=await getSecondsState();
  if(!state.enabled)return state;
  await setSecondsAutomationsEnabled(true);
  const cfg={daysMask:state.days_mask,startMinutes:state.start_minutes,endMinutes:state.end_minutes};
  if(insideWindow(cfg))await setRelay(getDeviceId(),true);else await setRelay(getDeviceId(),false);
  const next={...(await getSecondsState()),paused_by_weather:false,weather_resumed_at:Date.now()};
  await storeSet(PATH,next);return next;
}
