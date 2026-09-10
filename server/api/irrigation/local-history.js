import { applyCors, authorize } from '../_tuya.js';
import { localHistoryStatus, readLocalHistory } from '../../local/history-store.js';
import { createLocalBackup, localMaintenanceStatus } from '../../local/maintenance.js';

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(!authorize(req,res))return;

  if(req.method==='POST'){
    const action=String(req.body?.action||'').trim();
    if(action!=='backup')return res.status(400).json({ok:false,error:'Ação inválida.'});
    const result=await createLocalBackup('manual');
    return res.status(result?.ok===false?500:200).json(result);
  }

  if(req.method!=='GET')return res.status(405).json({ok:false,error:'Método não permitido.'});

  const [status,maintenance]=await Promise.all([
    localHistoryStatus(),
    localMaintenanceStatus()
  ]);
  const limit=Math.max(1,Math.min(200,Number(req.query?.limit)||20));
  const history=await readLocalHistory({limit});
  return res.status(200).json({...status,maintenance,history});
}
