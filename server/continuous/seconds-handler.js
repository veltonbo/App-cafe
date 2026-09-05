import { applyCors, authorize, ensureConfig } from '../api/_tuya.js';
import {
  configureSeconds,
  disableSeconds,
  getSecondsManagerState
} from './seconds-manager.js';

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(!['GET','POST'].includes(req.method))return res.status(405).json({ok:false,error:'Método não permitido.'});
  if(!authorize(req,res)||!ensureConfig(res))return;

  try{
    if(req.method==='GET'){
      return res.status(200).json({ok:true,state:await getSecondsManagerState()});
    }

    const action=String(req.body?.action||'configure');

    if(action==='configure'){
      const state=await configureSeconds(req.body||{});
      return res.status(200).json({ok:true,state});
    }

    if(action==='disable'){
      const state=await disableSeconds();
      return res.status(200).json({ok:true,state});
    }

    if(action==='status'){
      return res.status(200).json({ok:true,state:await getSecondsManagerState()});
    }

    return res.status(400).json({ok:false,error:'Ação inválida.'});
  }catch(error){
    return res.status(502).json({ok:false,error:error?.message||'Falha no modo rápido em segundos.'});
  }
}
