import { applyCors, authorize } from '../_tuya.js';
import { smartLifeConfigured, smartLifeListDevices, smartLifeReadDevice } from '../_smartlife.js';
import { getViveiroBinding, setViveiroBinding, clearViveiroBinding } from '../_viveiro_binding.js';
import { viveiroDeviceHasRelay } from '../_viveiro_transport.js';

function normDevice(device){return{deviceId:device?.id||null,name:device?.name||'Sem nome',online:device?.online!==false,category:device?.category||null,hasRelay:viveiroDeviceHasRelay(device),status:device?.status&&typeof device.status==='object'?device.status:{}}}

export default async function handler(req,res){
  applyCors(req,res);if(req.method==='OPTIONS')return res.status(204).end();if(!authorize(req,res))return;
  try{
    if(!(await smartLifeConfigured()))return res.status(409).json({ok:false,error:'Smart Life ainda não conectado.'});
    if(req.method==='GET'){
      const binding=await getViveiroBinding();
      const devices=(await smartLifeListDevices({force:true,maxAgeMs:0})).map(normDevice).filter(d=>d.hasRelay).sort((a,b)=>Number(b.online)-Number(a.online)||String(a.name).localeCompare(String(b.name)));
      return res.status(200).json({ok:true,binding,devices});
    }
    if(req.method==='POST'){
      const action=String(req.body?.action||'select');
      if(action==='clear')return res.status(200).json({ok:true,binding:await clearViveiroBinding()});
      const deviceId=String(req.body?.deviceId||'').trim();if(!deviceId)return res.status(400).json({ok:false,error:'Selecione um EKAZA.'});
      const device=await smartLifeReadDevice({deviceId,maxAgeMs:0});
      if(!device?.id)return res.status(404).json({ok:false,error:'Dispositivo não encontrado no Smart Life.'});
      if(!viveiroDeviceHasRelay(device))return res.status(400).json({ok:false,error:'Esse dispositivo não possui o relé switch_1 e não pode ser usado como EKAZA do viveiro.'});
      if(action==='test')return res.status(200).json({ok:true,tested:true,device:normDevice(device)});
      if(device.online===false)return res.status(409).json({ok:false,error:'Esse dispositivo está offline. Ligue-o e tente novamente.'});
      const binding=await setViveiroBinding({deviceId:device.id,deviceName:device.name});
      return res.status(200).json({ok:true,binding,device:normDevice(device),safe:true,message:'EKAZA selecionado. Nenhum comando de ligar foi enviado.'});
    }
    return res.status(405).json({ok:false,error:'Método não permitido.'});
  }catch(error){return res.status(502).json({ok:false,error:error?.message||'Falha ao gerenciar o EKAZA.'});}
}
