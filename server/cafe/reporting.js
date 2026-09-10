const TZ='America/Porto_Velho';

export function cafeDayKey(ts=Date.now()){
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

export function normalizeCafeIncidents(raw){
  if(!raw||typeof raw!=='object')return[];
  return Object.entries(raw)
    .map(([id,value])=>({id,...(value||{})}))
    .sort((a,b)=>Number(b.opened_at||0)-Number(a.opened_at||0));
}

function rowTs(row){return Number(row?.ts||Date.parse(row?.at||0)||0)}

function uniqueSessions(rows,types){
  const seen=new Set();
  const out=[];
  for(const row of rows){
    if(!types.includes(String(row.type||'')))continue;
    const key=String(row.session_id||row.event_id||row.id||[
      row.type,row.controller_id,row.zone,row.sector,rowTs(row)
    ].join('|'));
    if(seen.has(key))continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function sectorsFromStart(row){
  const out=[];
  if(Number(row.sector)>0){
    out.push({
      sector:Number(row.sector),
      duration_minutes:Math.max(0,Number(row.duration_minutes||0))
    });
  }
  if(Array.isArray(row.zones)){
    const controllerIndex=Math.max(1,Number(row.controller_index||1));
    for(const item of row.zones){
      const zone=Number(item?.zone);
      if(zone>=1&&zone<=8){
        out.push({
          sector:(controllerIndex-1)*8+zone,
          duration_minutes:Math.max(0,Number(item?.duration_minutes||0))
        });
      }
    }
  }
  return out;
}

function incidentsForDay(incidents,key){
  return incidents.filter(incident=>{
    const opened=Number(incident.opened_at||0);
    const resolved=Number(incident.resolved_at||0);
    return (opened&&cafeDayKey(opened)===key)||(resolved&&cafeDayKey(resolved)===key);
  });
}

function dayStatus(rows,incidents,audit,isToday){
  if(isToday&&audit?.status==='critical')return'critical';
  if(incidents.some(x=>x.status==='open'&&x.level==='critical'))return'critical';
  if(rows.some(x=>String(x.status||'').includes('error')||String(x.type||'').includes('error')))return'critical';
  if(isToday&&audit?.status==='warning')return'warning';
  if(incidents.length||rows.some(x=>String(x.type||'').includes('blocked')))return'warning';
  return'normal';
}

export function buildCafeReports(history=[],incidentsRaw={},controllers=[],audit=null,now=Date.now()){
  const incidents=normalizeCafeIncidents(incidentsRaw);
  const todayKey=cafeDayKey(now);
  const trend30=[];

  for(let offset=29;offset>=0;offset--){
    const key=cafeDayKey(now-offset*86400000);
    const rows=history.filter(row=>cafeDayKey(rowTs(row))===key);
    const starts=uniqueSessions(rows,['start','group_start','auto_start']);
    const completes=uniqueSessions(rows,['complete','auto_complete']);
    const sectors=[...new Set(starts.flatMap(sectorsFromStart).map(x=>x.sector))];
    const dayIncidents=incidentsForDay(incidents,key);

    trend30.push({
      key,
      label:dayLabel(key),
      status:dayStatus(rows,dayIncidents,audit,key===todayKey),
      sessions:starts.length,
      completed:completes.length,
      sectors:sectors.length,
      planned_minutes:starts.reduce((sum,row)=>
        sum+sectorsFromStart(row).reduce((s,x)=>s+x.duration_minutes,0),0
      ),
      completed_minutes:completes.reduce((sum,row)=>sum+Math.max(0,Number((row.actual_duration_minutes??row.duration_minutes)??0)),0),
      blocked:rows.filter(row=>String(row.type||'').includes('blocked')).length,
      errors:rows.filter(row=>String(row.status||'').includes('error')||String(row.type||'').includes('error')).length,
      incidents:dayIncidents.length,
      missed_schedules:dayIncidents.filter(x=>String(x.code||'').startsWith('schedule_missed_')).length
    });
  }

  const starts30=uniqueSessions(
    history.filter(row=>now-rowTs(row)<=30*86400000),
    ['start','group_start']
  );
  const starts7=starts30.filter(row=>now-rowTs(row)<=7*86400000);
  const sectorMap={};

  for(const controller of controllers){
    for(let zone=1;zone<=8;zone++){
      const sector=Number(controller.sector_start||1)+zone-1;
      sectorMap[sector]={
        sector,
        controller_id:controller.id,
        controller_index:Number(controller.controller_index||1),
        zone,
        starts_7d:0,
        starts_30d:0,
        planned_minutes_7d:0,
        planned_minutes_30d:0,
        last_start_at:null
      };
    }
  }

  for(const row of starts30){
    for(const item of sectorsFromStart(row)){
      const target=sectorMap[item.sector];
      if(!target)continue;
      target.starts_30d+=1;
      target.planned_minutes_30d+=item.duration_minutes;
      const ts=rowTs(row);
      if(!target.last_start_at||ts>target.last_start_at)target.last_start_at=ts;
    }
  }
  for(const row of starts7){
    for(const item of sectorsFromStart(row)){
      const target=sectorMap[item.sector];
      if(!target)continue;
      target.starts_7d+=1;
      target.planned_minutes_7d+=item.duration_minutes;
    }
  }

  const sectors=Object.values(sectorMap).map(item=>({
    ...item,
    hours_since_last:item.last_start_at?Math.max(0,(now-item.last_start_at)/3600000):null
  }));

  return{
    generated_at:now,
    status_today:trend30.at(-1)?.status||'normal',
    today:trend30.at(-1)||{},
    trend7:trend30.slice(-7),
    trend30,
    sectors,
    sectors_needing_attention:sectors
      .filter(x=>x.last_start_at&&x.hours_since_last>72)
      .sort((a,b)=>Number(b.hours_since_last)-Number(a.hours_since_last))
      .slice(0,12),
    incidents:{
      open:incidents.filter(x=>x.status==='open'),
      recent:incidents.slice(0,30),
      totals:{
        open:incidents.filter(x=>x.status==='open').length,
        open_critical:incidents.filter(x=>x.status==='open'&&x.level==='critical').length,
        last_30_days:incidents.filter(x=>now-Number(x.opened_at||0)<=30*86400000).length,
        resolved_automatic:incidents.filter(x=>x.status==='resolved'&&x.resolution==='automatico'&&now-Number(x.resolved_at||0)<=30*86400000).length,
        resolved_intervention:incidents.filter(x=>x.status==='resolved'&&x.resolution==='intervencao'&&now-Number(x.resolved_at||0)<=30*86400000).length
      }
    }
  };
}
