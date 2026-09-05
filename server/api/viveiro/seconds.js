import { applyCors, authorize, ensureConfig } from '../_tuya.js';
import { fetchWeatherSnapshot } from '../weather/_weather.js';
import { getSecondsState, prepareServerPulse, stopServerPulse } from './_seconds.js';

function baseUrl(req){
  const proto=String(req.headers['x-forwarded-proto']||'https').split(',')[0].trim();
  const host=String(req.headers['x-forwarded-host']||req.headers.host||'app-cafe.vercel.app').split(',')[0].trim();
  return proto+'://'+host;
}

async function queuePulse(req,generation){
  const token=(process.env.APP_CONTROL_TOKEN||'').trim();
  if(!token)throw new Error('APP_CONTROL_TOKEN não configurado no servidor.');
  const r=await fetch(baseUrl(req)+'/api/viveiro/pulse',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
    body:JSON.stringify({generation})
  });
  const body=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(body?.error||('Falha ao iniciar worker: HTTP '+r.status));
  return body;
}

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(!['GET','POST'].includes(req.method))return res.status(405).json({ok:false,error:'Método não permitido.'});
  if(!authorize(req,res)||!ensureConfig(res))return;

  try{
    if(req.method==='GET'){
      return res.status(200).json({ok:true,state:await getSecondsState()});
    }

    const action=String(req.body?.action||'configure');

    if(action==='configure'){
      const weather=await fetchWeatherSnapshot().catch(()=>null);
      if(!weather?.linked||!weather?.metrics){
        return res.status(423).json({
          ok:false,
          blocked:true,
          error:'Weather2-2 sem dados. O modo rápido não será iniciado por segurança.'
        });
      }
      if(weather.metrics.rainDetected){
        return res.status(423).json({
          ok:false,
          blocked:true,
          error:'A Weather2-2 está detectando chuva. O modo rápido não será iniciado agora.'
        });
      }

      const state=await prepareServerPulse({
        onSeconds:req.body?.on_seconds,
        offSeconds:req.body?.off_seconds
      });

      try{
        const queued=await queuePulse(req,state.generation);
        const current=await getSecondsState();
        return res.status(200).json({
          ok:true,
          worker_queued:Boolean(queued?.queued),
          state:current
        });
      }catch(error){
        await stopServerPulse({restoreNative:true}).catch(()=>null);
        throw new Error('Não foi possível iniciar o controlador de pulsos no servidor. '+(error?.message||String(error)));
      }
    }

    if(action==='disable'){
      const state=await stopServerPulse({restoreNative:req.body?.restore_native!==false});
      return res.status(200).json({ok:true,state});
    }

    return res.status(400).json({ok:false,error:'Ação inválida.'});
  }catch(error){
    const message=error?.message||'Falha no modo rápido em segundos.';
    return res.status(502).json({ok:false,error:message,detail:message});
  }
}
