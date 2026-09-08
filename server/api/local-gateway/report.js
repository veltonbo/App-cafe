import { applyCors, authorize } from '../_tuya.js';
import { storeGet, storeSet } from '../irrigation/_store.js';

const STORE_PATH='IrrigacaoFazenda2E/localGateway/latest';
const MAX_DEVICES=12;
const MAX_DPS=96;
const STANDARD_KEYS=new Set([
  'switch_1','cycle_time','countdown_1','relay_status','switch_inching',
  'temperature','humidity','rain','rain_state','rain_today','rain_24h','rain_rate'
]);

function textValue(value,max=160){
  return String(value??'').trim().slice(0,max);
}

function scalar(value){
  if(value===null||typeof value==='boolean'||typeof value==='number')return value;
  if(typeof value==='string')return value.slice(0,2000);
  return null;
}

function cleanMap(input={},limit=MAX_DPS){
  if(!input||typeof input!=='object'||Array.isArray(input))return{};
  const out={};
  for(const [key,value] of Object.entries(input).slice(0,limit)){
    const cleaned=scalar(value);
    if(cleaned!==null||value===null)out[textValue(key,80)]=cleaned;
  }
  return out;
}

function cleanStandard(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))return{};
  const out={};
  for(const [key,value] of Object.entries(input)){
    if(!STANDARD_KEYS.has(key))continue;
    const cleaned=scalar(value);
    if(cleaned!==null||value===null)out[key]=cleaned;
  }
  return out;
}

function sanitizeDevice(item={}){
  const id=textValue(item.id,160);
  const name=textValue(item.name,120);
  return{
    name,
    id,
    ip:textValue(item.ip,80),
    version:textValue(item.version,24),
    online:item.online===true,
    standard:cleanStandard(item.standard),
    dps:cleanMap(item.dps),
    error:textValue(item.error,500)||null
  };
}

function sanitizeReport(body={}){
  const devices=Array.isArray(body.devices)?body.devices.slice(0,MAX_DEVICES).map(sanitizeDevice):[];
  const captured=Number(body.captured_at||0);
  return{
    gateway_id:textValue(body.gateway_id||'fazenda-2e-local',120),
    gateway_version:textValue(body.gateway_version||'1',40),
    hostname:textValue(body.hostname,120),
    captured_at:Number.isFinite(captured)&&captured>0?captured:Date.now(),
    received_at:Date.now(),
    read_only:true,
    device_count:devices.length,
    devices
  };
}

export async function getLatestLocalGatewayReport(){
  return (await storeGet(STORE_PATH))||null;
}

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(!authorize(req,res))return;

  try{
    if(req.method==='GET'){
      const report=await getLatestLocalGatewayReport();
      const age=report?.received_at?Math.max(0,Math.round((Date.now()-Number(report.received_at))/1000)):null;
      return res.status(200).json({
        ok:true,
        report,
        age_seconds:age,
        stale:age===null?true:age>120
      });
    }

    if(req.method==='POST'){
      const report=sanitizeReport(req.body||{});
      if(!report.devices.length){
        return res.status(400).json({ok:false,error:'O gateway não enviou nenhum dispositivo.'});
      }
      await storeSet(STORE_PATH,report);
      return res.status(200).json({
        ok:true,
        received_at:report.received_at,
        device_count:report.device_count,
        read_only:true
      });
    }

    return res.status(405).json({ok:false,error:'Método não permitido.'});
  }catch(error){
    return res.status(502).json({
      ok:false,
      error:error?.message||'Falha ao registrar o gateway local.'
    });
  }
}
