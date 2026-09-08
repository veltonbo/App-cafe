import { applyCors, authorize } from './_tuya.js';
import { sendViveiroCommands } from './_viveiro_transport.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Método não permitido.' });
  if (!authorize(req, res)) return;

  const on=req.body?.on;
  if(typeof on!=='boolean'){
    return res.status(400).json({ok:false,error:'Informe on=true ou on=false.'});
  }

  try{
    const result=await sendViveiroCommands([
      {code:'switch_1',value:on}
    ]);
    const confirmed=typeof result?.statusMap?.switch_1==='boolean'
      ?result.statusMap.switch_1
      :on;
    return res.status(200).json({
      ok:true,
      relay:confirmed,
      provider:result.provider
    });
  }catch(error){
    return res.status(502).json({
      ok:false,
      error:error?.message||'Falha ao enviar comando ao Viveiro.'
    });
  }
}
