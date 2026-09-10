import { applyCors, authorize } from '../api/_tuya.js';
import { listInkbirdDevices } from '../api/inkbird/_device.js';
import { readInkbirdState } from '../api/inkbird/_transport.js';
import { fetchWeatherSnapshot } from '../api/weather/_weather.js';
import { appendHistory, getAutomationConfig, storeGet } from '../api/irrigation/_store.js';
import { CAFE_ROOT, getCafeActiveSession, setCafeActiveSession, getCafeWeatherState, getCafeScheduleCache } from './state.js';
import { buildSectorActivity, getCafeAuditState } from './audit.js';
import { buildCafeReports } from './reporting.js';

const TZ='America/Porto_Velho';

function rows(raw){
  if(!raw||typeof raw!=='object')return[];
  return Object.entries(raw)
    .map(([id,value])=>({id,...(value||{})}))
    .filter(row=>String(row.app||'cafe')==='cafe')
    .sort((a,b)=>Number(b.ts||0)-Number(a.ts||0));
}
function dayKey(ts=Date.now()){
  return new Intl.DateTimeFormat('en-CA',{
    timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'
  }).format(new Date(Number(ts)||Date.now()));
}
function dayLabel(key){
  const [y,m,d]=String(key).split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR',{
    timeZone:'UTC',weekday:'short',day:'2-digit'
  }).format(new Date(Date.UTC(y,m-1,d,12)));
}
function eventIdentity(row,index=0){
  return String(row.session_id||row.event_id||row.id||[
    row.type,row.controller_id,row.zone,row.sector,row.ts,index
  ].join('|'));
}
function uniqueBy(rowsInput,keyFn){
  const out=[];
  const seen=new Set();
  rowsInput.forEach((row,index)=>{
    const key=String(keyFn(row,index));
    if(seen.has(key))return;
    seen.add(key);
    out.push(row);
  });
  return out;
}
function sessionStarts(history){
  return uniqueBy(
    history.filter(row=>['start','group_start','auto_start'].includes(String(row.type||''))),
    eventIdentity
  );
}
function sessionCompletes(history){
  return uniqueBy(
    history.filter(row=>['complete','auto_complete'].includes(String(row.type||''))),
    eventIdentity
  );
}
function sectorsFromStart(row){
  const out=[];
  if(Number(row.sector)>0)out.push(Number(row.sector));
  if(Array.isArray(row.zones)){
    const controllerIndex=Math.max(1,Number(row.controller_index||1));
    for(const item of row.zones){
      const zone=Number(item?.zone);
      if(zone>=1&&zone<=8)out.push((controllerIndex-1)*8+zone);
    }
  }
  return [...new Set(out)];
}
export function summarizeCafeHistory(history,now=Date.now()){
  const today=dayKey(now);
  const days=[];
  for(let offset=6;offset>=0;offset--){
    const key=dayKey(now-offset*86400000);
    const dayRows=history.filter(row=>dayKey(row.ts||Date.parse(row.at||0))===key);
    const starts=sessionStarts(dayRows);
    const completes=sessionCompletes(dayRows);
    const sectors=[...new Set(starts.flatMap(sectorsFromStart))];
    const completedMinutes=completes.reduce((sum,row)=>sum+Math.max(0,Number(row.actual_duration_minutes??row.duration_minutes||0)),0);
    days.push({
      key,label:dayLabel(key),
      sessions:starts.length,
      completed:completes.length,
      sectors:sectors.length,
      completed_minutes:completedMinutes,
      blocked:dayRows.filter(row=>String(row.type||'').includes('blocked')).length,
      errors:dayRows.filter(row=>String(row.status||'').includes('error')||String(row.type||'').includes('error')).length
    });
  }
  const todayRows=history.filter(row=>dayKey(row.ts||Date.parse(row.at||0))===today);
  const starts=sessionStarts(todayRows);
  const completes=sessionCompletes(todayRows);
  const sectors=[...new Set(starts.flatMap(sectorsFromStart))];
  return{
    today:{
      sessions:starts.length,
      completed:completes.length,
      sectors:sectors.length,
      completed_minutes:completes.reduce((sum,row)=>sum+Math.max(0,Number(row.actual_duration_minutes??row.duration_minutes||0)),0),
      blocked:todayRows.filter(row=>String(row.type||'').includes('blocked')).length,
      errors:todayRows.filter(row=>String(row.status||'').includes('error')||String(row.type||'').includes('error')).length,
      last_event_at:Number(todayRows[0]?.ts||0)||null
    },
    week:days,
    week_totals:{
      sessions:days.reduce((sum,row)=>sum+row.sessions,0),
      completed:days.reduce((sum,row)=>sum+row.completed,0),
      sectors:days.reduce((sum,row)=>sum+row.sectors,0),
      completed_minutes:days.reduce((sum,row)=>sum+row.completed_minutes,0),
      blocked:days.reduce((sum,row)=>sum+row.blocked,0),
      errors:days.reduce((sum,row)=>sum+row.errors,0)
    }
  };
}

function localParts(ts=Date.now()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
    timeZone:TZ,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(new Date(ts)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  const dayMap={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  return{weekday:dayMap[parts.weekday]??0,minutes:Number(parts.hour)*60+Number(parts.minute)};
}
function nextSchedule(scheduleByDevice,controllers,now=Date.now()){
  const local=localParts(now);
  let best=null;
  for(const controller of controllers){
    const cache=scheduleByDevice[controller.id]||{};
    for(const [zoneKey,ch] of Object.entries(cache)){
      const zone=Number(zoneKey);
      if(ch?.enabled===false||!Array.isArray(ch?.start_times)||!ch.start_times.length)continue;
      if(Number(ch.cycle_mode||0)!==0)continue;
      const mask=Math.max(0,Number(ch.days_mask??127));
      for(let add=0;add<8;add++){
        const dow=(local.weekday+add)%7;
        if(!(mask&(1<<dow)))continue;
        for(const time of ch.start_times){
          const match=String(typeof time==='string'?time:time?.value||'').match(/^(\d{2}):(\d{2})$/);
          if(!match)continue;
          const mins=Number(match[1])*60+Number(match[2]);
          if(add===0&&mins<=local.minutes)continue;
          const score=add*1440+mins-local.minutes;
          const candidate={
            controller_id:controller.id,
            controller_index:Number(controller.controller_index||1),
            zone,
            sector:Number(controller.sector_start||1)+zone-1,
            day_offset:add,
            time:String(time),
            duration_minutes:Number(ch.duration_minutes||0),
            score
          };
          if(!best||candidate.score<best.score)best=candidate;
        }
      }
    }
  }
  if(best)delete best.score;
  return best;
}

async function completeFinishedSession(deviceId,controllerIndex,state,session){
  if(!session||!state)return{session,completed:false};
  const startedAt=Number(session.started_at||0);
  const activeMask=Number(state.runtime?.active_mask||0);
  const pendingMask=Number(state.runtime?.pending_mask||0);
  if(activeMask||pendingMask||!startedAt||Date.now()-startedAt<5000){
    return{session,completed:false};
  }

  const sessionId=String(session.session_id||'').trim();
  await setCafeActiveSession(deviceId,null).catch(error=>
    console.error('Café dashboard active complete:',error?.message||error)
  );
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
    started_at:startedAt,
    expected_end_at:Number(session.expected_end_at||0)||null,
    completed_at:Date.now()
  }).catch(error=>console.error('Histórico Café complete dashboard:',error?.message||error));
  return{session:null,completed:true};
}

function runtimeFrom(state,activeSession){
  if(!state)return null;
  let activeMask=Number(state.runtime?.active_mask||0);
  let pendingMask=Number(state.runtime?.pending_mask||0);
  if(activeSession&&!activeMask&&!pendingMask&&Date.now()-Number(activeSession.started_at||0)<5000){
    if(activeSession.kind==='group'&&Array.isArray(activeSession.zones)){
      pendingMask=activeSession.zones.reduce((mask,item)=>{
        const z=Number(item?.zone);
        return z>=1&&z<=8?mask|(1<<(z-1)):mask;
      },0);
    }else{
      const z=Number(activeSession.zone||0);
      if(z>=1&&z<=8)pendingMask=1<<(z-1);
    }
  }
  return{
    active_mask:activeMask,
    pending_mask:pendingMask,
    operation_mode:(activeMask||pendingMask)?'Manual':'Auto',
    irrigation_mode:state.statusMap?.irrigation_mode??null,
    dp45:state.runtime?.dp45||null
  };
}

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'Método não permitido.'});
  if(!authorize(req,res))return;

  try{
    const devices=await listInkbirdDevices();
    const controllers=devices.map((device,index)=>({
      id:device.id,
      name:device.name||`INKBIRD ${index+1}`,
      model:device.model||'IIC-800-WIFI',
      online:device.online!==false,
      controller_index:index+1,
      sector_start:index*8+1,
      sector_end:index*8+8
    }));
    const preferred=String(req.query?.device_id||'').trim();
    const selected=controllers.find(c=>c.id===preferred)||controllers[0]||null;

    const historyRawPromise=storeGet(CAFE_ROOT+'/history').catch(()=>null);
    const configPromise=getAutomationConfig().catch(()=>({}));
    const weatherPromise=fetchWeatherSnapshot({maxAgeMs:4000}).catch(error=>({linked:false,error:error?.message||String(error)}));
    const weatherStatePromise=getCafeWeatherState().catch(()=>({}));
    const auditPromise=getCafeAuditState().catch(()=>null);
    const incidentsPromise=storeGet(CAFE_ROOT+'/incidents').catch(()=>null);
    const schedulePromises=controllers.map(async controller=>[
      controller.id,
      await getCafeScheduleCache(controller.id)
    ]);

    let inkbirdState=null;
    let activeSession=null;
    let sessionCompleted=false;
    if(selected){
      [inkbirdState,activeSession]=await Promise.all([
        readInkbirdState({deviceId:selected.id,force:true,maxAgeMs:0}).catch(()=>null),
        getCafeActiveSession(selected.id).catch(()=>null)
      ]);
      const completion=await completeFinishedSession(
        selected.id,
        Number(selected.controller_index||1),
        inkbirdState,
        activeSession
      );
      activeSession=completion.session;
      sessionCompleted=completion.completed;
    }

    let [historyRaw,config,weather,weatherState,audit,incidentsRaw,scheduleEntries]=await Promise.all([
      historyRawPromise,configPromise,weatherPromise,weatherStatePromise,auditPromise,incidentsPromise,Promise.all(schedulePromises)
    ]);
    if(sessionCompleted){
      historyRaw=await storeGet(CAFE_ROOT+'/history').catch(()=>historyRaw);
    }
    const history=rows(historyRaw);
    const scheduleByDevice=Object.fromEntries(scheduleEntries);
    const summary=summarizeCafeHistory(history);
    const sectorActivity=buildSectorActivity(history,controllers);
    const reports=buildCafeReports(history,incidentsRaw||{},controllers,audit||null);

    return res.status(200).json({
      ok:true,
      app:'cafe',
      isolated:true,
      server:{online:true,at:Date.now()},
      controllers,
      selected_controller:selected,
      runtime:runtimeFrom(inkbirdState,activeSession),
      active_session:activeSession||null,
      weather,
      weather_state:weatherState||{},
      config:config||{},
      summary,
      reports,
      audit:audit||{status:'checking',checked_at:null,issues:[],message:'Auditoria aguardando a primeira verificação.'},
      sector_activity:sectorActivity,
      next_schedule:nextSchedule(scheduleByDevice,controllers),
      recent_history:history.slice(0,80)
    });
  }catch(error){
    return res.status(502).json({
      ok:false,
      app:'cafe',
      error:error?.message||'Falha ao montar o painel do Café.'
    });
  }
}
