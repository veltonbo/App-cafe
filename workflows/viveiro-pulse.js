import { sleep } from 'workflow';
import { getDeviceId, tuyaRequest } from '../server/api/_tuya.js';
import { fetchWeatherSnapshot } from '../server/api/weather/_weather.js';

const TZ='America/Porto_Velho';

function normalizeStatus(result){
  if(Array.isArray(result))return result;
  if(Array.isArray(result?.status))return result.status;
  if(Array.isArray(result?.result))return result.result;
  return[];
}

function localSchedule(config,nowDate=new Date()){
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
  const startSec=Number(config.start_minutes||0)*60;
  const endSec=Number(config.end_minutes||0)*60;
  const mask=Number(config.days_mask||0);
  const todayAllowed=Boolean(mask&(1<<day));

  if(todayAllowed&&nowSec>=startSec&&nowSec<endSec){
    return{
      inside:true,
      seconds_until_end:Math.max(1,endSec-nowSec),
      wait_seconds:0
    };
  }

  if(todayAllowed&&nowSec<startSec){
    return{
      inside:false,
      seconds_until_end:0,
      wait_seconds:Math.max(1,startSec-nowSec)
    };
  }

  for(let add=1;add<=7;add++){
    const nextDay=(day+add)%7;
    if(mask&(1<<nextDay)){
      const wait=(86400-nowSec)+(add-1)*86400+startSec;
      return{
        inside:false,
        seconds_until_end:0,
        wait_seconds:Math.max(1,wait)
      };
    }
  }

  return{inside:false,seconds_until_end:0,wait_seconds:3600};
}

async function environmentStep(config){
  'use step';

  const now=Date.now();
  const schedule=localSchedule(config,new Date(now));

  let weather=null;
  try{
    weather=await fetchWeatherSnapshot();
  }catch(error){
    weather={linked:false,error:error?.message||String(error)};
  }

  return{
    now,
    schedule,
    weather_available:Boolean(weather?.linked&&weather?.metrics),
    raining:Boolean(weather?.metrics?.rainDetected),
    weather_error:weather?.error||null
  };
}

async function relayStep(on){
  'use step';

  const deviceId=getDeviceId();
  let lastError='';

  for(let i=0;i<(on?4:10);i++){
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
      if(map.switch_1===Boolean(on)){
        return{ok:true,on:Boolean(on)};
      }
    }catch(error){
      lastError=error?.message||String(error);
    }
  }

  return{ok:false,on:Boolean(on),error:lastError};
}

async function ensureOff(){
  'use step';
  return relayStep(false);
}

export async function viveiroPulseWorkflow(config){
  'use workflow';

  let rainHoldUntil=0;

  while(true){
    const env=await environmentStep(config);

    if(env.raining){
      rainHoldUntil=Math.max(
        rainHoldUntil,
        env.now+Math.max(0,Number(config.resume_delay_minutes||0))*60000
      );

      let off=await relayStep(false);
      while(!off.ok){
        await sleep('5 seconds');
        off=await relayStep(false);
      }

      await sleep('15 seconds');
      continue;
    }

    if(rainHoldUntil>env.now){
      let off=await relayStep(false);
      while(!off.ok){
        await sleep('5 seconds');
        off=await relayStep(false);
      }

      const remaining=Math.ceil((rainHoldUntil-env.now)/1000);
      await sleep(`${Math.max(1,Math.min(30,remaining))} seconds`);
      continue;
    }

    if(!env.schedule.inside){
      let off=await relayStep(false);
      while(!off.ok){
        await sleep('5 seconds');
        off=await relayStep(false);
      }

      await sleep(`${Math.max(1,Math.min(3600,env.schedule.wait_seconds||30))} seconds`);
      continue;
    }

    const started=await relayStep(true);
    if(!started.ok){
      await sleep('10 seconds');
      continue;
    }

    const targetOn=Math.max(
      1,
      Math.min(
        Number(config.on_seconds||30),
        Number(env.schedule.seconds_until_end||config.on_seconds||30)
      )
    );

    let elapsed=0;
    let interrupted=false;

    while(elapsed<targetOn){
      const chunk=Math.min(5,targetOn-elapsed);
      await sleep(`${chunk} seconds`);
      elapsed+=chunk;

      const guard=await environmentStep(config);

      if(guard.raining){
        rainHoldUntil=Math.max(
          rainHoldUntil,
          guard.now+Math.max(0,Number(config.resume_delay_minutes||0))*60000
        );
        interrupted=true;
        break;
      }

      if(!guard.schedule.inside){
        interrupted=true;
        break;
      }
    }

    let stopped=await relayStep(false);
    while(!stopped.ok){
      await sleep('5 seconds');
      stopped=await relayStep(false);
    }

    if(interrupted)continue;

    let offElapsed=0;
    const targetOff=Math.max(1,Number(config.off_seconds||90));

    while(offElapsed<targetOff){
      const chunk=Math.min(15,targetOff-offElapsed);
      await sleep(`${chunk} seconds`);
      offElapsed+=chunk;

      const guard=await environmentStep(config);

      if(guard.raining){
        rainHoldUntil=Math.max(
          rainHoldUntil,
          guard.now+Math.max(0,Number(config.resume_delay_minutes||0))*60000
        );
        break;
      }

      if(!guard.schedule.inside)break;
    }
  }
}
