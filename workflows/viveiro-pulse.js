import { sleep } from 'workflow';
import { getDeviceId, tuyaRequest } from '../server/api/_tuya.js';
import { appendHistory, storePatch } from '../server/api/irrigation/_store.js';
import { getSecondsState } from '../server/api/viveiro/_seconds.js';
import { runViveiroWeatherCheck } from '../server/api/viveiro/_weather_logic.js';

const TZ='America/Porto_Velho';
const STATE_PATH='IrrigacaoFazenda2E/viveiroSeconds';

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
      const wait=(86400-nowSec)+(add-1)*86400+startSec;
      return{inside:false,seconds_until_end:0,wait_seconds:Math.max(1,wait)};
    }
  }
  return{inside:false,seconds_until_end:0,wait_seconds:3600};
}

function normalizeStatus(result){
  if(Array.isArray(result))return result;
  if(Array.isArray(result?.status))return result.status;
  if(Array.isArray(result?.result))return result.result;
  return[];
}

async function contextStep(generation){
  'use step';

  let state=await getSecondsState();
  if(!state.enabled||state.engine!=='vercel_workflow'||state.generation!==generation){
    return{active:false};
  }

  let weather=null;
  try{
    weather=await runViveiroWeatherCheck();
  }catch(error){
    weather={ok:false,error:error?.message||String(error)};
  }

  state=await getSecondsState();
  if(!state.enabled||state.generation!==generation)return{active:false};

  const schedule=localSchedule(state);
  const weatherStatus=String(weather?.state?.status||'');
  const weatherBlocked=[
    'paused_rain',
    'waiting_resume_delay',
    'paused_waiting_weather'
  ].includes(weatherStatus)||Boolean(state.paused_by_weather);

  let waitSeconds=schedule.wait_seconds||5;
  if(weatherBlocked){
    if(weatherStatus==='waiting_resume_delay'&&Number(weather?.state?.resumeEligibleAt||0)>Date.now()){
      waitSeconds=Math.max(5,Math.ceil((Number(weather.state.resumeEligibleAt)-Date.now())/1000));
    }else if(weatherStatus==='paused_rain'){
      waitSeconds=15;
    }else{
      waitSeconds=30;
    }
  }

  return{
    active:true,
    allowed:schedule.inside&&!weatherBlocked,
    weather_blocked:weatherBlocked,
    weather_status:weatherStatus,
    wait_seconds:Math.max(1,waitSeconds),
    seconds_until_end:schedule.seconds_until_end,
    on_seconds:Math.max(1,Number(state.on_seconds||30)),
    off_seconds:Math.max(1,Number(state.off_seconds||90)),
    pulse_count:Number(state.pulse_count||0)
  };
}

async function relayStep(generation,on){
  'use step';

  const state=await getSecondsState();
  if(!state.enabled||state.generation!==generation)return{ok:false,inactive:true};

  const deviceId=getDeviceId();
  const attempts=on?3:6;
  let lastError='';

  for(let i=0;i<attempts;i++){
    try{
      await tuyaRequest('POST',`/v1.0/iot-03/devices/${deviceId}/commands`,{
        commands:[{code:'switch_1',value:Boolean(on)}]
      });
    }catch(error){
      lastError=error?.message||String(error);
    }

    await new Promise(resolve=>setTimeout(resolve,500));

    try{
      const r=await tuyaRequest('GET',`/v1.0/iot-03/devices/${deviceId}/status`);
      const map=Object.fromEntries(normalizeStatus(r).map(x=>[x.code,x.value]));
      if(map.switch_1===Boolean(on)){
        await storePatch(STATE_PATH,{
          relay_expected:Boolean(on),
          phase:on?'on':'off',
          last_transition_at:Date.now(),
          last_error:null
        });
        return{ok:true,on:Boolean(on)};
      }
    }catch(error){
      lastError=error?.message||String(error);
    }
  }

  if(!on){
    // Falha ao confirmar desligamento: encerra o modo por segurança.
    await storePatch(STATE_PATH,{
      enabled:false,
      relay_expected:false,
      phase:'error',
      last_error:'Não foi possível confirmar o desligamento do viveiro. '+lastError,
      fault_at:Date.now()
    });
    await appendHistory({
      type:'viveiro_pulse_error',
      source:'vercel_workflow',
      status:'critical',
      detail:'Não foi possível confirmar o desligamento do viveiro. '+lastError
    }).catch(()=>null);
  }

  return{ok:false,on:Boolean(on),error:lastError};
}

async function completePulseStep(generation){
  'use step';
  const state=await getSecondsState();
  if(!state.enabled||state.generation!==generation)return{active:false};

  const count=Number(state.pulse_count||0)+1;
  await storePatch(STATE_PATH,{
    pulse_count:count,
    last_pulse_at:Date.now(),
    phase:'off',
    relay_expected:false
  });
  return{active:true,pulse_count:count};
}

async function finishStep(generation,reason){
  'use step';
  const state=await getSecondsState();
  if(state.generation!==generation)return;
  try{
    await tuyaRequest('POST',`/v1.0/iot-03/devices/${getDeviceId()}/commands`,{
      commands:[{code:'switch_1',value:false}]
    });
  }catch{}
  await storePatch(STATE_PATH,{
    relay_expected:false,
    phase:reason||'finished',
    workflow_finished_at:Date.now()
  }).catch(()=>null);
}

export async function viveiroPulseWorkflow(generation){
  'use workflow';

  while(true){
    const ctx=await contextStep(generation);
    if(!ctx.active){
      await finishStep(generation,'stopped');
      return{ok:true,reason:'stopped'};
    }

    if(!ctx.allowed){
      await sleep(`${Math.max(1,ctx.wait_seconds)} seconds`);
      continue;
    }

    const started=await relayStep(generation,true);
    if(!started.ok){
      if(started.inactive)return{ok:true,reason:'stopped'};
      await sleep('15 seconds');
      continue;
    }

    const maxOn=Math.max(1,Math.min(ctx.on_seconds,ctx.seconds_until_end||ctx.on_seconds));
    let elapsed=0;
    let interrupted=false;

    while(elapsed<maxOn){
      const chunk=Math.min(5,maxOn-elapsed);
      await sleep(`${chunk} seconds`);
      elapsed+=chunk;

      const guard=await contextStep(generation);
      if(!guard.active||!guard.allowed){
        interrupted=true;
        break;
      }
    }

    const stopped=await relayStep(generation,false);
    if(!stopped.ok){
      await finishStep(generation,'error');
      return{ok:false,reason:'off_not_confirmed'};
    }

    await completePulseStep(generation);

    if(interrupted)continue;

    const after=await contextStep(generation);
    if(!after.active){
      await finishStep(generation,'stopped');
      return{ok:true,reason:'stopped'};
    }
    if(!after.allowed)continue;

    await sleep(`${Math.max(1,ctx.off_seconds)} seconds`);
  }
}
