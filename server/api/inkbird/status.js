import { applyCors, authorize } from '../_tuya.js';
import { readInkbirdState } from './_transport.js';
import { decodeNormalTimer } from './_iic800.js';
import { appendHistory } from '../irrigation/_store.js';
import { getCafeActiveSession, setCafeActiveSession } from '../cafe/_state.js';

function activeMaskFromSession(session){
  if(!session)return 0;
  if(session.kind==='group'&&Array.isArray(session.zones)){
    return session.zones.reduce((mask,item)=>{
      const zone=Number(item?.zone);
      return zone>=1&&zone<=8?mask|(1<<(zone-1)):mask;
    },0);
  }
  const zone=Number(session.zone||0);
  return zone>=1&&zone<=8?(1<<(zone-1)):0;
}

function mappingFrom(state,activeSession){
  const dp45=state.runtime.dp45||{};
  let activeMask=Number(state.runtime.active_mask||0);
  let pendingMask=Number(state.runtime.pending_mask||0);
  const startedAt=Number(activeSession?.started_at||0);
  if(activeSession&&!activeMask&&!pendingMask&&startedAt&&Date.now()-startedAt<5000){
    pendingMask=activeMaskFromSession(activeSession);
  }
  const effectiveMask=activeMask||pendingMask;
  const controls=Array.from({length:8},(_,i)=>({
    zone:i+1,
    code:'irrigation_time_all',
    name:'Zona '+(i+1)+' • DP45',
    current:Boolean(effectiveMask&(1<<i)),
    native_raw:true
  }));
  const durations=Array.from({length:8},(_,i)=>({
    zone:i+1,
    code:'irrigation_time_all',
    name:'Duração da zona '+(i+1)+' • DP45',
    current:Number(dp45?.duration?.[i+1]||0)||null,
    min:1,max:1440,step:1,scale:0,unit:'min',native_raw:true
  }));
  return{
    native_profile:'IIC-800-DP45-SMARTLIFE',
    native_dp45:true,
    provider:'smartlife',
    active_mask:activeMask,
    pending_mask:pendingMask,
    operation_mode:(activeMask||pendingMask)?'Manual':'Auto',
    irrigation_mode:state.statusMap.irrigation_mode??null,
    controls,
    durations,
    schedule_candidates:[{
      code:'normal_timer',
      name:'Programação por zona • DP38',
      type:'String',
      values:{maxlen:255}
    }],
    zones_found:[1,2,3,4,5,6,7,8],
    mapped_count:8,
    duration_mapped_count:8,
    ready:true,
    control_ready:true,
    duration_ready:true
  };
}

async function maybeCompleteSession(deviceId,controllerIndex,session,mapping){
  if(!session)return null;
  const startedAt=Number(session.started_at||0);
  const hasRuntime=Number(mapping.active_mask||0)!==0||Number(mapping.pending_mask||0)!==0;
  if(hasRuntime||!startedAt||Date.now()-startedAt<5000)return session;

  await setCafeActiveSession(deviceId,null).catch(error=>console.error('Café active complete:',error?.message||error));
  const sessionId=String(session.session_id||'').trim();
  await appendHistory({
    ...(sessionId?{event_id:'complete-'+sessionId,session_id:sessionId}:{}),
    type:'complete',
    controller_id:deviceId,
    controller_index:controllerIndex,
    zone:Number(session.zone||0),
    sector:Number(session.sector||0),
    duration_minutes:Number(session.duration_minutes||0),
    mode:session.mode||'Manual',
    source:'smartlife',
    status:'confirmed',
    detail:session.kind==='group'?(session.name||'Grupo concluído'):'Irrigação concluída',
    zones:Array.isArray(session.zones)?session.zones:undefined,
    started_at:Number(session.started_at||0)||null,
    expected_end_at:Number(session.expected_end_at||0)||null,
    completed_at:Date.now()
  }).catch(error=>console.error('Histórico Café complete:',error?.message||error));
  return null;
}

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'Método não permitido.'});
  if(!authorize(req,res))return;

  try{
    const preferredId=String(req.query?.device_id||'').trim();
    const state=await readInkbirdState({deviceId:preferredId,force:true,maxAgeMs:0});
    const deviceId=state.deviceId;
    const devices=state.resolved.devices||[];
    const controllerIndex=Math.max(1,devices.findIndex(d=>d.id===deviceId)+1);
    const sectorStart=(controllerIndex-1)*8+1;
    let activeSession=await getCafeActiveSession(deviceId);
    const mapping=mappingFrom(state,activeSession);
    activeSession=await maybeCompleteSession(deviceId,controllerIndex,activeSession,mapping);

    const runtime={
      dp45:state.runtime.dp45,
      schedule:decodeNormalTimer(state.statusMap.normal_timer),
      history:null,
      active_session:activeSession
    };

    return res.status(200).json({
      ok:true,
      configured:true,
      linked:true,
      provider:'smartlife',
      model:'IIC-800-WIFI',
      zones:8,
      controller_index:controllerIndex,
      sector_start:sectorStart,
      sector_end:sectorStart+7,
      access:{
        state:'accessible',
        title:'Acesso remoto disponível',
        detail:'O IIC-800 está conectado pelo Smart Life Device Sharing.'
      },
      mapping,
      runtime,
      discovery_source:state.resolved.source,
      device:{
        id:deviceId,
        name:state.device?.name||'IIC-800-WIFI',
        online:state.online,
        category:state.device?.category||null,
        product_id:state.device?.product_id||null
      },
      functions:state.functions,
      status_spec:state.statusSpec,
      status:{
        ...state.statusMap,
        zonerun_state:mapping.active_mask,
        pendingzone_state:mapping.pending_mask,
        operation_mode:mapping.operation_mode
      },
      shadow:{},
      candidates:devices.map((d,index)=>({
        id:d.id,name:d.name,online:d.online,category:d.category,model:d.model,
        controller_index:index+1,sector_start:index*8+1,sector_end:index*8+8
      })),
      errors:{}
    });
  }catch(error){
    return res.status(502).json({
      ok:false,
      linked:false,
      provider:'smartlife',
      error:error?.message||'Falha ao consultar IIC-800 pelo Smart Life.'
    });
  }
}
