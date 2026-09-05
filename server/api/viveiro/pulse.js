import { waitUntil } from '@vercel/functions';
import { applyCors, authorize, ensureConfig } from '../_tuya.js';
import { appendHistory } from '../irrigation/_store.js';
import { fetchWeatherSnapshot } from '../weather/_weather.js';
import { verifyGitHubOidc } from './_github_oidc.js';
import {
  getSecondsState,
  localSchedule,
  patchSecondsState,
  releaseWorker,
  setViveiroRelay,
  tryClaimWorker
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

async function kickNext(url,generation){
  const token=(process.env.APP_CONTROL_TOKEN||'').trim();
  if(!token)return false;
  try{
    const r=await fetch(url+'/api/viveiro/pulse',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body:JSON.stringify({generation})
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

async function failOff(generation,token,detail){
  await patchSecondsState({
    enabled:false,
    relay_expected:false,
    phase:'error',
    last_error:detail,
    fault_at:Date.now()
  }).catch(()=>null);
  await releaseWorker(generation,token,{phase:'error',last_error:detail}).catch(()=>null);
  await appendHistory({
    type:'viveiro_pulse_error',
    source:'vercel_function',
    status:'critical',
    detail
  }).catch(()=>null);
}

async function runPulse(generation,token,url){
  let state=await getSecondsState();
  if(!state.enabled||state.generation!==generation){
    await releaseWorker(generation,token,{phase:'stopped'}).catch(()=>null);
    return;
  }

  const schedule=localSchedule(state);
  if(!schedule.inside){
    await safeOff();
    await releaseWorker(generation,token,{phase:'waiting_window',relay_expected:false});
    return;
  }

  let weather=await weatherState();
  if(!weather.usable){
    await safeOff();
    await releaseWorker(generation,token,{
      phase:'weather_unavailable',
      relay_expected:false,
      last_error:'Weather2-2 sem dados. O modo rápido permanece desligado por segurança.'
    });
    return;
  }

  if(weather.raining){
    await safeOff();
    await releaseWorker(generation,token,{
      phase:'weather_blocked',
      relay_expected:false,
      rain_last_at:Date.now(),
      last_error:null
    });
    return;
  }

  const holdMs=Math.max(0,Number(state.resume_delay_minutes||0))*60000;
  const rainLast=Number(state.rain_last_at||0);
  if(rainLast&&Date.now()<rainLast+holdMs){
    await safeOff();
    await releaseWorker(generation,token,{
      phase:'waiting_after_rain',
      relay_expected:false,
      resume_eligible_at:rainLast+holdMs
    });
    return;
  }

  const maxOn=Math.max(1,Math.min(Number(state.on_seconds||30),schedule.seconds_until_end||Number(state.on_seconds||30)));

  try{
    await setViveiroRelay(true,{attempts:4});
  }catch(error){
    await releaseWorker(generation,token,{
      phase:'retry_wait',
      relay_expected:false,
      last_error:error?.message||String(error)
    });
    await sleep(10000);
    await kickNext(url,generation);
    return;
  }

  await patchSecondsState({
    phase:'on',
    relay_expected:true,
    pulse_started_at:Date.now(),
    expected_off_at:Date.now()+maxOn*1000,
    last_error:null
  });

  let elapsed=0;
  let interrupted=false;
  while(elapsed<maxOn){
    const chunk=Math.min(5,maxOn-elapsed);
    await sleep(chunk*1000);
    elapsed+=chunk;

    state=await getSecondsState();
    if(!state.enabled||state.generation!==generation){
      // A ação de parar/reconfigurar já colocou a saída em estado seguro.
      // O worker antigo não deve enviar mais comandos ao EKAZA.
      return;
    }

    if(!localSchedule(state).inside){
      interrupted=true;
      break;
    }

    weather=await weatherState();
    if(!weather.usable){
      await patchSecondsState({
        phase:'weather_unavailable',
        last_error:'Weather2-2 sem dados durante o pulso. Desligando por segurança.'
      });
      interrupted=true;
      break;
    }
    if(weather.raining){
      await patchSecondsState({
        rain_last_at:Date.now(),
        phase:'weather_blocked',
        last_error:null
      });
      interrupted=true;
      break;
    }
  }

  const off=await safeOff();
  if(!off.ok){
    await failOff(generation,token,'Não foi possível confirmar o desligamento do viveiro. '+off.error);
    return;
  }

  state=await getSecondsState();
  if(!state.enabled||state.generation!==generation){
    await releaseWorker(generation,token,{phase:'stopped',relay_expected:false});
    return;
  }

  const pulseCount=Number(state.pulse_count||0)+1;
  await patchSecondsState({
    phase:'off',
    relay_expected:false,
    pulse_count:pulseCount,
    last_pulse_at:Date.now(),
    expected_next_on_at:Date.now()+Number(state.off_seconds||90)*1000
  });

  if(interrupted){
    await releaseWorker(generation,token,{relay_expected:false});
    return;
  }

  let offElapsed=0;
  const targetOff=Math.max(1,Number(state.off_seconds||90));
  while(offElapsed<targetOff){
    const chunk=Math.min(15,targetOff-offElapsed);
    await sleep(chunk*1000);
    offElapsed+=chunk;

    state=await getSecondsState();
    if(!state.enabled||state.generation!==generation){
      await releaseWorker(generation,token,{phase:'stopped',relay_expected:false});
      return;
    }

    if(!localSchedule(state).inside){
      await releaseWorker(generation,token,{phase:'waiting_window',relay_expected:false});
      return;
    }

    weather=await weatherState();
    if(!weather.usable){
      await releaseWorker(generation,token,{
        phase:'weather_unavailable',
        relay_expected:false,
        last_error:'Weather2-2 sem dados. Próximo pulso bloqueado.'
      });
      return;
    }
    if(weather.raining){
      await releaseWorker(generation,token,{
        phase:'weather_blocked',
        relay_expected:false,
        rain_last_at:Date.now(),
        last_error:null
      });
      return;
    }
  }

  await releaseWorker(generation,token,{phase:'queued',relay_expected:false,last_error:null});
  await kickNext(url,generation);
}

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Método não permitido.'});
  if(!(await authorized(req,res))||!ensureConfig(res))return;

  const requested=String(req.body?.generation||'').trim();
  const state=await getSecondsState();
  const generation=requested||String(state.generation||'');

  if(!state.enabled||!generation||state.generation!==generation){
    return res.status(200).json({ok:true,queued:false,reason:'inactive'});
  }

  const leaseMs=Math.min(280000,(Math.max(1,Number(state.on_seconds||30))+Math.max(1,Number(state.off_seconds||90))+45)*1000);
  const claim=await tryClaimWorker(generation,leaseMs);
  if(!claim.claimed){
    return res.status(200).json({ok:true,queued:false,reason:claim.reason||'busy'});
  }

  waitUntil(runPulse(generation,claim.token,baseUrl(req)));
  return res.status(202).json({ok:true,queued:true,generation});
}
