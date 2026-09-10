import { pulseAccountingForDay } from './accounting.js';

const TZ='America/Porto_Velho';

export function viveiroDayKey(ts=Date.now()){
  return new Intl.DateTimeFormat('en-CA',{
    timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'
  }).format(new Date(Number(ts)||Date.now()));
}

function dayLabel(key){
  const [y,m,d]=String(key).split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR',{
    timeZone:'UTC',weekday:'short',day:'2-digit',month:'2-digit'
  }).format(new Date(Date.UTC(y,m-1,d,12)));
}

export function normalizeIncidents(raw){
  if(!raw||typeof raw!=='object')return[];
  return Object.entries(raw)
    .map(([id,value])=>({id,...(value||{})}))
    .sort((a,b)=>Number(b.opened_at||0)-Number(a.opened_at||0));
}

function numericValues(rows,key){
  return rows.map(row=>Number(row?.[key])).filter(Number.isFinite);
}
function minOrNull(values){return values.length?Math.min(...values):null}
function maxOrNull(values){return values.length?Math.max(...values):null}
function avgOrNull(values){return values.length?values.reduce((a,b)=>a+b,0)/values.length:null}

function dayRows(history,key){
  return history.filter(row=>viveiroDayKey(row.ts||Date.parse(row.at||0))===key);
}

function dailyClimate(rows){
  const temperature=numericValues(rows,'temperature');
  const humidity=numericValues(rows,'humidity');
  const vpd=numericValues(rows,'vpd');
  return{
    temperature_min:minOrNull(temperature),
    temperature_max:maxOrNull(temperature),
    temperature_avg:avgOrNull(temperature),
    humidity_min:minOrNull(humidity),
    humidity_max:maxOrNull(humidity),
    humidity_avg:avgOrNull(humidity),
    vpd_min:minOrNull(vpd),
    vpd_max:maxOrNull(vpd),
    vpd_avg:avgOrNull(vpd),
    samples:Math.max(temperature.length,humidity.length,vpd.length)
  };
}

function dailyIncidents(incidents,key){
  return incidents.filter(incident=>{
    const opened=Number(incident.opened_at||0);
    const resolved=Number(incident.resolved_at||0);
    if(opened&&viveiroDayKey(opened)===key)return true;
    if(resolved&&viveiroDayKey(resolved)===key)return true;
    return false;
  });
}

function statusForDay({rows=[],incidents=[],audit=null,isToday=false}={}){
  if(isToday&&String(audit?.status||'')==='critical')return'critical';
  if(incidents.some(x=>x.status==='open'&&x.level==='critical'))return'critical';
  if(rows.some(x=>String(x.type||'').includes('error')))return'critical';
  if(isToday&&String(audit?.status||'')==='warning')return'warning';
  if(incidents.length)return'warning';
  if(rows.some(x=>String(x.type||'')==='viveiro_pulse_interrupted'))return'warning';
  return'normal';
}

export function buildViveiroReports(history=[],incidentsRaw={},seconds={},audit=null,now=Date.now()){
  const incidents=normalizeIncidents(incidentsRaw);
  const todayKey=viveiroDayKey(now);
  const trend30=[];

  for(let offset=29;offset>=0;offset--){
    const key=viveiroDayKey(now-offset*86400000);
    const rows=dayRows(history,key);
    const accounting=pulseAccountingForDay(history,key);
    const climate=dailyClimate(rows);
    const dayIncidents=dailyIncidents(incidents,key);
    const autoChanges=rows.filter(row=>
      ['viveiro_climate_auto_change','viveiro_climate_return_base','viveiro_climate_applied']
        .includes(String(row.type||''))
    );
    const targetOff=autoChanges.map(row=>Number(row.to_off_seconds)).filter(Number.isFinite);

    trend30.push({
      key,
      label:dayLabel(key),
      status:statusForDay({rows,incidents:dayIncidents,audit,isToday:key===todayKey}),
      pulses:Number(accounting.pulses_started||0),
      completed:Number(accounting.pulses_completed||0),
      interrupted:Number(accounting.pulses_interrupted||0),
      irrigated_seconds:Number(accounting.irrigated_seconds||0),
      rain_pauses:rows.filter(row=>
        ['viveiro_weather_pause','viveiro_rain_pause'].includes(String(row.type||''))
      ).length,
      errors:rows.filter(row=>String(row.type||'').includes('error')).length,
      auto_adjustments:autoChanges.length,
      avg_adjusted_off_seconds:avgOrNull(targetOff),
      incidents:dayIncidents.length,
      critical_incidents:dayIncidents.filter(x=>x.level==='critical').length,
      climate
    });
  }

  const today=trend30.at(-1)||{};
  const currentIncidents=incidents.filter(x=>x.status==='open');
  const recentIncidents=incidents.slice(0,30);

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
      open:currentIncidents,
      recent:recentIncidents,
      totals:{
        open:currentIncidents.length,
        open_critical:currentIncidents.filter(x=>x.level==='critical').length,
        last_30_days:incidents.filter(x=>now-Number(x.opened_at||0)<=30*86400000).length,
        resolved_automatic:incidents.filter(x=>x.status==='resolved'&&x.resolution==='automatico'&&now-Number(x.resolved_at||0)<=30*86400000).length,
        resolved_intervention:incidents.filter(x=>x.status==='resolved'&&x.resolution==='intervencao'&&now-Number(x.resolved_at||0)<=30*86400000).length
      }
    }
  };
}
