import { applyCors, authorize } from '../_tuya.js';
import { readInkbirdState, sendInkbirdCommands } from './_transport.js';
import { encodeDp45Manual, dp45HasWatering } from './_iic800.js';
import { fetchWeatherSnapshot, decideWeather } from '../weather/_weather.js';
import { appendHistory, getAutomationConfig, storeGet, storePatch, storeSet } from '../irrigation/_store.js';

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

function normalizeZones(input){
  if(!Array.isArray(input)||!input.length)throw new Error('Selecione pelo menos um setor.');
  const out=input.map(item=>({
    zone:Number(item?.zone),
    duration_minutes:Math.round(Number(item?.duration_minutes||0))
  }));
  for(const item of out){
    if(!Number.isInteger(item.zone)||item.zone<1||item.zone>8)throw new Error('Setor inválido no grupo.');
    if(!Number.isInteger(item.duration_minutes)||item.duration_minutes<1||item.duration_minutes>1440){
      throw new Error('A duração dos setores deve ficar entre 1 e 1440 minutos.');
    }
  }
  if(new Set(out.map(x=>x.zone)).size!==out.length)throw new Error('O grupo contém setores duplicados.');
  return out;
}

async function serverWeather(){
  const cfg=await getAutomationConfig().catch(()=>({}));
  const policy=cfg?.weather||{enabled:true,rainThreshold:5,rainHoldHours:12,blockWhileRaining:true};
  const snapshot=await fetchWeatherSnapshot({maxAgeMs:5000}).catch(()=>null);
  const ws=(await storeGet('IrrigacaoFazenda2E/weatherState').catch(()=>null))||{};
  if(snapshot?.metrics?.rainDetected)ws.lastRainAt=Date.now();
  const decision=decideWeather(snapshot,policy,ws);
  await storePatch('IrrigacaoFazenda2E/weatherState',{
    lastRainAt:ws.lastRainAt||null,checkedAt:Date.now(),decision
  }).catch(()=>null);
  return{snapshot,decision};
}

async function waitForAnyRequested(deviceId,zones,attempts=7){
  let last=null;
  for(let i=0;i<attempts;i++){
    if(i)await sleep(650);
    try{
      last=await readInkbirdState({deviceId,force:true,maxAgeMs:0});
      if(zones.some(z=>dp45HasWatering(last.statusMap.irrigation_time_all,z.zone))){
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

  try{
    const requestedMode=req.body?.mode==='together'?'together':'order';
    if(requestedMode==='together'){
      return res.status(400).json({
        ok:false,
        error:'O IIC-800 trabalha uma zona por vez. Use o modo sequencial para grupos.'
      });
    }

    const zones=normalizeZones(req.body?.zones);
    const name=String(req.body?.name||'Grupo de setores').slice(0,80);
    const before=await readInkbirdState({
      deviceId:String(req.body?.device_id||'').trim(),
      force:true,maxAgeMs:0
    });
    if(before.online===false)return res.status(409).json({ok:false,error:'Controlador offline.'});

    const deviceId=before.deviceId;
    const devices=before.resolved.devices||[];
    const controllerIndex=Math.max(1,devices.findIndex(d=>d.id===deviceId)+1);
    const session=await storeGet(`IrrigacaoFazenda2E/active/${deviceId}`).catch(()=>null);
    if(dp45HasWatering(before.statusMap.irrigation_time_all)||(
      session&&Number(session.expected_end_at||0)>Date.now()-120000
    )){
      return res.status(409).json({
        ok:false,error:'Já existe uma irrigação ativa ou aguardando neste controlador.'
      });
    }

    const weather=await serverWeather();
    if(weather.decision?.blocked){
      await appendHistory({
        type:'group_blocked',controller_id:deviceId,controller_index:controllerIndex,
        source:'server_weather',status:'blocked',detail:name+': '+weather.decision.reason,
        weather:weather.decision
      }).catch(()=>null);
      return res.status(423).json({
        ok:false,blocked:true,error:'Grupo bloqueado pela proteção meteorológica.',
        weather:weather.decision
      });
    }

    if(before.statusMap.irrigation_mode!=='order'){
      await sendInkbirdCommands({
        deviceId,
        commands:[{code:'irrigation_mode',value:'order'}]
      });
      await sleep(300);
    }

    const durations=Object.fromEntries(zones.map(item=>[item.zone,item.duration_minutes]));
    const raw=encodeDp45Manual(durations,8);
    const sent=await sendInkbirdCommands({
      deviceId,
      commands:[{code:'irrigation_time_all',value:raw}]
    });
    let verification=zones.some(z=>dp45HasWatering(sent.statusMap.irrigation_time_all,z.zone))
      ?{confirmed:true,state:sent}
      :await waitForAnyRequested(deviceId,zones,7);

    if(!verification.confirmed){
      return res.status(409).json({
        ok:false,sent:true,
        error:'O grupo foi enviado, mas o Smart Life ainda não confirmou o início. Não repita o comando até atualizar.',
        state:verification.state?.runtime||null
      });
    }

    const startedAt=Date.now();
    const totalMinutes=zones.reduce((sum,x)=>sum+x.duration_minutes,0);
    const expectedEndAt=startedAt+totalMinutes*60000;
    const activeSession={
      kind:'group',name,zones,mode:'order',controller_index:controllerIndex,
      duration_minutes:totalMinutes,started_at:startedAt,expected_end_at:expectedEndAt,
      source:'smartlife'
    };
    await storeSet(`IrrigacaoFazenda2E/active/${deviceId}`,activeSession).catch(()=>null);
    await appendHistory({
      type:'group_start',controller_id:deviceId,controller_index:controllerIndex,
      duration_minutes:totalMinutes,mode:'order',source:'smartlife',status:'confirmed',
      detail:name,weather:weather.decision,zones
    }).catch(()=>null);

    return res.status(200).json({
      ok:true,verified:true,provider:'smartlife',device_id:deviceId,
      controller_index:controllerIndex,name,mode:'order',zones,
      started_at:startedAt,expected_end_at:expectedEndAt,
      state:verification.state?.runtime||null
    });
  }catch(error){
    return res.status(502).json({
      ok:false,error:error?.message||'Falha ao iniciar grupo pelo Smart Life.'
    });
  }
}
