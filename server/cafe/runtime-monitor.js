import { randomUUID } from 'node:crypto';
import { listInkbirdDevices } from '../api/inkbird/_device.js';
import { readInkbirdState, sendInkbirdCommands } from '../api/inkbird/_transport.js';
import { encodeDp45Stop, dp45HasWatering } from '../api/inkbird/_iic800.js';
import { fetchWeatherSnapshot, decideWeather } from '../api/weather/_weather.js';
import { appendHistory, getAutomationConfig, storeGet, storeSet } from '../api/irrigation/_store.js';
import {
  CAFE_ROOT,
  getCafeActiveSession,
  setCafeActiveSession,
  getCafeWeatherState,
  setCafeWeatherState,
  getCafeScheduleCache
} from './state.js';

const MONITOR_ROOT=CAFE_ROOT+'/runtimeMonitor';

function activeZones(mask){
  const out=[];
  const value=Number(mask||0);
  for(let zone=1;zone<=8;zone++)if(value&(1<<(zone-1)))out.push(zone);
  return out;
}
function sectorFor(controller,zone){
  return Number(controller.sector_start||1)+Number(zone)-1;
}
function scheduleDuration(cache,zone){
  const row=cache?.[zone]||cache?.[String(zone)]||{};
  return Math.max(0,Number(row?.duration_minutes||0));
}
async function verifyStopped(deviceId){
  for(let i=0;i<5;i++){
    const state=await readInkbirdState({deviceId,force:true,maxAgeMs:0}).catch(()=>null);
    if(state&&!dp45HasWatering(state.statusMap?.irrigation_time_all))return state;
    await new Promise(resolve=>setTimeout(resolve,i===0?350:650));
  }
  return null;
}

export async function monitorCafeRuntime(){
  const now=Date.now();
  const devices=await listInkbirdDevices().catch(()=>[]);
  const controllers=(Array.isArray(devices)?devices:[]).map((device,index)=>({
    id:device.id,
    name:device.name||'IIC-800-WIFI',
    online:device.online!==false,
    controller_index:index+1,
    sector_start:index*8+1,
    sector_end:index*8+8
  }));

  const [config,weatherSnapshot,weatherStateRaw]=await Promise.all([
    getAutomationConfig().catch(()=>({})),
    fetchWeatherSnapshot({maxAgeMs:6000}).catch(error=>({linked:false,error:error?.message||String(error)})),
    getCafeWeatherState().catch(()=>({}))
  ]);
  const weatherState={...(weatherStateRaw||{})};
  if(weatherSnapshot?.metrics?.rainDetected)weatherState.lastRainAt=now;
  const policy=config?.weather||{
    enabled:true,rainThreshold:5,rainHoldHours:12,blockWhileRaining:true,backgroundProtection:true
  };
  const decision=decideWeather(weatherSnapshot,policy,weatherState);
  const previousDecision=weatherState?.decision||{};
  const weatherChanged=
    Boolean(previousDecision?.blocked)!==Boolean(decision?.blocked)||
    Boolean(weatherState?.snapshot?.metrics?.rainDetected)!==Boolean(weatherSnapshot?.metrics?.rainDetected);
  if(weatherChanged||now-Number(weatherState?.checkedAt||0)>=60000){
    await setCafeWeatherState({
      ...weatherState,
      checkedAt:now,
      decision,
      snapshot:{
        linked:Boolean(weatherSnapshot?.linked),
        online:weatherSnapshot?.device?.online??null,
        metrics:weatherSnapshot?.metrics||null
      }
    }).catch(()=>null);
  }

  const results=[];
  for(const controller of controllers){
    const id=String(controller.id||'');
    if(!id)continue;

    const [state,manualSession,monitorRaw,scheduleCache]=await Promise.all([
      readInkbirdState({deviceId:id,force:false,maxAgeMs:5000}).catch(()=>null),
      getCafeActiveSession(id).catch(()=>null),
      storeGet(MONITOR_ROOT+'/'+id).catch(()=>null),
      getCafeScheduleCache(id).catch(()=>({}))
    ]);
    if(!state){
      results.push({device_id:id,ok:false,error:'state_unavailable'});
      continue;
    }

    let monitor={
      last_active_mask:0,
      auto_sessions:{},
      auto_candidates:{},
      ...(monitorRaw&&typeof monitorRaw==='object'?monitorRaw:{})
    };
    monitor.auto_sessions=monitor.auto_sessions&&typeof monitor.auto_sessions==='object'?monitor.auto_sessions:{};
    monitor.auto_candidates=monitor.auto_candidates&&typeof monitor.auto_candidates==='object'?monitor.auto_candidates:{};
    let mask=Number(state.runtime?.active_mask||0);
    const zones=activeZones(mask);

    // Proteção climática contínua. Não presume fluxo de água: apenas confirma
    // que o estado de irrigação do IIC-800 foi encerrado pelo Smart Life.
    if(
      policy.enabled!==false&&policy.backgroundProtection===true&&
      decision?.blocked&&mask
    ){
      const stopped=await sendInkbirdCommands({
        deviceId:id,
        commands:[{code:'irrigation_time_all',value:encodeDp45Stop(8)}],
        priority:true
      }).then(async sent=>{
        if(!dp45HasWatering(sent.statusMap?.irrigation_time_all))return sent;
        return verifyStopped(id);
      }).catch(()=>null);

      if(stopped){
        await appendHistory({
          type:'weather_stop',
          controller_id:id,
          controller_index:Number(controller.controller_index||1),
          source:'cafe_runtime_monitor',
          status:'confirmed',
          detail:'Irrigação interrompida pela proteção climática: '+String(decision.reason||'bloqueio meteorológico'),
          weather:decision,
          active_mask_before:mask
        }).catch(error=>console.error('Histórico Café weather_stop:',error?.message||error));
        if(manualSession){
          const sessionId=String(manualSession.session_id||'').trim();
          await appendHistory({
            ...(sessionId?{event_id:'weather-interrupt-'+sessionId,session_id:sessionId}:{}),
            type:'interrupted',
            controller_id:id,
            controller_index:Number(controller.controller_index||1),
            zone:Number(manualSession.zone||0),
            sector:Number(manualSession.sector||0),
            duration_minutes:Number(manualSession.duration_minutes||0),
            source:'cafe_runtime_monitor',
            status:'weather_blocked',
            detail:'Irrigação manual interrompida pela proteção climática.',
            weather:decision
          }).catch(()=>null);
          await setCafeActiveSession(id,null).catch(()=>null);
        }
        mask=0;
      }
    }

    // Sessões manuais/grupos já são registradas pelas rotas próprias.
    // O monitor abaixo serve para execuções autônomas observadas no IIC-800.
    if(!manualSession){
      const currentZones=new Set(activeZones(mask));

      for(const zone of currentZones){
        const key=String(zone);
        if(monitor.auto_sessions[key])continue;
        const candidate=monitor.auto_candidates[key];
        if(!candidate){
          monitor.auto_candidates[key]={first_seen_at:now};
          continue;
        }
        if(now-Number(candidate.first_seen_at||now)<12000)continue;

        const startedAt=Number(candidate.first_seen_at||now);
        const sessionId='cafe-auto-'+startedAt+'-'+zone+'-'+randomUUID().slice(0,6);
        const duration=scheduleDuration(scheduleCache,zone);
        const session={
          session_id:sessionId,
          zone,
          sector:sectorFor(controller,zone),
          controller_index:Number(controller.controller_index||1),
          started_at:startedAt,
          duration_minutes:duration,
          source:'iic800_observed'
        };
        monitor.auto_sessions[key]=session;
        delete monitor.auto_candidates[key];
        await appendHistory({
          event_id:'auto-start-'+sessionId,
          session_id:sessionId,
          type:'auto_start',
          controller_id:id,
          controller_index:session.controller_index,
          zone,
          sector:session.sector,
          duration_minutes:duration,
          mode:'Auto',
          source:'iic800_observed',
          status:'confirmed',
          detail:'Irrigação automática observada no IIC-800.'
        }).catch(error=>console.error('Histórico Café auto_start:',error?.message||error));
      }

      for(const key of Object.keys(monitor.auto_candidates)){
        if(!currentZones.has(Number(key)))delete monitor.auto_candidates[key];
      }

      for(const [key,session] of Object.entries(monitor.auto_sessions)){
        const zone=Number(key);
        if(currentZones.has(zone))continue;
        const finishedAt=now;
        const actualMinutes=Math.max(0,(finishedAt-Number(session.started_at||finishedAt))/60000);
        await appendHistory({
          event_id:'auto-complete-'+String(session.session_id),
          session_id:String(session.session_id),
          type:'auto_complete',
          controller_id:id,
          controller_index:Number(session.controller_index||controller.controller_index||1),
          zone,
          sector:Number(session.sector||sectorFor(controller,zone)),
          duration_minutes:Number(session.duration_minutes||0),
          actual_duration_minutes:Number(actualMinutes.toFixed(2)),
          mode:'Auto',
          source:'iic800_observed',
          status:'confirmed',
          detail:'Irrigação automática observada como concluída no IIC-800.',
          started_at:Number(session.started_at||0)||null,
          completed_at:finishedAt
        }).catch(error=>console.error('Histórico Café auto_complete:',error?.message||error));
        delete monitor.auto_sessions[key];
      }
    }else if(Object.keys(monitor.auto_sessions).length||Object.keys(monitor.auto_candidates).length){
      // Evita classificar como automático um acionamento iniciado pelo próprio app.
      monitor.auto_sessions={};
      monitor.auto_candidates={};
    }

    const previousCheckedAt=Number(monitor.checked_at||0);
    const previousMask=Number(monitor.last_active_mask||0);
    const hasTransientState=
      mask!==0||
      Object.keys(monitor.auto_sessions).length>0||
      Object.keys(monitor.auto_candidates).length>0;
    const monitorChanged=
      previousMask!==mask||
      Boolean(monitor.weather_blocked)!==Boolean(decision?.blocked);

    monitor={
      ...monitor,
      last_active_mask:mask,
      checked_at:now,
      controller_online:state.online!==false,
      weather_blocked:Boolean(decision?.blocked)
    };
    if(hasTransientState||monitorChanged||now-previousCheckedAt>=60000){
      await storeSet(MONITOR_ROOT+'/'+id,monitor).catch(error=>
        console.warn('Café runtime monitor state:',error?.message||error)
      );
    }
    results.push({device_id:id,ok:true,active_mask:mask,auto_sessions:Object.keys(monitor.auto_sessions).length});
  }

  return{
    ok:true,
    checked_at:now,
    weather_blocked:Boolean(decision?.blocked),
    controllers:results
  };
}
