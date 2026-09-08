import { applyCors, authorize } from './_tuya.js';
import { decodeCycle, encodeCycle } from './_cycle.js';
import { readViveiroState, sendViveiroCommands } from './_viveiro_transport.js';

async function getCycleRaw(){
  const state=await readViveiroState();
  const value=state?.statusMap?.cycle_time;
  return typeof value==='string'?value:'';
}

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(!authorize(req,res))return;

  if(req.method==='GET'){
    try{
      const currentRaw=await getCycleRaw();
      return res.status(200).json({
        ok:true,
        cycle_time:currentRaw||null,
        cycle_config:decodeCycle(currentRaw)
      });
    }catch(error){
      return res.status(502).json({
        ok:false,
        error:error?.message||'Falha ao consultar ciclo do Viveiro.'
      });
    }
  }

  if(req.method!=='POST'){
    return res.status(405).json({ok:false,error:'Método não permitido.'});
  }

  try{
    const currentRaw=await getCycleRaw();
    if(currentRaw&&!decodeCycle(currentRaw)){
      throw new Error('Formato atual do cycle_time não reconhecido. Nenhuma alteração foi enviada.');
    }

    const encoded=encodeCycle({
      enabled:req.body?.enabled,
      daysMask:req.body?.daysMask,
      startMinutes:req.body?.startMinutes,
      endMinutes:req.body?.endMinutes,
      onMinutes:req.body?.onMinutes,
      offMinutes:req.body?.offMinutes
    },currentRaw);

    const result=await sendViveiroCommands([
      {code:'cycle_time',value:encoded.raw}
    ]);

    return res.status(200).json({
      ok:true,
      provider:result.provider,
      cycle_time:encoded.raw,
      cycle_config:encoded
    });
  }catch(error){
    return res.status(400).json({
      ok:false,
      error:error?.message||'Falha ao salvar ciclo de irrigação.'
    });
  }
}
