import { randomUUID } from 'node:crypto';
import { applyCors, authorize } from '../_tuya.js';
import { readInkbirdState, sendInkbirdCommands } from './_transport.js';
import { encodeDp45Manual, encodeDp45Stop, dp45HasWatering } from './_iic800.js';
import { fetchWeatherSnapshot, decideWeather } from '../weather/_weather.js';
import { appendHistory, getAutomationConfig } from '../irrigation/_store.js';
import { getCafeActiveSession, setCafeActiveSession, getCafeWeatherState, setCafeWeatherState } from '../cafe/_state.js';

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

async function evaluateServerWeather(){
  const config=await getAutomationConfig().catch(()=>({}));
  const policy=config?.weather||{
    enabled:true,rainThreshold:5,rainHoldHours:12,blockWhileRaining:true
  };
  const snapshot=await fetchWeatherSnapshot({maxAgeMs:5000}).catch(()=>null);
  const weatherState=await getCafeWeatherState();
  if(snapshot?.metrics?.rainDetected)weatherState.lastRainAt=Date.now();
  const decision=decideWeather(snapshot,policy,weatherState);
  await setCafeWeatherState({
    ...weatherState,
    lastRainAt:weatherState.lastRainAt||null,
    checkedAt:Date.now(),
    decision,
    snapshot:{
      linked:Boolean(snapshot?.linked),
      online:snapshot?.device?.online??null,
      metrics:snapshot?.metrics||null
    }
  }).catch(error=>console.error('Café weatherState:',error?.message||error));
  return{snapshot,decision};
}

function controllerMeta(state,zone){
  const devices=state.resolved.devices||[];
  const index=Math.max(0,devices.findIndex(d=>d.id===state.deviceId));
  return{controller_index:index+1,sector:index*8+Number(zone||0)};
}

function runtimeResponse(state){
  return{
    ...state.runtime,
    operation_mode:(state.runtime.active_mask||state.runtime.pending_mask)?'Manual':'Auto',
    zonerun_state:Number(state.runtime.active_mask||0),
    pendingzone_state:Number(state.runtime.pending_mask||0),
    irrigation_mode:state.statusMap.irrigation_mode??null
  };
}

async function waitForWatering(deviceId,zone,expectedOn,attempts=6){
  let last=null;
  for(let i=0;i<attempts;i++){
    if(i)await sleep(650);
    try{
      last=await readInkbirdState({deviceId,force:true,maxAgeMs:0});
      const on=dp45HasWatering(last.statusMap.irrigation_time_all,expectedOn?zone:null);
      if(expectedOn?on:!dp45HasWatering(last.statusMap.irrigation_time_all)){
        return{confirmed:true,state:last};
      }
    }catch{}
  }
  return{confirmed:false,state:last};
}

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Método não permitido.'});
  if(!authorize(req,res))return;

  const preferredId=String(req.body?.device_id||'').trim();
  const action=String(req.body?.action||'').trim().toLowerCase();
  const zone=Number(req.body?.zone);
  const duration=Math.round(Number(req.body?.duration_minutes||0));

  if(!['start','stop','auto'].includes(action)){
    return res.status(400).json({ok:false,error:'Ação inválida.'});
  }
  if(action==='start'&&(!Number.isInteger(zone)||zone<1||zone>8)){
    return res.status(400).json({ok:false,error:'Setor inválido. Use zona de 1 a 8.'});
  }
  if(action==='start'&&(!Number.isInteger(duration)||duration<1||duration>1440)){
    return res.status(400).json({ok:false,error:'Duração deve ficar entre 1 e 1440 minutos.'});
  }

  try{
    const before=await readInkbirdState({deviceId:preferredId,force:true,maxAgeMs:0});
    if(before.online===false){
      return res.status(409).json({ok:false,error:'Controlador offline. O comando não foi enviado.'});
    }
    const deviceId=before.deviceId;
    const meta=controllerMeta(before,zone);

    if(action==='start'){
      const session=await getCafeActiveSession(deviceId);
      const alreadyWatering=dp45HasWatering(before.statusMap.irrigation_time_all);
      const sessionStillActive=Boolean(session&&Number(session.expected_end_at||0)>Date.now()-120000);
      if(alreadyWatering||sessionStillActive){
        return res.status(409).json({
          ok:false,
          error:'Já existe uma irrigação ativa ou aguardando neste controlador. Pare o ciclo atual antes de iniciar outro.',
          state:runtimeResponse(before)
        });
      }

      const weather=await evaluateServerWeather();
      if(weather.decision?.blocked){
        await appendHistory({
          type:'blocked',controller_id:deviceId,controller_index:meta.controller_index,
          zone,sector:meta.sector,duration_minutes:duration,mode:'Manual',
          source:'server_weather',status:'blocked',detail:weather.decision.reason,weather:weather.decision
        }).catch(()=>null);
        return res.status(423).json({
          ok:false,blocked:true,error:'Irrigação bloqueada pela proteção meteorológica.',
          weather:weather.decision
        });
      }

      const raw=encodeDp45Manual({[zone]:duration},8);
      const sent=await sendInkbirdCommands({
        deviceId,
        commands:[{code:'irrigation_time_all',value:raw}]
      });
      let verification=dp45HasWatering(sent.statusMap.irrigation_time_all,zone)
        ?{confirmed:true,state:sent}
        :await waitForWatering(deviceId,zone,true,6);

      if(!verification.confirmed){
        // O Device Sharing pode demorar para refletir o RAW. Não repetimos o
        // comando automaticamente para evitar iniciar duas vezes.
        return res.status(409).json({
          ok:false,
          sent:true,
          error:'O comando foi enviado, mas o Smart Life ainda não confirmou o início. Não repita até atualizar o estado.',
          device_id:deviceId,
          action:'start',
          zone,
          duration_minutes:duration,
          state:verification.state?runtimeResponse(verification.state):runtimeResponse(before)
        });
      }

      const startedAt=Date.now();
      const expectedEndAt=startedAt+duration*60000;
      const sessionId='cafe-'+startedAt+'-'+randomUUID().slice(0,8);
      await setCafeActiveSession(deviceId,{
        session_id:sessionId,kind:'zone',zone,sector:meta.sector,controller_index:meta.controller_index,
        duration_minutes:duration,started_at:startedAt,expected_end_at:expectedEndAt,
        mode:'Manual',source:'smartlife'
      });
      await appendHistory({
        event_id:'start-'+sessionId,session_id:sessionId,
        type:'start',controller_id:deviceId,controller_index:meta.controller_index,
        zone,sector:meta.sector,duration_minutes:duration,mode:'Manual',
        source:'smartlife',status:'confirmed',detail:'Irrigação manual iniciada',
        weather:weather.decision
      }).catch(error=>console.error('Histórico Café start:',error?.message||error));

      return res.status(200).json({
        ok:true,verified:true,provider:'smartlife',device_id:deviceId,
        action:'start',zone,duration_minutes:duration,session_id:sessionId,started_at:startedAt,
        expected_end_at:expectedEndAt,state:runtimeResponse(verification.state),
        weather:weather.decision,profile:'IIC-800-DP45-SMARTLIFE'
      });
    }

    // Tanto "stop" como o antigo botão "voltar ao automático" encerram o
    // comando manual DP45. A agenda nativa DP38 permanece armazenada no IIC.
    const stopRaw=encodeDp45Stop(8);
    const sent=await sendInkbirdCommands({
      deviceId,
      commands:[{code:'irrigation_time_all',value:stopRaw}],
      priority:true
    });
    let verification=!dp45HasWatering(sent.statusMap.irrigation_time_all)
      ?{confirmed:true,state:sent}
      :await waitForWatering(deviceId,null,false,6);

    if(!verification.confirmed){
      return res.status(409).json({
        ok:false,sent:true,
        error:'O comando de parada foi enviado, mas o Smart Life ainda não confirmou todas as zonas desligadas.',
        device_id:deviceId,action,state:verification.state?runtimeResponse(verification.state):runtimeResponse(before)
      });
    }

    const activeSession=await getCafeActiveSession(deviceId).catch(()=>null);
    const sessionId=String(activeSession?.session_id||'').trim();
    await setCafeActiveSession(deviceId,null).catch(error=>console.error('Café active clear:',error?.message||error));
    await appendHistory({
      ...(sessionId?{event_id:(action==='auto'?'mode-':'stop-')+sessionId,session_id:sessionId}:{}),
      type:action==='auto'?'mode':'stop',
      controller_id:deviceId,controller_index:meta.controller_index,
      zone:Number.isInteger(zone)?zone:Number(activeSession?.zone||0),
      sector:meta.sector||Number(activeSession?.sector||0),
      mode:'Auto',source:'smartlife',status:'confirmed',
      detail:action==='auto'
        ?'Irrigação manual encerrada; programação automática mantida'
        :'Irrigação manual parada'
    }).catch(error=>console.error('Histórico Café stop:',error?.message||error));

    return res.status(200).json({
      ok:true,verified:true,provider:'smartlife',device_id:deviceId,
      action,zone:Number.isInteger(zone)?zone:null,stopped_at:Date.now(),
      state:{
        ...runtimeResponse(verification.state),
        operation_mode:'Auto',
        zonerun_state:0,pendingzone_state:0,active_mask:0,pending_mask:0
      }
    });
  }catch(error){
    return res.status(502).json({
      ok:false,error:error?.message||'Falha ao controlar o setor no IIC-800 pelo Smart Life.'
    });
  }
}
