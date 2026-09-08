import { applyCors, authorize } from '../_tuya.js';
import { createConfigBackup, listConfigBackups, restoreConfigBackup } from './_backup.js';

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(!authorize(req,res))return;

  try{
    if(req.method==='GET'){
      return res.status(200).json({ok:true,backups:await listConfigBackups(12)});
    }

    if(req.method!=='POST')return res.status(405).json({ok:false,error:'Método não permitido.'});
    const action=String(req.body?.action||'create');

    if(action==='create'){
      const backup=await createConfigBackup(String(req.body?.reason||'manual'));
      return res.status(200).json({ok:true,backup});
    }

    if(action==='restore'){
      if(req.body?.confirm!==true)return res.status(400).json({ok:false,error:'Confirme a restauração antes de aplicar.'});
      const result=await restoreConfigBackup(req.body?.id||'');
      return res.status(200).json(result);
    }

    return res.status(400).json({ok:false,error:'Ação inválida.'});
  }catch(error){
    return res.status(502).json({ok:false,error:error?.message||'Falha nos backups de configuração.'});
  }
}
