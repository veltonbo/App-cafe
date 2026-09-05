import { QueueClient } from '@vercel/queue';
import { getDeviceId, tuyaRequest } from '../server/api/_tuya.js';
import { appendHistory, storePatch } from '../server/api/irrigation/_store.js';
import { getSecondsState } from '../server/api/viveiro/_seconds.js';
import { runViveiroWeatherCheck } from '../server/api/viveiro/_weather_logic.js';

const TOPIC='viveiro-pulse';
const STATE_PATH='IrrigacaoFazenda2E/viveiroSeconds';
const queue=new QueueClient();
const {send,handleNodeCallback}=queue;
const TZ='America/Porto_Velho';

function normalizeStatus(result){
  if(Array.isArray(result))return result;
  if(Array.isArray(result?.status))return result.status;
  if(Array.isArray(result?.result))return result.result;
  return[];
}

function localSchedule(state){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
    timeZone:TZ,
    weekday:'short',
    hour:'2-digit',
    minute:'2-digit',
    second:'2-digit',
    hourCycle:'h23'
  }).formatToParts(new Date()).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  const dayMap={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  const day=dayMap[parts.weekday]??0;
  const nowSec=Number(parts.hour)*3600+Number(parts.minute)*60+Number(parts.second);
  const startSec=Number(state.start_minutes||0)*60;
  const endSec=Number(state.end_minutes||0)*60;
  const mask=Number(state.days_mask||0);
  const todayAllowed=Boolean(mask&(1<<day));

  if(todayAllowed&&nowSec>=startSec&&nowSec<endSec){
    return{inside:true,seconds_until_end:Math.max(1,endSec-nowSec),wait_seconds:0};
  }
  if(todayAllowed&&nowSec<startSec){
    return{inside:false,seconds_until_end:0,wait_seconds:Math.max(1,startSec-nowSec)};
  }

  for(let add=1;add<=7;add++){
    const nextDay=(day+add)%7;
    if(mask&(1<<nextDay)){
      return{
        inside:false,
        seconds_until_end:0,
        wait_seconds:Math.max(1,(86400-nowSec)+(add-1)*86400+startSec)
      };
    }
  }
  return{inside:false,seconds_until_end:0,wait_seconds:3600};
}

async function relay(on){
  const deviceId=getDeviceId();
  let lastError='';
  const attempts=on?3:7;

  for(let i=0;i<attempts;i++){
    try{
      await tuyaRequest('POST',`/v1.0/iot-03/devices/${deviceId}/commands`,{
        commands:[{code:'switch_1',value:Boolean(on)}]
      });
    }catch(error){
      lastError=error?.message||String(error);
    }

    await new Promise(resolve=>setTimeout(resolve,450));

    try{
      const r=await tuyaRequest('GET',`/v1.0/iot-03/devices/${deviceId}/status`);
      const map=Object.fromEntries(normalizeStatus(r).map(x=>[x.code,x.value]));
      if(map.switch_1===Boolean(on))return{ok:true};
    }catch(error){
      lastError=error?.message||String(error);
    }
  }
  return{ok:false,error:lastError||'EKAZA não confirmou o estado da saída.'};
}

async function enqueue(message,delaySeconds){
  const key=['viveiro',message.generation,message.action,message.seq,message.attempt||0].join(':');
  return send(TOPIC,message,{
    delaySeconds:Math.max(0,Math.min(3600,Math.round(Number(delaySeconds)||0))),
    retentionSeconds:86400,
    idempotencyKey:key
  });
}

async function weatherAndSchedule(state){
  let weather=null;
  try{weather=await runViveiroWeatherCheck()}catch(error){
    weather={ok:false,error:error?.message||String(error)};
  }

  const latest=await getSecondsState();
  if(!latest.enabled||latest.generation!==state.generation){
    return{active:false,state:latest};
  }

  const schedule=localSchedule(latest);
  const weatherStatus=String(weather?.state?.status||'');
  const weatherBlocked=[
    'paused_rain',
    'waiting_resume_delay',
    'paused_waiting_weather'
  ].includes(weatherStatus)||Boolean(latest.paused_by_weather);

  let waitSeconds=schedule.wait_seconds||15;
  if(weatherBlocked){
    if(weatherStatus==='waiting_resume_delay'&&Number(weather?.state?.resumeEligibleAt||0)>Date.now()){
      waitSeconds=Math.max(5,Math.ceil((Number(weather.state.resumeEligibleAt)-Date.now())/1000));
    }else{
      waitSeconds=15;
    }
  }

  return{
    active:true,
    state:latest,
    allowed:schedule.inside&&!weatherBlocked,
    schedule,
    weatherBlocked,
    weatherStatus,
    waitSeconds
  };
}

async function failSafe(state,detail){
  await relay(false).catch(()=>null);
  await storePatch(STATE_PATH,{
    enabled:false,
    relay_expected:false,
    phase:'error',
    last_error:detail,
    fault_at:Date.now()
  }).catch(()=>null);
  await appendHistory({
    type:'viveiro_pulse_error',
    source:'vercel_queue',
    status:'critical',
    detail
  }).catch(()=>null);
}

async function processMessage(message){
  const generation=String(message?.generation||'');
  const action=String(message?.action||'');
  const seq=Number(message?.seq||0);
  const attempt=Number(message?.attempt||0);

  let state=await getSecondsState();
  if(!state.enabled||state.generation!==generation)return;
  if(Number(state.transition_seq||0)!==seq)return;

  if(action==='check'){
    if(String(state.expected_action||'on')!=='on')return;
    const ctx=await weatherAndSchedule(state);
    if(!ctx.active)return;

    if(ctx.allowed){
      await enqueue({generation,action:'on',seq,attempt:attempt+1},0);
    }else{
      const delay=Math.max(5,Math.min(604800,Number(ctx.waitSeconds||15)));
      await storePatch(STATE_PATH,{
        phase:ctx.weatherBlocked?'weather_blocked':'waiting_window',
        relay_expected:false
      });
      await enqueue({generation,action:'check',seq,attempt:attempt+1},delay);
    }
    return;
  }

  if(action==='on'){
    if(String(state.expected_action||'on')!=='on')return;

    const ctx=await weatherAndSchedule(state);
    if(!ctx.active)return;
    if(!ctx.allowed){
      const delay=Math.max(5,Math.min(604800,Number(ctx.waitSeconds||15)));
      await storePatch(STATE_PATH,{
        phase:ctx.weatherBlocked?'weather_blocked':'waiting_window',
        relay_expected:false
      });
      await enqueue({generation,action:'check',seq,attempt:attempt+1},delay);
      return;
    }

    const turnedOn=await relay(true);
    if(!turnedOn.ok){
      await storePatch(STATE_PATH,{phase:'retry_on',last_error:turnedOn.error});
      await enqueue({generation,action:'on',seq,attempt:attempt+1},15);
      return;
    }

    const nextSeq=seq+1;
    const onSeconds=Math.max(1,Math.min(Number(ctx.state.on_seconds||30),Number(ctx.schedule.seconds_until_end||30)));
    const expectedOffAt=Date.now()+onSeconds*1000;

    await storePatch(STATE_PATH,{
      phase:'on',
      relay_expected:true,
      expected_action:'off',
      transition_seq:nextSeq,
      current_on_started_at:Date.now(),
      expected_off_at:expectedOffAt,
      last_error:null
    });

    await enqueue({generation,action:'off',seq:nextSeq,attempt:0},onSeconds);
    if(onSeconds>5){
      await enqueue({generation,action:'guard',seq:nextSeq,attempt:0},5);
    }
    return;
  }

  if(action==='guard'){
    if(String(state.expected_action||'')!=='off')return;

    const ctx=await weatherAndSchedule(state);
    if(!ctx.active)return;

    if(!ctx.allowed){
      const stopped=await relay(false);
      if(!stopped.ok){
        await failSafe(state,'Não foi possível confirmar o desligamento durante a proteção do viveiro. '+stopped.error);
        return;
      }

      const nextSeq=seq+1;
      await storePatch(STATE_PATH,{
        phase:ctx.weatherBlocked?'weather_blocked':'waiting_window',
        relay_expected:false,
        expected_action:'on',
        transition_seq:nextSeq,
        current_on_started_at:null,
        expected_off_at:null
      });
      await enqueue({generation,action:'check',seq:nextSeq,attempt:0},Math.max(5,Number(ctx.waitSeconds||15)));
      return;
    }

    const remaining=Math.max(0,Math.ceil((Number(state.expected_off_at||0)-Date.now())/1000));
    if(remaining>5){
      await enqueue({generation,action:'guard',seq,attempt:attempt+1},5);
    }
    return;
  }

  if(action==='off'){
    if(String(state.expected_action||'')!=='off')return;

    const stopped=await relay(false);
    if(!stopped.ok){
      await failSafe(state,'Não foi possível confirmar o desligamento do viveiro. '+stopped.error);
      return;
    }

    state=await getSecondsState();
    if(!state.enabled||state.generation!==generation)return;

    const nextSeq=seq+1;
    const count=Number(state.pulse_count||0)+1;
    await storePatch(STATE_PATH,{
      phase:'off',
      relay_expected:false,
      expected_action:'on',
      transition_seq:nextSeq,
      pulse_count:count,
      last_pulse_at:Date.now(),
      current_on_started_at:null,
      expected_off_at:null,
      last_error:null
    });

    const ctx=await weatherAndSchedule(await getSecondsState());
    if(!ctx.active)return;

    if(ctx.allowed){
      await enqueue({generation,action:'on',seq:nextSeq,attempt:0},Math.max(1,Number(state.off_seconds||90)));
    }else{
      await enqueue({generation,action:'check',seq:nextSeq,attempt:0},Math.max(5,Number(ctx.waitSeconds||15)));
    }
  }
}

export default handleNodeCallback(async(message)=>{
  await processMessage(message);
},{visibilityTimeoutSeconds:45});
