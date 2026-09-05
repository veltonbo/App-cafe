import { applyCors, authorize, ensureCloudConfig, getDeviceId, tuyaRequest } from '../_tuya.js';
import { decodeCycle } from '../_cycle.js';
import { listInkbirdDevices } from '../inkbird/_device.js';
import { fetchWeatherSnapshot } from '../weather/_weather.js';
import { getViveiroWeatherConfig, getViveiroWeatherState } from '../viveiro/_weather_logic.js';
import { getAutomationConfig, storeGet } from './_store.js';

const TZ='America/Porto_Velho';

function normalizeStatus(result){
  if(Array.isArray(result))return result;
  if(Array.isArray(result?.status))return result.status;
  if(Array.isArray(result?.result))return result.result;
  return [];
}
function mapStatus(result){
  return Object.fromEntries(normalizeStatus(result).map(x=>[x.code,x.value]));
}
function localDateKey(value=Date.now()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
    timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(new Date(value)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function historyArray(raw){
  if(!raw||typeof raw!=='object')return[];
  return Object.entries(raw).map(([id,v])=>({id,...(v||{})}))
    .sort((a,b)=>Number(b.ts||0)-Number(a.ts||0));
}
function flowFor(config,controllerId,zone){
  return Math.max(0,Number(config?.waterFlow?.[controllerId]?.[zone]||0));
}
function sectorFrom(controllerIndex,zone){
  return (Math.max(1,Number(controllerIndex||1))-1)*8+Math.max(1,Number(zone||1));
}
function volumeEvents(history,config){
  const out=[];
  for(const h of history){
    if(h.type==='start'&&Number(h.duration_minutes)>0&&h.controller_id&&Number(h.zone)>0){
      const flow=flowFor(config,h.controller_id,Number(h.zone));
      out.push({
        id:h.id,type:'manual',ts:Number(h.ts||0),controller_id:h.controller_id,zone:Number(h.zone),
        sector:Number(h.sector||sectorFrom(h.controller_index,h.zone)),minutes:Number(h.duration_minutes),
        flow_lpm:flow,liters:flow*Number(h.duration_minutes)
      });
      continue;
    }
    if(h.type==='group_start'&&h.controller_id&&Array.isArray(h.zones)){
      for(const z of h.zones){
        const zone=Number(z.zone),minutes=Number(z.duration_minutes||0);
        if(!zone||minutes<=0)continue;
        const flow=flowFor(config,h.controller_id,zone);
        out.push({
          id:h.id+':'+zone,type:'group',ts:Number(h.ts||0),controller_id:h.controller_id,zone,
          sector:sectorFrom(h.controller_index,zone),minutes,flow_lpm:flow,liters:flow*minutes
        });
      }
      continue;
    }
    if(h.type==='native_report'&&String(h.mode||'').toLowerCase()!=='manual'&&h.controller_id&&Number(h.zone)>0&&Number(h.duration_minutes)>0){
      const zone=Number(h.zone),minutes=Number(h.duration_minutes),flow=flowFor(config,h.controller_id,zone);
      out.push({
        id:h.id,type:'automatic',ts:Number(h.ts||0),controller_id:h.controller_id,zone,
        sector:Number(h.sector||sectorFrom(h.controller_index,zone)),minutes,flow_lpm:flow,liters:flow*minutes
      });
    }
  }
  return out;
}
function waterSummary(events){
  const today=localDateKey();
  const todayEvents=events.filter(e=>localDateKey(e.ts)===today);
  const bySector={};
  for(const e of events){
    const key=String(e.sector);
    if(!bySector[key])bySector[key]={sector:e.sector,liters:0,minutes:0,events:0,flow_lpm:e.flow_lpm};
    bySector[key].liters+=e.liters;
    bySector[key].minutes+=e.minutes;
    bySector[key].events+=1;
    if(e.flow_lpm)bySector[key].flow_lpm=e.flow_lpm;
  }
  return{
    today_liters:todayEvents.reduce((s,e)=>s+e.liters,0),
    total_liters:events.reduce((s,e)=>s+e.liters,0),
    today_events:todayEvents.length,
    by_sector:Object.values(bySector).sort((a,b)=>a.sector-b.sector),
    recent:events.slice(0,40)
  };
}
async function readViveiro(){
  try{
    const id=getDeviceId();
    const r=await tuyaRequest('GET',`/v1.0/iot-03/devices/${id}/status`);
    const m=mapStatus(r);
    let cycleRaw=typeof m.cycle_time==='string'?m.cycle_time:null;
    try{
      const sh=await tuyaRequest('GET',`/v2.0/cloud/thing/${id}/shadow/properties`);
      const sm=Object.fromEntries((Array.isArray(sh?.properties)?sh.properties:[]).map(x=>[x.code,x.value]));
      if(typeof sm.cycle_time==='string')cycleRaw=sm.cycle_time;
    }catch{}
    return{
      ok:true,online:true,relay:typeof m.switch_1==='boolean'?m.switch_1:null,
      cycle_config:decodeCycle(cycleRaw),
      weather_state:await getViveiroWeatherState(),
      weather_config:await getViveiroWeatherConfig()
    };
  }catch(error){
    return{ok:false,online:false,error:error?.message||String(error),weather_state:await getViveiroWeatherState().catch(()=>({}))};
  }
}
async function readController(ctrl,index){
  try{
    const r=await tuyaRequest('GET',`/v1.0/iot-03/devices/${ctrl.id}/status`);
    const m=mapStatus(r);
    const activeMask=Number(m.zonerun_state||0);
    const pendingMask=Number(m.pendingzone_state||0);
    const activeZones=[1,2,3,4,5,6,7,8].filter(z=>activeMask&(1<<(z-1)));
    const pendingZones=[1,2,3,4,5,6,7,8].filter(z=>pendingMask&(1<<(z-1)));
    const session=await storeGet(`IrrigacaoFazenda2E/active/${ctrl.id}`).catch(()=>null);
    return{
      id:ctrl.id,name:ctrl.name,controller_index:index+1,sector_start:index*8+1,sector_end:index*8+8,
      online:ctrl.online!==false,operation_mode:m.operation_mode??null,irrigation_mode:m.irrigation_mode??null,
      active_mask:activeMask,pending_mask:pendingMask,active_zones:activeZones,pending_zones:pendingZones,session
    };
  }catch(error){
    return{
      id:ctrl.id,name:ctrl.name,controller_index:index+1,sector_start:index*8+1,sector_end:index*8+8,
      online:false,error:error?.message||String(error),active_mask:0,pending_mask:0,active_zones:[],pending_zones:[]
    };
  }
}
function buildAlerts({weather,viveiro,controllers,config}){
  const alerts=[];
  const prefs={weather:true,offline:true,overdue:true,irrigation:true,...(config?.alerts||{})};
  if(prefs.weather&&weather?.metrics?.rainDetected){
    alerts.push({key:'weather-rain',level:'warning',title:'Chuva detectada',body:'A Weather2-2 está detectando chuva neste momento.',url:'/irrigacao/central/'});
  }
  if(prefs.weather&&['paused_rain','waiting_resume_delay','paused_waiting_weather'].includes(String(viveiro?.weather_state?.status||''))){
    alerts.push({key:'viveiro-weather',level:'warning',title:'Viveiro protegido pela chuva',body:String(viveiro.weather_state.status)==='waiting_resume_delay'?'Aguardando o tempo para retomar.':'Irrigação do viveiro pausada automaticamente.',url:'/irrigacao/'});
  }
  if(prefs.offline){
    for(const c of controllers){
      if(c.online===false)alerts.push({key:'offline-'+c.id,level:'critical',title:'Controlador offline',body:`Controlador ${c.controller_index} (Setores ${String(c.sector_start).padStart(2,'0')}–${String(c.sector_end).padStart(2,'0')}) está offline.`,url:'/irrigacao/inkbird/'});
    }
    if(viveiro?.online===false)alerts.push({key:'viveiro-offline',level:'critical',title:'Viveiro offline',body:'O EKAZA do viveiro não respondeu à última verificação.',url:'/irrigacao/'});
  }
  if(prefs.overdue){
    const now=Date.now();
    for(const c of controllers){
      const end=Number(c.session?.expected_end_at||0);
      if(end&&now>end+120000&&c.active_mask){
        alerts.push({key:'overdue-'+c.id,level:'critical',title:'Irrigação passou do tempo previsto',body:`Controlador ${c.controller_index} ainda indica setor ativo após o horário esperado.`,url:'/irrigacao/inkbird/'});
      }
    }
  }
  return alerts;
}

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'Método não permitido.'});
  if(!authorize(req,res)||!ensureCloudConfig(res))return;
  try{
    const [weather,inkbirds,viveiro,config,historyRaw]=await Promise.all([
      fetchWeatherSnapshot().catch(e=>({ok:false,linked:false,error:e?.message||String(e)})),
      listInkbirdDevices(),
      readViveiro(),
      getAutomationConfig().catch(()=>({})),
      storeGet('IrrigacaoFazenda2E/history').catch(()=>null)
    ]);
    const controllers=await Promise.all(inkbirds.map((c,i)=>readController(c,i)));
    const allHistory=historyArray(historyRaw);
    const volume=waterSummary(volumeEvents(allHistory,config));
    const alerts=buildAlerts({weather,viveiro,controllers,config});
    return res.status(200).json({
      ok:true,checked_at:Date.now(),weather,viveiro,controllers,config,history:allHistory.slice(0,80),volume,alerts
    });
  }catch(error){
    return res.status(502).json({ok:false,error:error?.message||'Falha ao montar a Central Fazenda 2E.'});
  }
}
