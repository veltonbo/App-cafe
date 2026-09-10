import { applyCors, authorize } from '../_tuya.js';
import { localHistoryStatus, readLocalHistory } from '../../local/history-store.js';

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(!authorize(req,res))return;
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'Método não permitido.'});

  const status=await localHistoryStatus();
  const limit=Math.max(1,Math.min(200,Number(req.query?.limit)||20));
  const history=await readLocalHistory({limit});
  return res.status(200).json({...status,history});
}
