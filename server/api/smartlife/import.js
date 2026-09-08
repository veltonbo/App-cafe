import { applyCors } from '../_tuya.js';
import { importSmartLifeSession } from '../_smartlife.js';

function authorized(req){
  const expected=String(process.env.SMARTLIFE_IMPORT_TOKEN||'').trim();
  const actual=String(req.headers['x-smartlife-import-token']||'').trim();
  return Boolean(expected&&actual&&expected===actual);
}

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  const enabled=/^(1|true|yes)$/i.test(String(process.env.SMARTLIFE_IMPORT_ENABLED||'').trim());
  if(!enabled)return res.status(404).json({ok:false,error:'Importação Smart Life desativada.'});
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Método não permitido.'});
  if(!authorized(req))return res.status(401).json({ok:false,error:'Código de importação inválido.'});

  try{
    const session=req.body?.session;
    const result=await importSmartLifeSession(session);
    return res.status(200).json({
      ok:true,
      connected:true,
      devices:result.devices
    });
  }catch(error){
    return res.status(502).json({
      ok:false,
      error:error?.message||'Falha ao conectar Smart Life.'
    });
  }
}
