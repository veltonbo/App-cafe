import { applyCors, authorize } from '../api/_tuya.js';
import { requirePermission } from '../api/_rbac.js';
import {
  configureSeconds,
  disableSeconds,
  emergencyStopAll,
  clearEmergencyStop,
  getSecondsManagerState,
  peekSecondsManagerState
} from './seconds-manager.js';

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(!['GET','POST'].includes(req.method))return res.status(405).json({ok:false,error:'Método não permitido.'});
  if(!authorize(req,res))return;

  try{
    if(req.method==='GET'){
      if(String(req.query?.fast||'')==='1')return res.status(200).json({ok:true,state:peekSecondsManagerState()});
      return res.status(200).json({ok:true,state:await getSecondsManagerState()});
    }

    const action=String(req.body?.action||'configure');
    if(action==='status')return res.status(200).json({ok:true,state:await getSecondsManagerState()});
    const required=(action==='emergency_stop'||action==='clear_emergency')?'emergency':(action==='configure'?'configure':'command');
    if(!requirePermission(req,res,required))return;

    if(action==='configure'){
      const state=await configureSeconds(req.body||{});
      return res.status(200).json({ok:true,state});
    }

    if(action==='disable'){
      const state=await disableSeconds();
      return res.status(200).json({ok:true,state});
    }

    if(action==='emergency_stop'){
      const result=await emergencyStopAll(req.body?.reason||'Parada de emergência pelo aplicativo');
      return res.status(200).json({ok:true,...result});
    }

    if(action==='clear_emergency'){
      const result=await clearEmergencyStop();
      return res.status(200).json({ok:true,...result});
    }


    return res.status(400).json({ok:false,error:'Ação inválida.'});
  }catch(error){
    return res.status(502).json({ok:false,error:error?.message||'Falha no modo rápido em segundos.'});
  }
}
