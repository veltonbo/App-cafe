import { applyCors, authorize } from './_tuya.js';
import { sendViveiroCommands } from './_viveiro_transport.js';
import { fetchWeatherSnapshot } from './weather/_weather.js';
import { getViveiroWeatherConfig, getViveiroWeatherState } from './viveiro/_weather_logic.js';
import { emergencyLatched, maintenanceActive } from './viveiro/_interlock.js';
import { storeGet } from './irrigation/_store.js';

async function activationBlock(){
  if(await emergencyLatched().catch(()=>false)){
    return 'A parada de emergência está ativa.';
  }
  if(await maintenanceActive().catch(()=>false)){
    return 'O modo manutenção está ativo.';
  }

  const seconds=await storeGet('IrrigacaoFazenda2E/viveiroSecondsState').catch(()=>null);
  if(seconds?.enabled){
    return 'O ciclo rápido está ativo. Use o controle da automação em segundos.';
  }

  const cfg=await getViveiroWeatherConfig().catch(()=>({enabled:true}));
  if(cfg.enabled!==false){
    const state=await getViveiroWeatherState().catch(()=>({}));
    if(['paused_rain','waiting_resume_delay','paused_waiting_weather'].includes(String(state?.status||''))){
      return 'A proteção por chuva está bloqueando a irrigação.';
    }

    const weather=await fetchWeatherSnapshot({maxAgeMs:5000}).catch(()=>null);
    if(!weather?.linked||weather?.device?.online===false||!weather?.metrics){
      return 'Weather2-2 sem leitura confiável. Ligação manual bloqueada por segurança.';
    }
    if(weather.metrics.rainDetected){
      return 'A Weather2-2 está detectando chuva.';
    }
  }

  return null;
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Método não permitido.' });
  if (!authorize(req, res)) return;

  const on=req.body?.on;
  if(typeof on!=='boolean'){
    return res.status(400).json({ok:false,error:'Informe on=true ou on=false.'});
  }

  try{
    if(on){
      const blocked=await activationBlock();
      if(blocked){
        return res.status(423).json({ok:false,blocked:true,error:blocked});
      }
    }

    const result=await sendViveiroCommands([
      {code:'switch_1',value:on}
    ]);
    const confirmed=typeof result?.statusMap?.switch_1==='boolean'
      ?result.statusMap.switch_1
      :on;
    return res.status(200).json({
      ok:true,
      relay:confirmed,
      provider:result.provider
    });
  }catch(error){
    return res.status(502).json({
      ok:false,
      error:error?.message||'Falha ao enviar comando ao Viveiro.'
    });
  }
}
