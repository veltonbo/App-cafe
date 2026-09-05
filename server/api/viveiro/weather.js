import { applyCors, authorize, ensureConfig } from '../_tuya.js';
import { verifyGitHubOidc } from './_github_oidc.js';
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
  if(!(await authorized(req,res))||!ensureConfig(res))return;

  try{
    if(req.method==='POST'&&req.body?.action==='save_config'){
      const config=await saveViveiroWeatherConfig(req.body?.config||{});
      const result=req.body?.run_now===false
        ? {ok:true,config,state:await getViveiroWeatherState()}
        : await runViveiroWeatherCheck();
      return res.status(200).json(result);
    }

    if(req.method==='POST'&&req.body?.action==='status_only'){
      return res.status(200).json({
        ok:true,
        config:await getViveiroWeatherConfig(),
        state:await getViveiroWeatherState()
      });
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
