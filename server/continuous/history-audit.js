import { storeGet, storeGetQuery } from '../api/irrigation/_store.js';

const TZ='America/Porto_Velho';
const DAYS=new Set(['2026-09-06','2026-09-07','2026-09-08','2026-09-09','2026-09-10']);
const PAGE=250;

function dayKey(ts){
  return new Intl.DateTimeFormat('en-CA',{
    timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'
  }).format(new Date(Number(ts)||0));
}
function rowTs(row){
  const direct=Number(row?.ts||0);
  if(Number.isFinite(direct)&&direct>0)return direct;
  const parsed=Date.parse(row?.at||'');
  return Number.isFinite(parsed)?parsed:0;
}
function durationSeconds(row){
  const actual=Number(row?.actual_duration_seconds);
  if(Number.isFinite(actual)&&actual>=0)return actual;
  const fallback=Number(row?.duration_seconds??row?.planned_duration_seconds);
  return Number.isFinite(fallback)&&fallback>=0?fallback:null;
}
function sample(row){
  return{
    type:String(row?.type||''),
    ts:rowTs(row),
    at:rowTs(row)?new Date(rowTs(row)).toISOString():null,
    pulse_id:row?.pulse_id||null,
    actual_duration_seconds:Number.isFinite(Number(row?.actual_duration_seconds))?Number(row.actual_duration_seconds):null,
    duration_seconds:Number.isFinite(Number(row?.duration_seconds))?Number(row.duration_seconds):null,
    planned_duration_seconds:Number.isFinite(Number(row?.planned_duration_seconds))?Number(row.planned_duration_seconds):null,
    detail:String(row?.detail||'').slice(0,120)||null
  };
}
function newDay(){
  return{
    rows:0,starts:0,completes:0,interrupts:0,
    first_ts:null,last_ts:null,
    duplicate_start_events:0,duplicate_final_events:0,
    starts_without_final:0,finals_without_start:0,
    unique_starts:0,unique_finals:0,
    final_duration_sum_all:0,finals_with_duration:0,finals_without_duration:0,
    min_final_duration:null,max_final_duration:null,
    _starts:new Map(),_finals:new Map(),_samples:[]
  };
}
function ensure(out,key){return out[key]||(out[key]=newDay())}
function add(out,row){
  const ts=rowTs(row); if(!ts)return;
  const key=dayKey(ts); if(!DAYS.has(key))return;
  const d=ensure(out,key); d.rows++;
  d.first_ts=d.first_ts==null?ts:Math.min(d.first_ts,ts);
  d.last_ts=d.last_ts==null?ts:Math.max(d.last_ts,ts);
  const type=String(row?.type||'');
  const pulse=String(row?.pulse_id||'').trim();
  if(type==='viveiro_pulse_start'){
    d.starts++;
    if(d._samples.length<8)d._samples.push(sample(row));
    if(pulse){
      if(d._starts.has(pulse))d.duplicate_start_events++;
      const prev=d._starts.get(pulse);
      if(!prev||ts<prev.ts)d._starts.set(pulse,{ts,row});
    }
  }else if(type==='viveiro_pulse_complete'||type==='viveiro_pulse_interrupted'){
    if(type==='viveiro_pulse_complete')d.completes++; else d.interrupts++;
    if(d._samples.length<8)d._samples.push(sample(row));
    const duration=durationSeconds(row);
    if(duration==null)d.finals_without_duration++;
    else{
      d.finals_with_duration++;
      d.final_duration_sum_all+=duration;
      d.min_final_duration=d.min_final_duration==null?duration:Math.min(d.min_final_duration,duration);
      d.max_final_duration=d.max_final_duration==null?duration:Math.max(d.max_final_duration,duration);
    }
    if(pulse){
      if(d._finals.has(pulse))d.duplicate_final_events++;
      const prev=d._finals.get(pulse);
      if(!prev||ts>=prev.ts)d._finals.set(pulse,{ts,row});
    }
  }
}
function finalize(out){
  const result={};
  for(const key of [...DAYS].sort()){
    const d=out[key]||newDay();
    d.unique_starts=d._starts.size;
    d.unique_finals=d._finals.size;
    for(const pulse of d._starts.keys())if(!d._finals.has(pulse))d.starts_without_final++;
    for(const pulse of d._finals.keys())if(!d._starts.has(pulse))d.finals_without_start++;
    let uniquePulseDuration=0;
    for(const {row} of d._finals.values()){
      const duration=durationSeconds(row);
      if(duration!=null)uniquePulseDuration+=duration;
    }
    result[key]={
      rows:d.rows,starts:d.starts,completes:d.completes,interrupts:d.interrupts,
      unique_starts:d.unique_starts,unique_finals:d.unique_finals,
      duplicate_start_events:d.duplicate_start_events,duplicate_final_events:d.duplicate_final_events,
      starts_without_final:d.starts_without_final,finals_without_start:d.finals_without_start,
      finals_with_duration:d.finals_with_duration,finals_without_duration:d.finals_without_duration,
      final_duration_sum_all:Number(d.final_duration_sum_all.toFixed(3)),
      unique_pulse_duration_sum:Number(uniquePulseDuration.toFixed(3)),
      min_final_duration:d.min_final_duration,
      max_final_duration:d.max_final_duration,
      first_at:d.first_ts?new Date(d.first_ts).toISOString():null,
      last_at:d.last_ts?new Date(d.last_ts).toISOString():null,
      samples:d._samples
    };
  }
  return result;
}
async function scan(path){
  const out={}; let cursor=null,scanned=0,pages=0;
  while(true){
    const raw=await storeGetQuery(path,{
      orderBy:'$key',...(cursor?{startAt:cursor}:{}),limitToFirst:PAGE+(cursor?1:0)
    });
    let rows=raw&&typeof raw==='object'?Object.entries(raw).map(([id,value])=>({id,...(value||{})})):[];
    rows.sort((a,b)=>String(a.id)<String(b.id)?-1:String(a.id)>String(b.id)?1:0);
    if(cursor)rows=rows.filter(row=>String(row.id)!==String(cursor));
    if(!rows.length)break;
    pages++; scanned+=rows.length;
    for(const row of rows)add(out,row);
    cursor=String(rows.at(-1)?.id||'');
    if(rows.length<PAGE||!cursor)break;
    if(pages>100)throw new Error('Limite de páginas excedido em '+path);
  }
  return{path,scanned,pages,days:finalize(out)};
}

export async function auditViveiroHistoryReadOnly(){
  const [original,indexed,state,indexMeta]=await Promise.all([
    scan('IrrigacaoFazenda2E/history'),
    scan('IrrigacaoFazenda2E/historyByTime'),
    storeGet('IrrigacaoFazenda2E/viveiroSecondsState').catch(()=>null),
    storeGet('IrrigacaoFazenda2E/historyByTimeMeta').catch(()=>null)
  ]);
  const compactState=state?{
    phase:state.phase||null,enabled:Boolean(state.enabled),
    daily_day_key:state.daily_day_key||null,
    daily_pulses_started:Number(state.daily_pulses_started||0),
    daily_pulses_completed:Number(state.daily_pulses_completed||0),
    daily_pulses_interrupted:Number(state.daily_pulses_interrupted||0),
    daily_irrigated_seconds:Number(state.daily_irrigated_seconds||0),
    daily_last_pulse_at:Number(state.daily_last_pulse_at||0)||null,
    accounting_reconciliation:state.accounting_reconciliation||null,
    accounting_recovery:state.accounting_recovery||null
  }:null;
  console.log('VIVEIRO_HISTORY_AUDIT_JSON',JSON.stringify({original,indexed,indexMeta,state:compactState}));
  return{original,indexed,indexMeta,state:compactState};
}
