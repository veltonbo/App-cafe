import { listInkbirdDevices } from '../inkbird/_device.js';
import { readInkbirdState, sendInkbirdCommands } from '../inkbird/_transport.js';
import { encodeDp45Stop, encodeNormalTimerZone, dp45HasWatering } from '../inkbird/_iic800.js';
import { fetchWeatherSnapshot, decideWeather } from '../weather/_weather.js';
import { appendHistory, getAutomationConfig, storeGet, storeSet } from './_store.js';

function token(req){
  const header=String(req.headers.authorization||'');
  return header.toLowerCase().startsWith('bearer ')?header.slice(7).trim():'';
}
function allowed(req){
  const supplied=token(req);
  const cron=String(process.env.CRON_SECRET||'').trim();
  const app=String(process.env.APP_CONTROL_TOKEN||'').trim();
  return Boolean(supplied&&((cron&&supplied===cron)||(app&&supplied===app)));
}
function uiMaskToDevice(mask){
  const m=Math.max(0,Math.min(127,Number(mask)||0));
  return((m>>1)&0x3f)|((m&1)<<6);
}
async function scheduleCache(deviceId){
  const raw=await storeGet(`IrrigacaoFazenda2E/inkbirdSchedules/${deviceId}`).catch(()=>null);
  return raw&&typeof raw==='object'?raw:{};
}
async function sendScheduleConfig(deviceId,config,enabled){
  const deviceCfg={
    ...config,
    enabled,
    days_mask:uiMaskToDevice(config.days_mask)
  };
  const encoded=encodeNormalTimerZone(null,Number(config.zone),deviceCfg);
  return sendInkbirdCommands({
    deviceId,
    commands:[{code:'normal_timer',value:encoded.raw}]
  });
}

export default async function handler(req,res){
  if(!['GET','POST'].includes(req.method))return res.status(405).json({ok:false,error:'Método não permitido.'});
  if(!allowed(req))return res.status(401).json({ok:false,error:'Não autorizado.'});

  try{
    const config=await getAutomationConfig();
    const policy=config?.weather||{};
    if(policy.backgroundProtection!==true){
      return res.status(200).json({ok:true,enabled:false,message:'Proteção meteorológica em segundo plano desativada.'});
    }

    const snapshot=await fetchWeatherSnapshot({maxAgeMs:5000});
    const weatherState=(await storeGet('IrrigacaoFazenda2E/weatherState').catch(()=>null))||{};
    if(snapshot?.metrics?.rainDetected)weatherState.lastRainAt=Date.now();
    const decision=decideWeather(snapshot,policy,weatherState);
    await storeSet('IrrigacaoFazenda2E/weatherState',{
      ...weatherState,checkedAt:Date.now(),decision,
      snapshot:{linked:Boolean(snapshot?.linked),online:snapshot?.device?.online??null,metrics:snapshot?.metrics||null}
    }).catch(()=>null);

    const controllers=await listInkbirdDevices();
    const results=[];

    for(let i=0;i<controllers.length;i++){
      const ctrl=controllers[i],id=ctrl.id;
      const guard=(await storeGet(`IrrigacaoFazenda2E/background/${id}`).catch(()=>null))||{};
      const device=await readInkbirdState({deviceId:id,force:true,maxAgeMs:0}).catch(()=>null);
      if(!device){
        results.push({device_id:id,action:'offline_or_unavailable'});
        continue;
      }

      let manualStopped=false;
      if(decision.blocked&&dp45HasWatering(device.statusMap.irrigation_time_all)){
        await sendInkbirdCommands({
          deviceId:id,
          commands:[{code:'irrigation_time_all',value:encodeDp45Stop(8)}],
          priority:true
        });
        await storeSet(`IrrigacaoFazenda2E/active/${id}`,null).catch(()=>null);
        manualStopped=true;
        await appendHistory({
          type:'weather_stop',controller_id:id,controller_index:i+1,source:'smartlife',
          status:'confirmed',detail:'Irrigação interrompida pela proteção meteorológica',weather:decision
        }).catch(()=>null);
      }

      const cache=await scheduleCache(id);
      const known=Array.from({length:8},(_,z)=>cache[String(z+1)]).filter(Boolean);
      const fullScheduleKnowledge=known.length===8;

      if(decision.blocked&&!guard.suspended&&fullScheduleKnowledge){
        const saved={};
        for(let zone=1;zone<=8;zone++){
          const cfg={...cache[String(zone)],zone};
          saved[String(zone)]=cfg;
          if(cfg.enabled)await sendScheduleConfig(id,cfg,false);
        }
        await storeSet(`IrrigacaoFazenda2E/background/${id}`,{
          suspended:true,saved_schedules:saved,suspended_at:Date.now(),reason:decision
        });
        await appendHistory({
          type:'weather_suspend',controller_id:id,controller_index:i+1,source:'smartlife',
          status:'confirmed',detail:'Agendas conhecidas suspensas pelo clima',weather:decision
        }).catch(()=>null);
        results.push({device_id:id,action:'suspended',manual_stopped:manualStopped,known_schedules:8});
      }else if(!decision.blocked&&guard.suspended&&guard.saved_schedules){
        for(let zone=1;zone<=8;zone++){
          const cfg=guard.saved_schedules[String(zone)];
          if(cfg?.enabled)await sendScheduleConfig(id,{...cfg,zone},true);
        }
        await storeSet(`IrrigacaoFazenda2E/background/${id}`,{
          suspended:false,restored_at:Date.now(),saved_schedules:null
        });
        await appendHistory({
          type:'weather_restore',controller_id:id,controller_index:i+1,source:'smartlife',
          status:'confirmed',detail:'Agendas restauradas após liberação do clima',weather:decision
        }).catch(()=>null);
        results.push({device_id:id,action:'restored'});
      }else{
        results.push({
          device_id:id,
          action:manualStopped?'manual_stopped':'none',
          suspended:Boolean(guard.suspended),
          known_schedules:known.length,
          full_schedule_protection:fullScheduleKnowledge,
          limited:decision.blocked&&!fullScheduleKnowledge
        });
      }
    }

    return res.status(200).json({
      ok:true,enabled:true,provider:'smartlife',decision,controllers:results,
      note:'A suspensão preventiva de agendas exige que as 8 zonas tenham sido lidas/salvas pelo app.'
    });
  }catch(error){
    return res.status(502).json({
      ok:false,error:error?.message||'Falha na proteção meteorológica do Café via Smart Life.'
    });
  }
}
