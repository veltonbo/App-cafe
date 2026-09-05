import { applyCors, authorize, ensureConfig } from '../_tuya.js';
import { configureSecondsMode, disableSecondsMode, getSecondsState } from './_seconds.js';
import { runViveiroWeatherCheck } from './_weather_logic.js';

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
        return res.status(423).json({ok:false,blocked:true,error:'O modo em segundos não pode ser ativado enquanto a proteção por chuva estiver bloqueando o viveiro.',weather:weather.state});
      }
      const state=await configureSecondsMode({
        onSeconds:req.body?.on_seconds,
        offSeconds:req.body?.off_seconds
      });
      return res.status(200).json({ok:true,state});
    }
    if(action==='disable'){
      const state=await disableSecondsMode({restoreNative:req.body?.restore_native!==false});
      return res.status(200).json({ok:true,state});
    }
    return res.status(400).json({ok:false,error:'Ação inválida.'});
  }catch(error){
    const message=error?.message||'Falha no modo rápido em segundos.';
    return res.status(502).json({
      ok:false,
      error:message,
      detail:message
    });
  }
}
