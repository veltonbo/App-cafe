import { applyCors, authorize } from '../_tuya.js';
import { verifyGitHubOidc } from './_github_oidc.js';
import { createConfigBackup } from '../irrigation/_backup.js';
import { fetchWeatherSnapshot } from '../weather/_weather.js';
import {
  getViveiroWeatherConfig,
  getViveiroWeatherState,
  runViveiroWeatherCheck,
  saveViveiroWeatherConfig
} from './_weather_logic.js';

async function authorized(req,res){
  if(await verifyGitHubOidc(req))return true;
  return authorize(req,res);
}

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(!['GET','POST'].includes(req.method))return res.status(405).json({ok:false,error:'Método não permitido.'});
  if(!(await authorized(req,res)))return;

  try{
    if(req.method==='POST'&&req.body?.action==='save_config'){
      await createConfigBackup('antes_de_alterar_protecao_de_chuva').catch(()=>null);
      const config=await saveViveiroWeatherConfig(req.body?.config||{});
      const result=req.body?.run_now===false
        ? {ok:true,config,state:await getViveiroWeatherState()}
        : await runViveiroWeatherCheck();
      return res.status(200).json(result);
    }

    if(req.method==='POST'&&req.body?.action==='status_only'){
      const [config,state]=await Promise.all([
        getViveiroWeatherConfig(),
        getViveiroWeatherState()
      ]);
      const weatherError=String(state?.lastWeatherError||'');
      const temperature=Number(state?.lastTemperature);
      const humidity=Number(state?.lastHumidity);
      const rain=Number(state?.rainAmountMm);
      const weather={
        ok:!weatherError,
        linked:!weatherError&&state?.weatherOnline!==false,
        cached:true,
        provider:state?.weatherProvider||'smartlife',
        checked_at:Number(state?.lastWeatherAt||state?.lastCheckedAt||0)||null,
        error:weatherError||null,
        device:{
          name:'Weather2-2',
          online:state?.weatherOnline!==false
        },
        metrics:{
          rainDetected:Boolean(state?.rainDetected),
          rainGeneric:Number.isFinite(rain)?{value:rain,unit:'mm'}:null,
          temperature:Number.isFinite(temperature)?{value:temperature,unit:'°C'}:null,
          humidity:Number.isFinite(humidity)?{value:humidity,unit:'%'}:null
        }
      };
      return res.status(200).json({ok:true,config,state,weather});
    }

    const result=await runViveiroWeatherCheck();
    return res.status(200).json(result);
  }catch(error){
    return res.status(502).json({
      ok:false,
      error:error?.message||'Falha na proteção automática por chuva do viveiro.'
    });
  }
}
