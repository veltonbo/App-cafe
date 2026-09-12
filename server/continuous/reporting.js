const TZ='America/Porto_Velho';
const localFormatter1=new Intl.DateTimeFormat('en-CA',{
    timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'
  });
const localFormatter2=new Intl.DateTimeFormat('pt-BR',{
    timeZone:'UTC',weekday:'short',day:'2-digit',month:'2-digit'
  });
import { pulseAccountingForDay } from './accounting.js';


export function viveiroDayKey(ts=Date.now()){
  return localFormatter1.format(new Date(Number(ts)||Date.now()));
}

function dayLabel(key){
  const [y,m,d]=String(key).split('-').map(Number);
  return localFormatter2.format(new Date(Date.UTC(y,m-1,d,12)));
}

export function normalizeIncidents(raw){
  if(!raw||typeof raw!=='object')return[];
  return Object.entries(raw)
    .map(([id,value])=>({id,...(value||{})}))
    .sort((a,b)=>Number(b.opened_at||0)-Number(a.opened_at||0));
}

function rowTs(row){return Number(row?.ts||Date.parse(row?.at||0)||0)}
function eventIdentity(row,prefix='row'){
  const pulse=String(row?.pulse_id||'').trim();
  if(pulse)return'pulse:'+pulse;
  const event=String(row?.event_id||row?.id||'').trim();
  if(event)return'event:'+event;
  return prefix+':'+rowTs(row)+':'+String(row?.type||'');
}
function minOrNull(values){return values.length?Math.min(...values):null}
function maxOrNull(values){return values.length?Math.max(...values):null}
function avgOrNull(values){return values.length?values.reduce((a,b)=>a+b,0)/values.length:null}

function emptyBucket(){
  return{
    starts:new Map(),
    finals:new Map(),
    rain_pauses:0,
    errors:0,
    auto_adjustments:0,
    target_off:[],
    temperatures:[],
    humidities:[],
    vpds:[],
    interrupted_events:0
  };
}

function bucketFor(map,key){
  let bucket=map.get(key);
  if(!bucket){bucket=emptyBucket();map.set(key,bucket)}
  return bucket;
}

function groupThirtyDays(history,now){
  const cutoff=now-32*86400000;
  const recent=(Array.isArray(history)?history:[]).filter(row=>rowTs(row)>=cutoff);
  const pulseStartDays=new Map();

  for(const row of recent){
    if(String(row?.type||'')!=='viveiro_pulse_start')continue;
    const pulse=String(row?.pulse_id||'').trim();
    if(pulse&&!pulseStartDays.has(pulse))pulseStartDays.set(pulse,viveiroDayKey(rowTs(row)));
  }

  const buckets=new Map();
  for(const row of recent){
    const type=String(row?.type||'');
    const ts=rowTs(row);
    const pulse=String(row?.pulse_id||'').trim();
    const key=(pulse&&pulseStartDays.get(pulse))||viveiroDayKey(ts);
    const bucket=bucketFor(buckets,key);

    if(type==='viveiro_pulse_start'){
      const id=eventIdentity(row,'start');
      const prev=bucket.starts.get(id);
      if(!prev||ts<rowTs(prev))bucket.starts.set(id,row);
    }

    if(type==='viveiro_pulse_complete'||type==='viveiro_pulse_interrupted'){
      const id=eventIdentity(row,'final');
      const prev=bucket.finals.get(id);
      if(!prev||ts>=rowTs(prev))bucket.finals.set(id,row);
    }

    if(type==='viveiro_weather_pause'||type==='viveiro_rain_pause')bucket.rain_pauses+=1;
    if(type.includes('error'))bucket.errors+=1;
    if(type==='viveiro_pulse_interrupted')bucket.interrupted_events+=1;

    if(['viveiro_climate_auto_change','viveiro_climate_return_base','viveiro_climate_applied'].includes(type)){
      bucket.auto_adjustments+=1;
      const off=Number(row?.to_off_seconds);
      if(Number.isFinite(off))bucket.target_off.push(off);
    }

    const t=Number(row?.temperature),h=Number(row?.humidity),v=Number(row?.vpd);
    if(Number.isFinite(t))bucket.temperatures.push(t);
    if(Number.isFinite(h))bucket.humidities.push(h);
    if(Number.isFinite(v))bucket.vpds.push(v);
  }
  return buckets;
}

function incidentsForDay(incidents,key){
  return incidents.filter(incident=>{
    const opened=Number(incident.opened_at||0);
    const resolved=Number(incident.resolved_at||0);
    return(opened&&viveiroDayKey(opened)===key)||(resolved&&viveiroDayKey(resolved)===key);
  });
}

function statusForDay(bucket,incidents,audit,isToday){
  const open=incidents.filter(x=>x.status==='open');
  if(isToday){
    if(String(audit?.status||'')==='critical')return'critical';
    if(open.some(x=>x.level==='critical'))return'critical';
    if(Number(bucket?.errors||0)>0)return'critical';
    if(String(audit?.status||'')==='warning')return'warning';
    if(open.length||Number(bucket?.interrupted_events||0)>0)return'warning';
    return'normal';
  }
  if(incidents.some(x=>x.level==='critical')||Number(bucket?.errors||0)>0)return'critical';
  if(incidents.length||Number(bucket?.interrupted_events||0)>0)return'warning';
  return'normal';
}

export function buildViveiroReports(history=[],incidentsRaw={},seconds={},audit=null,now=Date.now()){
  const incidents=normalizeIncidents(incidentsRaw);
  const todayKey=viveiroDayKey(now);
  const buckets=groupThirtyDays(history,now);
  const trend30=[];

  for(let offset=29;offset>=0;offset--){
    const key=viveiroDayKey(now-offset*86400000);
    const b=buckets.get(key)||emptyBucket();
    const accounting=pulseAccountingForDay(history,key);
    const dayIncidents=incidentsForDay(incidents,key);

    trend30.push({
      key,
      label:dayLabel(key),
      status:statusForDay(b,dayIncidents,audit,key===todayKey),
      // Para relatório histórico, pulso contabilizado é o que possui desfecho
      // confirmado. Starts sem fechamento ficam separados como inconsistência.
      pulses:Number(accounting.pulses_confirmed||0),
      start_attempts:Number(accounting.raw_pulses_started??b.starts.size),
      orphaned_starts:Number(accounting.orphaned_starts||0),
      completed:Number(accounting.pulses_completed||0),
      interrupted:Number(accounting.pulses_interrupted||0),
      irrigated_seconds:Number(accounting.irrigated_seconds||0),
      history_quality:String(accounting.history_quality||'event_level'),
      history_confidence:String(accounting.history_confidence||'high'),
      rain_pauses:b.rain_pauses,
      errors:b.errors,
      auto_adjustments:b.auto_adjustments,
      avg_adjusted_off_seconds:avgOrNull(b.target_off),
      incidents:dayIncidents.length,
      critical_incidents:dayIncidents.filter(x=>x.level==='critical').length,
      climate:{
        temperature_min:minOrNull(b.temperatures),
        temperature_max:maxOrNull(b.temperatures),
        temperature_avg:avgOrNull(b.temperatures),
        humidity_min:minOrNull(b.humidities),
        humidity_max:maxOrNull(b.humidities),
        humidity_avg:avgOrNull(b.humidities),
        vpd_min:minOrNull(b.vpds),
        vpd_max:maxOrNull(b.vpds),
        vpd_avg:avgOrNull(b.vpds),
        samples:Math.max(b.temperatures.length,b.humidities.length,b.vpds.length)
      }
    });
  }

  const today=trend30.at(-1)||{};
  const open=incidents.filter(x=>x.status==='open');

  return{
    generated_at:now,
    status_today:today.status||'normal',
    today:{
      ...today,
      cycle_base:{
        on_seconds:Number(seconds?.base_on_seconds||seconds?.on_seconds||0),
        off_seconds:Number(seconds?.base_off_seconds||seconds?.off_seconds||0)
      },
      cycle_current:{
        on_seconds:Number(seconds?.on_seconds||0),
        off_seconds:Number(seconds?.off_seconds||0)
      }
    },
    trend7:trend30.slice(-7),
    trend30,
    incidents:{
      open,
      recent:incidents.slice(0,30),
      totals:{
        open:open.length,
        open_critical:open.filter(x=>x.level==='critical').length,
        last_30_days:incidents.filter(x=>now-Number(x.opened_at||0)<=30*86400000).length,
        resolved_automatic:incidents.filter(x=>x.status==='resolved'&&x.resolution==='automatico'&&now-Number(x.resolved_at||0)<=30*86400000).length,
        resolved_intervention:incidents.filter(x=>x.status==='resolved'&&x.resolution==='intervencao'&&now-Number(x.resolved_at||0)<=30*86400000).length
      }
    }
  };
}
