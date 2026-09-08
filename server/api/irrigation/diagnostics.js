import { applyCors, authorize, getDeviceId, tuyaRequest } from '../_tuya.js';
import { listInkbirdDevices } from '../inkbird/_device.js';
import { fetchWeatherSnapshot } from '../weather/_weather.js';
import { listPushSubscriptions } from './_push.js';
import { whatsappNotificationStatus } from './_notify.js';
import { storeGet } from './_store.js';

function item(key,label,status,detail=''){
  return{key,label,status,detail};
}

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'Método não permitido.'});
  if(!authorize(req,res))return;

  const checks=[];
  checks.push(item('server','Servidor','ok','Fazenda 2E online'));

  try{
    await storeGet('IrrigacaoFazenda2E/config');
    checks.push(item('firebase','Firebase','ok','Leitura confirmada'));
  }catch(error){
    checks.push(item('firebase','Firebase','error',error?.message||'Falha de leitura'));
  }

  try{
    const weather=await fetchWeatherSnapshot();
    checks.push(item(
      'weather','Weather2-2',
      weather?.linked&&weather?.device?.online!==false?'ok':'warning',
      weather?.linked?(weather?.device?.online===false?'Dispositivo offline':weather?.metrics?.rainDetected?'Online • chuva detectada':'Online • sem chuva'):'Não vinculada'
    ));
  }catch(error){
    checks.push(item('weather','Weather2-2','error',error?.message||'Sem resposta'));
  }

  try{
    const id=getDeviceId();
    const result=await tuyaRequest('GET',`/v1.0/iot-03/devices/${id}/status`);
    const rows=Array.isArray(result)?result:(Array.isArray(result?.status)?result.status:[]);
    const map=Object.fromEntries(rows.map(x=>[x.code,x.value]));
    checks.push(item('viveiro','EKAZA • Viveiro','ok','Online • saída '+(map.switch_1===true?'ligada':'desligada')));
  }catch(error){
    checks.push(item('viveiro','EKAZA • Viveiro','error',error?.message||'Sem resposta'));
  }

  try{
    const devices=await listInkbirdDevices();
    const online=devices.filter(x=>x.online!==false).length;
    checks.push(item(
      'inkbird','INKBIRD • Café',
      !devices.length?'warning':online===devices.length?'ok':'warning',
      devices.length?online+'/'+devices.length+' controlador(es) online':'Nenhum controlador encontrado'
    ));
  }catch(error){
    checks.push(item('inkbird','INKBIRD • Café','error',error?.message||'Falha de leitura'));
  }

  try{
    const list=await listPushSubscriptions();
    checks.push(item('push','Notificações no iPhone',list.length?'ok':'warning',list.length?list.length+' aparelho(s) inscrito(s)':'Nenhum aparelho inscrito'));
  }catch(error){
    checks.push(item('push','Notificações no iPhone','error',error?.message||'Falha'));
  }

  const wa=whatsappNotificationStatus();
  checks.push(item('whatsapp','WhatsApp',wa.configured?'ok':'warning',wa.configured?'Conectado':'Ainda não configurado'));

  const rank={ok:0,warning:1,error:2};
  const overall=checks.reduce((worst,x)=>rank[x.status]>rank[worst]?x.status:worst,'ok');

  return res.status(200).json({
    ok:true,
    passive:true,
    checked_at:Date.now(),
    overall,
    checks,
    note:'Diagnóstico somente de leitura. Nenhuma bomba, válvula ou relé foi acionado.'
  });
}
