const num=(v,d=null)=>Number.isFinite(Number(v))?Number(v):d;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ts=row=>num(row?.ts,Date.parse(row?.at||''))||0;

function median(values=[]){
  const rows=values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!rows.length)return null;
  const m=Math.floor(rows.length/2);
  return rows.length%2?rows[m]:(rows[m-1]+rows[m])/2;
}
function mad(values=[],center=null){
  const c=Number.isFinite(center)?center:median(values);
  return Number.isFinite(c)?median(values.filter(Number.isFinite).map(v=>Math.abs(v-c))):null;
}
function stat(values=[]){
  const clean=values.filter(Number.isFinite);
  const med=median(clean),spread=mad(clean,med);
  return{samples:clean.length,median:med==null?null:Number(med.toFixed(3)),mad:spread==null?null:Number(spread.toFixed(3)),min:clean.length?Math.min(...clean):null,max:clean.length?Math.max(...clean):null};
}
function climateValues(row={}){
  return{temperature:num(row.temperature),humidity:num(row.humidity),vpd:num(row.vpd)};
}
export function buildAutonomyBaseline(history=[],now=Date.now()){
  const rows=(Array.isArray(history)?history:[]).filter(r=>ts(r)>now-7*86400000);
  const climates=rows.map(climateValues).filter(x=>Number.isFinite(x.temperature)||Number.isFinite(x.humidity)||Number.isFinite(x.vpd));
  const pulses=rows.filter(r=>String(r.type)==='viveiro_pulse_complete');
  const failures=rows.filter(r=>['viveiro_error','viveiro_start_failure'].includes(String(r.type)));
  const interrupted=rows.filter(r=>String(r.type)==='viveiro_pulse_interrupted');
  const decisions=rows.filter(r=>String(r.type)==='viveiro_automatic4_decision');
  const pulseDur=pulses.map(r=>num(r.accounted_duration_seconds??r.duration_seconds??r.planned_duration_seconds??r.actual_duration_seconds)).filter(Number.isFinite);
  const timing=pulses.map(r=>num(r.off_confirmation_latency_ms??r.confirmation_latency_ms??r.timing_error_ms)).filter(Number.isFinite);
  const offTargets=decisions.map(r=>num(r.to_off_seconds??r.target_off_seconds)).filter(Number.isFinite);
  const daySpan=Math.max(1,Math.min(7,(now-(Math.min(...rows.map(ts).filter(Boolean),now)))/86400000));
  const samples=climates.length+pulses.length+decisions.length;
  const confidence=samples>=120?'high':samples>=40?'medium':'learning';
  return{
    version:2,window_days:Number(daySpan.toFixed(1)),rows:rows.length,confidence,
    climate:{temperature:stat(climates.map(x=>x.temperature)),humidity:stat(climates.map(x=>x.humidity)),vpd:stat(climates.map(x=>x.vpd))},
    pulse:{accounted_duration_seconds:stat(pulseDur),confirmation_latency_ms:stat(timing),confirmation_error_ms:stat(timing)},
    operation:{failures_per_day:Number((failures.length/daySpan).toFixed(2)),interruptions_per_day:Number((interrupted.length/daySpan).toFixed(2)),completed:pulses.length,decisions:decisions.length,off_target_seconds:stat(offTargets)}
  };
}

function deviation(value,s,minBand){
  if(!Number.isFinite(value)||!s||!Number.isFinite(s.median)||s.samples<4)return 0;
  const band=Math.max(minBand,Number(s.mad||0)*3);
  return Math.abs(value-s.median)/Math.max(.001,band);
}
export function detectAutonomyAnomalies({baseline={},history=[],weather={},seconds={}},now=Date.now()){
  const anomalies=[];
  if(baseline?.confidence==='learning')return anomalies;
  const recent=(Array.isArray(history)?history:[]).filter(r=>ts(r)>now-2*3600000);
  const failures=recent.filter(r=>['viveiro_error','viveiro_start_failure'].includes(String(r.type))).length;
  const interrupted=recent.filter(r=>String(r.type)==='viveiro_pulse_interrupted').length;
  const temp=num(weather?.metrics?.temperature?.value),hum=num(weather?.metrics?.humidity?.value);
  const vpd=num(seconds?.climate4_vpd);
  const checks=[
    ['temperature',temp,baseline?.climate?.temperature,3.5,'Temperatura fora do padrão aprendido'],
    ['humidity',hum,baseline?.climate?.humidity,12,'Umidade fora do padrão aprendido'],
    ['vpd',vpd,baseline?.climate?.vpd,.55,'VPD fora do padrão aprendido']
  ];
  for(const [key,value,stats,minBand,label] of checks){
    const d=deviation(value,stats,minBand);
    if(d>=1.35)anomalies.push({key:'learned-'+key,level:d>=2?'warning':'info',message:`${label}: ${Number(value).toFixed(key==='humidity'?0:2)}.`,deviation:Number(d.toFixed(2))});
  }
  const expected2h=Math.max(.5,num(baseline?.operation?.failures_per_day,0)/12);
  if(failures>=Math.max(2,Math.ceil(expected2h*3)))anomalies.push({key:'learned-failures',level:failures>=4?'critical':'warning',message:`${failures} falhas em 2 h, acima do padrão aprendido.`});
  const expectedInt=Math.max(.5,num(baseline?.operation?.interruptions_per_day,0)/12);
  if(interrupted>=Math.max(2,Math.ceil(expectedInt*3)))anomalies.push({key:'learned-interruptions',level:'warning',message:`${interrupted} interrupções em 2 h, acima do padrão aprendido.`});
  const cloud=num(seconds?.confirmation_latency?.avg_ms);
  const learned=num(baseline?.pulse?.confirmation_latency_ms?.median??baseline?.pulse?.confirmation_error_ms?.median);
  if(Number.isFinite(cloud)&&Number.isFinite(learned)&&(baseline?.pulse?.confirmation_latency_ms?.samples??baseline?.pulse?.confirmation_error_ms?.samples)>=8&&cloud>Math.max(15000,learned*1.8))anomalies.push({key:'learned-cloud-latency',level:'warning',message:`Confirmação Smart Life (${Math.round(cloud)} ms) acima do padrão recente.`});
  return anomalies;
}

export function learningSummary(baseline={},anomalies=[]){
  const stage=baseline?.confidence==='high'?'Aprendizado maduro':baseline?.confidence==='medium'?'Aprendizado confiável':'Aprendendo o viveiro';
  const normality=anomalies.some(x=>x.level==='critical')?'critical':anomalies.some(x=>x.level==='warning')?'attention':anomalies.length?'observe':'normal';
  const score=clamp(100-anomalies.reduce((s,x)=>s+(x.level==='critical'?28:x.level==='warning'?12:4),0),0,100);
  return{stage,normality,score,anomaly_count:anomalies.length};
}
