import { applyCors, authorize } from './_tuya.js';
import { decodeCycle, encodeCycle } from './_cycle.js';
import { readViveiroState, sendViveiroCommands } from './_viveiro_transport.js';
import { fetchWeatherSnapshot } from './weather/_weather.js';
import { getViveiroWeatherConfig, getViveiroWeatherState } from './viveiro/_weather_logic.js';
import { emergencyLatched, maintenanceActive } from './viveiro/_interlock.js';
import { storeGet } from './irrigation/_store.js';

async function getCycleRaw(){
  const state=await readViveiroState({maxAgeMs:2000});
  const value=state?.statusMap?.cycle_time;
  return typeof value==='string'?value:'';
}

async function activationBlock(){
  if(await emergencyLatched().catch(()=>false)){
    return 'A parada de emergência está ativa.';
  }
  if(await maintenanceActive().catch(()=>false)){
    return 'O modo manutenção está ativo.';
  }

  const seconds=await storeGet('IrrigacaoFazenda2E/viveiroSecondsState').catch(()=>null);
  if(seconds?.enabled){
    return 'O ciclo rápido está ativo. Pare o ciclo em segundos antes de ativar a programação nativa.';
  }

  const cfg=await getViveiroWeatherConfig().catch(()=>({enabled:true}));
  if(cfg.enabled!==false){
    const weatherState=await getViveiroWeatherState().catch(()=>({}));
    if(['paused_rain','waiting_resume_delay','paused_waiting_weather'].includes(String(weatherState?.status||''))){
      return 'A proteção por chuva está bloqueando a irrigação.';
    }

    const weather=await fetchWeatherSnapshot({maxAgeMs:5000}).catch(()=>null);
    if(!weather?.linked||weather?.device?.online===false||!weather?.metrics){
      return 'Weather2-2 sem leitura confiável. Ativação bloqueada por segurança.';
    }
    if(weather.metrics.rainDetected){
      return 'A Weather2-2 está detectando chuva.';
    }
  }

  return null;
}

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(!authorize(req,res))return;

  if(req.method==='GET'){
    try{
      const currentRaw=await getCycleRaw();
      return res.status(200).json({
        ok:true,
        cycle_time:currentRaw||null,
        cycle_config:decodeCycle(currentRaw)
      });
    }catch(error){
      return res.status(502).json({
        ok:false,
        error:error?.message||'Falha ao consultar ciclo do Viveiro.'
      });
    }
  }

  if(req.method!=='POST'){
    return res.status(405).json({ok:false,error:'Método não permitido.'});
  }

  try{
    const wantsEnabled=req.body?.enabled!==false;
    if(wantsEnabled){
      const blocked=await activationBlock();
      if(blocked){
        return res.status(423).json({ok:false,blocked:true,error:blocked});
      }
    }

    const currentRaw=await getCycleRaw();
    if(currentRaw&&!decodeCycle(currentRaw)){
      throw new Error('Formato atual do cycle_time não reconhecido. Nenhuma alteração foi enviada.');
    }

    const encoded=encodeCycle({
      enabled:req.body?.enabled,
      daysMask:req.body?.daysMask,
      startMinutes:req.body?.startMinutes,
      endMinutes:req.body?.endMinutes,
      onMinutes:req.body?.onMinutes,
      offMinutes:req.body?.offMinutes
    },currentRaw);

    const result=await sendViveiroCommands([
      {code:'cycle_time',value:encoded.raw}
    ]);

    return res.status(200).json({
      ok:true,
      provider:result.provider,
      cycle_time:encoded.raw,
      cycle_config:encoded
    });
  }catch(error){
    return res.status(400).json({
      ok:false,
      error:error?.message||'Falha ao salvar ciclo de irrigação.'
    });
  }
}
