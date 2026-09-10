import { applyCors, authorize } from '../_tuya.js';
import { readInkbirdState, sendInkbirdCommands } from './_transport.js';
import { decodeNormalTimer, encodeNormalTimerZone } from './_iic800.js';
import { appendHistory, storeGet, storeSet } from '../irrigation/_store.js';
import { CAFE_SCHEDULE_ROOT, getCafeScheduleCache } from '../cafe/_state.js';

const CACHE_ROOT=CAFE_SCHEDULE_ROOT;

function uiMaskToDevice(mask){
  const m=Math.max(0,Math.min(127,Number(mask)||0));
  return ((m>>1)&0x3f)|((m&1)<<6);
}
function deviceMaskToUi(mask){
  const m=Math.max(0,Math.min(127,Number(mask)||0));
  return ((m&0x3f)<<1)|((m>>6)&1);
}
function validTimes(times){
  if(!Array.isArray(times))return[];
  return times.slice(0,6)
    .map(x=>String(typeof x==='string'?x:x?.value||'').trim())
    .filter(x=>/^([01]?\d|2[0-3]):[0-5]\d$/.test(x))
    .map(x=>x.length===4?'0'+x:x);
}
function normalizeConfig(body={}){
  const zone=Number(body.zone);
  if(!Number.isInteger(zone)||zone<1||zone>8)throw new Error('Setor inválido.');
  const enabled=body.enabled!==false;
  const duration=Math.max(1,Math.min(255,Math.round(Number(body.duration_minutes||10))));
  const startTimes=enabled?validTimes(body.start_times):[];
  if(enabled&&!startTimes.length)throw new Error('Informe pelo menos um horário de início.');
  const cycleMode=Math.max(0,Math.min(3,Number(body.cycle_mode||0)));
  const daysMask=Math.max(0,Math.min(127,Number(body.days_mask??127)));
  if(enabled&&cycleMode===0&&!daysMask)throw new Error('Selecione pelo menos um dia da semana.');
  return{
    zone,enabled,duration_minutes:enabled?duration:0,start_times:startTimes,
    cycle_mode:cycleMode,days_mask:daysMask,
    interval_days:Math.max(1,Math.min(99,Number(body.interval_days||1))),
    interval_start:body.interval_start||{},
    rain_sensor_follow:body.rain_sensor_follow!==false
  };
}
function channelToUi(channel){
  if(!channel)return null;
  return{
    ...channel,
    days_mask:Number(channel.cycle_mode||0)===0
      ?deviceMaskToUi(channel.days_mask)
      :channel.days_mask,
    known:true
  };
}
function sameConfig(channel,config){
  if(!channel)return false;
  const aTimes=(channel.start_times||[]).map(x=>typeof x==='string'?x:x.value);
  return Number(channel.zone)===Number(config.zone)&&
    Number(channel.duration_minutes)===Number(config.duration_minutes)&&
    Boolean(channel.enabled)===Boolean(config.enabled)&&
    Number(channel.cycle_mode||0)===Number(config.cycle_mode||0)&&
    (Number(config.cycle_mode||0)!==0||Number(channel.days_mask)===Number(config.days_mask))&&
    JSON.stringify(aTimes)===JSON.stringify(config.start_times||[]);
}
async function readCache(deviceId){
  return getCafeScheduleCache(deviceId);
}
async function mergePassive(deviceId,statusValue){
  const decoded=decodeNormalTimer(statusValue);
  const cache=await readCache(deviceId);
  let changed=false;
  for(const ch of decoded.channels||[]){
    const ui=channelToUi(ch);
    if(!ui||ui.zone<1||ui.zone>8)continue;
    cache[String(ui.zone)]={...ui,source:'device',observed_at:Date.now()};
    changed=true;
  }
  if(changed)await storeSet(`${CACHE_ROOT}/${deviceId}`,cache).catch(()=>null);
  return cache;
}
function channelsFromCache(cache){
  return Array.from({length:8},(_,i)=>{
    const zone=i+1;
    const item=cache?.[String(zone)]||null;
    return item?{...item,zone}:{zone,enabled:false,duration_minutes:0,start_times:[],cycle_mode:0,days_mask:127,known:false};
  });
}

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(!authorize(req,res))return;

  try{
    const preferredId=String((req.method==='GET'?req.query?.device_id:req.body?.device_id)||'').trim();
    const state=await readInkbirdState({deviceId:preferredId,force:true,maxAgeMs:0});
    const deviceId=state.deviceId;
    let cache=await mergePassive(deviceId,state.statusMap.normal_timer);

    if(req.method==='GET'){
      return res.status(200).json({
        ok:true,provider:'smartlife',device_id:deviceId,
        source:'smartlife+firebase_cache',
        raw_available:state.statusMap.normal_timer!=null,
        channels:channelsFromCache(cache),
        known_zones:Object.keys(cache).map(Number).filter(n=>n>=1&&n<=8).sort((a,b)=>a-b)
      });
    }
    if(req.method!=='POST'){
      return res.status(405).json({ok:false,error:'Método não permitido.'});
    }

    const config=normalizeConfig(req.body||{});
    const deviceConfig={
      ...config,
      days_mask:uiMaskToDevice(config.days_mask)
    };
    const encoded=encodeNormalTimerZone(state.statusMap.normal_timer,config.zone,deviceConfig);

    await sendInkbirdCommands({
      deviceId,
      commands:[{code:'normal_timer',value:encoded.raw}]
    });

    // Guarda imediatamente a configuração desejada. O DP38 do Device Sharing
    // é um evento por zona e pode aparecer com pequeno atraso.
    cache[String(config.zone)]={
      ...config,known:true,source:'app',updated_at:Date.now(),pending_confirmation:true
    };
    await storeSet(`${CACHE_ROOT}/${deviceId}`,cache);

    await new Promise(resolve=>setTimeout(resolve,700));
    const verifyState=await readInkbirdState({deviceId,force:true,maxAgeMs:0}).catch(()=>null);
    const decoded=decodeNormalTimer(verifyState?.statusMap?.normal_timer);
    const returned=channelToUi((decoded.channels||[]).find(ch=>Number(ch.zone)===config.zone));
    const verified=sameConfig(returned,config);

    if(verified){
      cache[String(config.zone)]={
        ...returned,source:'device',updated_at:Date.now(),pending_confirmation:false
      };
      await storeSet(`${CACHE_ROOT}/${deviceId}`,cache);
    }

    await appendHistory({
      type:'schedule',controller_id:deviceId,zone:config.zone,
      duration_minutes:config.duration_minutes,mode:'Auto',source:'smartlife',
      status:config.enabled?(verified?'enabled_confirmed':'enabled_sent'):(verified?'disabled_confirmed':'disabled_sent'),
      detail:config.enabled?'Programação automática atualizada':'Programação automática desativada'
    }).catch(()=>null);

    return res.status(200).json({
      ok:true,
      verified,
      pending_confirmation:!verified,
      provider:'smartlife',
      device_id:deviceId,
      channel:cache[String(config.zone)],
      channels:channelsFromCache(cache),
      transport:'smartlife_device_sharing',
      note:verified?null:'Programação enviada. O IIC-800 ainda não devolveu a confirmação dessa zona pelo DP38.'
    });
  }catch(error){
    return res.status(502).json({
      ok:false,error:error?.message||'Falha ao acessar programação automática do IIC-800 pelo Smart Life.'
    });
  }
}
