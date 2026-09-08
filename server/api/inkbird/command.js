import { applyCors, authorize } from '../_tuya.js';
import { readInkbirdState, sendInkbirdCommands } from './_transport.js';

function validateValue(fn,value){
  const type=String(fn?.type||'').toLowerCase();
  const values=fn?.values&&typeof fn.values==='object'?fn.values:{};

  if(/boolean|bool/.test(type))return typeof value==='boolean';
  if(/integer|value/.test(type)){
    if(!Number.isFinite(Number(value)))return false;
    const n=Number(value);
    if(Number.isFinite(Number(values.min))&&n<Number(values.min))return false;
    if(Number.isFinite(Number(values.max))&&n>Number(values.max))return false;
    return true;
  }
  if(/enum/.test(type)){
    const range=Array.isArray(values.range)?values.range:[];
    return !range.length||range.includes(value);
  }
  if(/string/.test(type)){
    if(typeof value!=='string')return false;
    const maxlen=Number(values.maxlen||0);
    return !maxlen||value.length<=maxlen;
  }
  if(/raw/.test(type))return typeof value==='string'&&value.length>0;
  return true;
}

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Método não permitido.'});
  if(!authorize(req,res))return;

  const requested=Array.isArray(req.body?.commands)
    ?req.body.commands
    :[{code:req.body?.code,value:req.body?.value}];

  if(!requested.length||requested.length>4){
    return res.status(400).json({ok:false,error:'Informe de 1 a 4 comandos.'});
  }

  const normalized=requested.map(item=>({
    code:String(item?.code||'').trim(),
    value:item?.value
  }));
  if(normalized.some(item=>!item.code||item.value===undefined)){
    return res.status(400).json({ok:false,error:'Todos os comandos precisam de code e value.'});
  }

  try{
    const preferredId=String(req.body?.device_id||'').trim();
    const state=await readInkbirdState({deviceId:preferredId,maxAgeMs:2000});
    const functionMap=Object.fromEntries((state.functions||[]).map(item=>[item.code,item]));

    for(const item of normalized){
      const fn=functionMap[item.code];
      if(!fn){
        return res.status(400).json({
          ok:false,error:'Comando não liberado pelo IIC-800 no Smart Life.',code:item.code
        });
      }
      if(!validateValue(fn,item.value)){
        return res.status(400).json({
          ok:false,error:'Valor fora do limite permitido para o dispositivo.',code:item.code
        });
      }
    }

    const result=await sendInkbirdCommands({
      deviceId:state.deviceId,
      commands:normalized,
      priority:false
    });
    return res.status(200).json({
      ok:true,
      provider:'smartlife',
      device_id:state.deviceId,
      commands:normalized,
      state:result.runtime
    });
  }catch(error){
    return res.status(502).json({
      ok:false,error:error?.message||'Falha ao enviar comando ao INKBIRD pelo Smart Life.'
    });
  }
}
