import { send } from '@vercel/queue';
import { applyCors, authorize, ensureConfig } from '../_tuya.js';
import {
  configureSecondsMode,
  disableSecondsMode,
  getSecondsState,
  patchSecondsState
} from './_seconds.js';
import { runViveiroWeatherCheck } from './_weather_logic.js';

const TOPIC='viveiro-pulse';

async function enqueue(message,delaySeconds=0){
  const key=['viveiro',message.generation,message.action,message.seq,message.attempt||0].join(':');
  return send(TOPIC,message,{
    delaySeconds:Math.max(0,Math.round(Number(delaySeconds)||0)),
    retentionSeconds:86400,
    idempotencyKey:key
  });
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
      const weather=await runViveiroWeatherCheck();
      const blocked=['paused_rain','waiting_resume_delay','paused_waiting_weather'].includes(String(weather?.state?.status||''))||Boolean(weather?.state?.rainActive);
      if(blocked){
        return res.status(423).json({
          ok:false,
          blocked:true,
          error:'O modo em segundos não pode ser iniciado enquanto a proteção por chuva estiver bloqueando o viveiro.',
          weather:weather.state
        });
      }

      const state=await configureSecondsMode({
        onSeconds:req.body?.on_seconds,
        offSeconds:req.body?.off_seconds
      });

      try{
        const msg={generation:state.generation,action:'on',seq:0,attempt:0};
        const queued=await enqueue(msg,0);
        const saved=await patchSecondsState({
          engine:'vercel_queue',
          phase:'queued',
          expected_action:'on',
          transition_seq:0,
          queue_message_id:queued?.messageId||null
        });
        return res.status(200).json({
          ok:true,
          state:saved,
          queue_started:true,
          queue_message_id:queued?.messageId||null
        });
      }catch(error){
        await disableSecondsMode({restoreNative:true}).catch(()=>null);
        throw new Error('Não foi possível iniciar a fila de pulsos no servidor. '+(error?.message||String(error)));
      }
    }

    if(action==='disable'){
      const state=await disableSecondsMode({restoreNative:req.body?.restore_native!==false});
      return res.status(200).json({ok:true,state});
    }

    return res.status(400).json({ok:false,error:'Ação inválida.'});
  }catch(error){
    const message=error?.message||'Falha no modo rápido em segundos.';
    return res.status(502).json({ok:false,error:message,detail:message});
  }
}
