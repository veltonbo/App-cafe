import { waitUntil } from '@vercel/functions';
import { applyCors, authorize, ensureConfig } from '../_tuya.js';
import { fetchWeatherSnapshot } from '../weather/_weather.js';
import { verifyGitHubOidc } from './_github_oidc.js';
import {
  localSchedule,
  pulseStillActive,
  readViveiroDevice,
  setViveiroRelay,
  writeViveiroCycle
} from './_seconds.js';

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}

async function authorized(req,res){
  if(await verifyGitHubOidc(req))return true;
  return authorize(req,res);
}

function baseUrl(req){
  const proto=String(req.headers['x-forwarded-proto']||'https').split(',')[0].trim();
  const host=String(req.headers['x-forwarded-host']||req.headers.host||'app-cafe.vercel.app').split(',')[0].trim();
  return proto+'://'+host;
}

async function kickNext(url,state){
  const token=(process.env.APP_CONTROL_TOKEN||'').trim();
  if(!token)return false;
  try{
    const r=await fetch(url+'/api/viveiro/pulse',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body:JSON.stringify({state})
    });
    return r.ok;
  }catch{
    return false;
  }
}

async function weatherState(){
  try{
    const w=await fetchWeatherSnapshot();
    if(!w?.linked||!w?.metrics)return{usable:false,raining:false};
    return{usable:true,raining:Boolean(w.metrics.rainDetected),snapshot:w};
  }catch(error){
    return{usable:false,raining:false,error:error?.message||String(error)};
  }
}

async function safeOff(){
  try{
    await setViveiroRelay(false,{attempts:10});
    return{ok:true};
  }catch(error){
    return{ok:false,error:error?.message||String(error)};
  }
}

async function restoreNativeIfOwned(state){
  const current=await readViveiroDevice().catch(()=>null);
  const owns=Boolean(
    current&&state?.disabled_cycle_raw&&
    String(current.cycleRaw||'')===String(state.disabled_cycle_raw||'')
  );
  if(!owns)return false;
  await safeOff();
  if(state?.native_cycle_raw){
    await writeViveiroCycle(state.native_cycle_raw).catch(()=>null);
  }
  return true;
}

async function waitAndContinue(url,state,seconds){
  const max=Math.max(1,Math.min(240,Math.round(Number(seconds)||30)));
  await sleep(max*1000);
  if(!(await pulseStillActive(state)))return false;
  return kickNext(url,state);
}

async function runPulse(input,url){
  let state={...input};
  if(!state.enabled||!state.generation||!state.disabled_cycle_raw)return;

  if(!(await pulseStillActive(state)))return;

  let schedule=localSchedule(state);

  if(!schedule.inside){
    await safeOff();

    if(schedule.before_start){
      await waitAndContinue(url,{...state,phase:'waiting_window'},Math.min(120,schedule.seconds_until_start||60));
      return;
    }

    // Ao encerrar a janela atual, restaura o ciclo nativo para a próxima programação.
    await restoreNativeIfOwned(state);
    return;
  }

  let weather=await weatherState();

  if(!weather.usable){
    await safeOff();
    await waitAndContinue(
      url,
      {...state,phase:'weather_unavailable',relay_expected:false},
      60
    );
    return;
  }

  if(weather.raining){
    await safeOff();
    state={
      ...state,
      phase:'weather_blocked',
      relay_expected:false,
      paused_by_weather:true,
      rain_last_at:Date.now()
    };
    schedule=localSchedule(state);
    if(schedule.inside){
      await waitAndContinue(url,state,60);
    }else{
      await restoreNativeIfOwned(state);
    }
    return;
  }

  const holdMs=Math.max(0,Number(state.resume_delay_minutes||0))*60000;
  const rainLast=Number(state.rain_last_at||0);

  if(rainLast&&Date.now()<rainLast+holdMs){
    await safeOff();
    const remaining=Math.ceil((rainLast+holdMs-Date.now())/1000);
    await waitAndContinue(
      url,
      {...state,phase:'waiting_after_rain',relay_expected:false,paused_by_weather:true},
      Math.min(60,Math.max(1,remaining))
    );
    return;
  }

  state={...state,paused_by_weather:false,phase:'starting'};
  schedule=localSchedule(state);
  const maxOn=Math.max(
    1,
    Math.min(
      Number(state.on_seconds||30),
      schedule.seconds_until_end||Number(state.on_seconds||30)
    )
  );

  try{
    await setViveiroRelay(true,{attempts:4});
  }catch(error){
    await safeOff();
    await waitAndContinue(
      url,
      {...state,phase:'retry_wait',relay_expected:false,last_error:error?.message||String(error)},
      15
    );
    return;
  }

  state={
    ...state,
    phase:'on',
    relay_expected:true,
    pulse_started_at:Date.now(),
    expected_off_at:Date.now()+maxOn*1000,
    last_error:null
  };

  let elapsed=0;
  let interrupted=false;

  while(elapsed<maxOn){
    const chunk=Math.min(5,maxOn-elapsed);
    await sleep(chunk*1000);
    elapsed+=chunk;

    if(!(await pulseStillActive(state))){
      // A ação de parar já desligou a saída e restaurou a programação.
      return;
    }

    if(!localSchedule(state).inside){
      interrupted=true;
      break;
    }

    weather=await weatherState();

    if(!weather.usable){
      state={
        ...state,
        phase:'weather_unavailable',
        last_error:'Weather2-2 sem dados durante o pulso.'
      };
      interrupted=true;
      break;
    }

    if(weather.raining){
      state={
        ...state,
        rain_last_at:Date.now(),
        phase:'weather_blocked',
        paused_by_weather:true,
        last_error:null
      };
      interrupted=true;
      break;
    }
  }

  const off=await safeOff();

  if(!off.ok){
    // Falha crítica: restaura o ciclo nativo para evitar novo pulso.
    await restoreNativeIfOwned(state);
    return;
  }

  if(!(await pulseStillActive(state)))return;

  schedule=localSchedule(state);
  if(!schedule.inside){
    await restoreNativeIfOwned(state);
    return;
  }

  if(interrupted){
    await waitAndContinue(url,{...state,relay_expected:false},30);
    return;
  }

  state={
    ...state,
    phase:'off',
    relay_expected:false,
    pulse_count:Number(state.pulse_count||0)+1,
    last_pulse_at:Date.now(),
    expected_next_on_at:Date.now()+Number(state.off_seconds||90)*1000
  };

  let offElapsed=0;
  const targetOff=Math.max(1,Number(state.off_seconds||90));

  while(offElapsed<targetOff){
    const chunk=Math.min(15,targetOff-offElapsed);
    await sleep(chunk*1000);
    offElapsed+=chunk;

    if(!(await pulseStillActive(state)))return;

    schedule=localSchedule(state);
    if(!schedule.inside){
      await restoreNativeIfOwned(state);
      return;
    }

    weather=await weatherState();

    if(!weather.usable){
      await waitAndContinue(
        url,
        {...state,phase:'weather_unavailable',relay_expected:false},
        45
      );
      return;
    }

    if(weather.raining){
      await waitAndContinue(
        url,
        {
          ...state,
          phase:'weather_blocked',
          relay_expected:false,
          paused_by_weather:true,
          rain_last_at:Date.now()
        },
        60
      );
      return;
    }
  }

  if(!(await pulseStillActive(state)))return;

  await kickNext(url,{...state,phase:'queued',relay_expected:false,last_error:null});
}

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Método não permitido.'});
  if(!(await authorized(req,res))||!ensureConfig(res))return;

  const state=req.body?.state&&typeof req.body.state==='object'?req.body.state:null;

  if(!state?.enabled||!state?.generation||!state?.disabled_cycle_raw){
    return res.status(200).json({ok:true,queued:false,reason:'inactive'});
  }

  waitUntil(runPulse(state,baseUrl(req)));
  return res.status(202).json({ok:true,queued:true,generation:state.generation});
}
