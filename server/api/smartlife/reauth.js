import { applyCors, authorize } from '../_tuya.js';
import { smartLifeReauthFinish, smartLifeReauthStart } from '../_smartlife.js';

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Método não permitido.'});
  if(!authorize(req,res))return;

  try{
    const action=String(req.body?.action||'start');
    if(action==='start'){
      const result=await smartLifeReauthStart();
      return res.status(200).json(result);
    }
    if(action==='finish'){
      const result=await smartLifeReauthFinish(req.body?.token);
      return res.status(200).json(result);
    }
    return res.status(400).json({ok:false,error:'Ação inválida.'});
  }catch(error){
    return res.status(502).json({
      ok:false,
      error:error?.message||'Falha ao reconectar Smart Life.'
    });
  }
}
