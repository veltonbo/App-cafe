const TZ='America/Porto_Velho';
const num=(v,d=null)=>Number.isFinite(Number(v))?Number(v):d;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ts=row=>num(row?.ts,Date.parse(row?.at||''))||0;

function median(values=[]){
  const a=values.filter(Number.isFinite).sort((x,y)=>x-y);
  if(!a.length)return null;
  const m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
}
function mad(values=[],center=null){
  const c=Number.isFinite(center)?center:median(values);
  return Number.isFinite(c)?median(values.filter(Number.isFinite).map(v=>Math.abs(v-c))):null;
}
function stat(values=[]){
  const a=values.filter(Number.isFinite),m=median(a),d=mad(a,m);
  return{samples:a.length,median:m,mad:d};
}
function localHour(ms){
  const p=new Intl.DateTimeFormat('en-US',{timeZone:TZ,hour12:false,hour:'2-digit'}).formatToParts(new Date(ms));
  return Number(p.find(x=>x.type==='hour')?.value||0)%24;
}
function bucketForHour(hour){return Math.floor(hour/3)*3;}
export function buildHourlyProfile(history=[],now=Date.now()){
  const rows=(Array.isArray(history)?history:[]).filter(r=>ts(r)>now-14*86400000);
  const buckets={};
  for(let h=0;h<24;h+=3)buckets[h]={temperature:[],humidity:[],vpd:[],samples:0};
  for(const row of rows){
    const t=num(row.temperature),h=num(row.humidity),v=num(row.vpd);
    if(![t,h,v].some(Number.isFinite))continue;
    const b=bucketForHour(localHour(ts(row)||now)),x=buckets[b];
    if(Number.isFinite(t))x.temperature.push(t);
    if(Number.isFinite(h))x.humidity.push(h);
    if(Number.isFinite(v))x.vpd.push(v);
    x.samples++;
  }
  const out={};
  for(const [key,x] of Object.entries(buckets))out[key]={samples:x.samples,temperature:stat(x.temperature),humidity:stat(x.humidity),vpd:stat(x.vpd)};
  return out;
}
function deviation(value,s,minBand){
  if(!Number.isFinite(value)||!s||!Number.isFinite(s.median)||s.samples<4)return 0;
  const band=Math.max(minBand,Number(s.mad||0)*3);
  return Math.abs(value-s.median)/Math.max(.001,band);
}
export function detectHourlyAnomaly({profile={},weather={},seconds={}},now=Date.now()){
  const b=profile[bucketForHour(localHour(now))]||{};
  const values={temperature:num(weather?.metrics?.temperature?.value),humidity:num(weather?.metrics?.humidity?.value),vpd:num(seconds?.climate4_vpd)};
  const checks=[['temperature',values.temperature,b.temperature,3.2],['humidity',values.humidity,b.humidity,10],['vpd',values.vpd,b.vpd,.5]];
  return checks.map(([key,value,s,min])=>({key,value,deviation:deviation(value,s,min)})).filter(x=>x.deviation>=1.35);
}
export function predictiveMaintenance(history=[],now=Date.now(),seconds={}){
  const rows=(Array.isArray(history)?history:[]).filter(r=>ts(r)>now-14*86400000);
  const pulses=rows.filter(r=>String(r.type)==='viveiro_pulse_complete'&&Number.isFinite(num(r.off_confirmation_latency_ms??r.confirmation_latency_ms??r.timing_error_ms)));
  const windowMedian=days=>median(pulses.filter(r=>ts(r)>now-days*86400000).map(r=>Math.max(0,num(r.off_confirmation_latency_ms??r.confirmation_latency_ms??r.timing_error_ms))));
  const windows={day1:windowMedian(1),day3:windowMedian(3),day7:windowMedian(7),day14:windowMedian(14)};
  const cloudNow=num(seconds?.confirmation_latency?.avg_ms,num(seconds?.last_confirmation_latency_ms));
  const scheduler=num(seconds?.scheduler_precision?.avg_abs_error_ms);
  const reference=Number.isFinite(windows.day7)?windows.day7:windows.day14;
  const ratio=Number.isFinite(windows.day1)&&Number.isFinite(reference)&&reference>0?windows.day1/reference:null;
  const failuresFor=days=>rows.filter(r=>ts(r)>now-days*86400000&&['viveiro_error','viveiro_start_failure'].includes(String(r.type))).length;
  const failures={day1:failuresFor(1),day3:failuresFor(3),day7:failuresFor(7),day14:failuresFor(14)};
  const issues=[];
  if(Number.isFinite(cloudNow)&&cloudNow>=10000)issues.push({key:'smartlife-cloud-latency',level:cloudNow>=15000?'warning':'info',message:`Confirmação Smart Life está lenta: média atual ${Math.round(cloudNow)} ms.`});
  if(ratio!=null&&pulses.filter(r=>ts(r)>now-86400000).length>=8&&ratio>=1.35)issues.push({key:'smartlife-latency-trend',level:ratio>=1.8?'warning':'info',message:`Latência de confirmação Smart Life piorou ${Math.round((ratio-1)*100)}% versus a referência de 7 dias.`});
  if(failures.day1>=4)issues.push({key:'failure-trend',level:'warning',message:`${failures.day1} falhas operacionais nas últimas 24 h; manutenção preventiva recomendada.`});
  const score=clamp(100-issues.reduce((s,x)=>s+(x.level==='warning'?20:8),0),0,100);
  return{score,status:issues.some(x=>x.level==='warning')?'attention':issues.length?'observe':'healthy',recent_latency_ms:cloudNow,previous_latency_ms:reference,latency_windows_ms:windows,latency_ratio_1d_vs_7d:ratio,failures_24h:failures.day1,failures,local_scheduler_ms:scheduler,issues};
}

export function componentReliability({seconds={},weather={},history={},firebaseOk=true,devices=[]}={}){
  const cloud=num(seconds?.confirmation_latency?.avg_ms,num(seconds?.last_confirmation_latency_ms));
  const scheduler=num(seconds?.scheduler_precision?.avg_abs_error_ms);
  const irrigationDevice=(Array.isArray(devices)?devices:[]).find(d=>/viveiro 2e/i.test(String(d?.name||'')))||(Array.isArray(devices)?devices:[]).find(d=>/viveiro/i.test(String(d?.name||'')));
  const scores={
    controller:clamp(100-(scheduler>5000?35:scheduler>2000?12:0),0,100),
    ekaza:irrigationDevice?.online===false?35:clamp(100-(cloud>20000?35:cloud>15000?20:cloud>10000?10:cloud>7000?5:0),0,100),
    weather:weather?.linked===false||weather?.device?.online===false?35:100,
    firebase:firebaseOk?100:55,
    history:history?.sync?.last_success_at?clamp(100-(Date.now()-Number(history.sync.last_success_at)>180000?30:0),0,100):history?.rows?80:55
  };
  const values=Object.values(scores).filter(Number.isFinite);
  const overall=values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):0;
  return{overall,scores,labels:{controller:'Controlador local',ekaza:'EKAZA / Smart Life',weather:'Weather2-2',firebase:'Firebase',history:'Histórico'}};
}

export function buildDailyPlan({forecast={},weather={},seconds={},autonomy={}}={}){
  const hourly=Array.isArray(forecast?.hourly)?forecast.hourly.slice(0,24):[];
  const peak=hourly.slice().sort((a,b)=>(num(b?.vapour_pressure_deficit,0)+num(b?.et0_fao_evapotranspiration,0)*2)-(num(a?.vapour_pressure_deficit,0)+num(a?.et0_fao_evapotranspiration,0)*2))[0]||null;
  const rainProb=num(forecast?.summary?.max_rain_probability_24h,0),rainMm=num(forecast?.summary?.precipitation_24h_mm,0),rainImpact=forecast?.summary?.rain_agronomic_24h||{},maxVpd=num(forecast?.summary?.max_vpd_24h),et0=num(forecast?.summary?.et0_24h);
  let demand='normal',score=50;
  if(Number.isFinite(maxVpd))score+=maxVpd>=3?30:maxVpd>=2?18:maxVpd<1? -15:5;
  if(Number.isFinite(et0))score+=et0>=5?15:et0>=3?8:0;
  // Probabilidade alta de garoa não deve reduzir demanda como se fosse chuva útil.
  if(rainImpact?.agronomically_useful)score-=30;
  else if(rainMm>=2&&rainProb>=50)score-=15;
  else if(rainMm>=.5)score-=5;
  score=clamp(score,0,100); demand=score>=75?'alta':score>=58?'elevada':score<=30?'baixa':'normal';
  const confidence=forecast?.ok&&autonomy?.score>=80?'alta':forecast?.ok?'média':'baixa';
  const why=[];
  if(Number.isFinite(maxVpd))why.push(`VPD máx. previsto ${maxVpd.toFixed(2)} kPa`);
  if(Number.isFinite(et0))why.push(`ET₀ 24 h ${et0.toFixed(1)} mm`);
  if(rainProb||rainMm)why.push(`chuva prevista ${rainMm.toFixed(1)} mm • até ${Math.round(rainProb)}% • ${rainImpact?.label||'sem classificação'}`);
  return{generated_at:Date.now(),demand,score,confidence,peak_time:peak?.time||null,rain_probability_24h:rainProb,rain_mm_24h:Number(rainMm.toFixed(2)),rain_agronomic_24h:rainImpact,max_vpd_24h:maxVpd,et0_24h:et0,why,recommendation:'A previsão antecipa demanda; somente a Weather2-2 confirma chuva para proteção física do Automático 4.0.'};
}

export function predictiveRisk({maintenance={},reliability={},hourlyAnomalies=[],backup={}}={}){
  let score=0; const reasons=[];
  const ratio=num(maintenance?.latency_ratio_1d_vs_7d);
  const failures=num(maintenance?.failures_24h,0);
  const ekaza=num(reliability?.scores?.ekaza,100);
  const controller=num(reliability?.scores?.controller,100);
  if(Number.isFinite(ratio)&&ratio>=1.5){score+=ratio>=2?28:18;reasons.push(`Smart Life ${Math.round((ratio-1)*100)}% mais lenta que a referência de 7 dias`);}
  if(failures>0){score+=Math.min(35,failures*9);reasons.push(`${failures} falha(s) operacional(is) nas últimas 24 h`);}
  if(ekaza<85){score+=Math.min(25,85-ekaza);reasons.push(`confiabilidade EKAZA ${Math.round(ekaza)}/100`);}
  if(controller<95){score+=20;reasons.push(`controlador local abaixo do padrão: ${Math.round(controller)}/100`);}
  if(Array.isArray(hourlyAnomalies)&&hourlyAnomalies.length){score+=Math.min(18,hourlyAnomalies.length*6);reasons.push(`${hourlyAnomalies.length} desvio(s) do padrão por horário`);}
  if(backup?.restorable===false){score+=18;reasons.push('backup mais recente não passou no teste de restauração');}
  score=clamp(Math.round(score),0,100);
  const level=score>=70?'iminente':score>=45?'provavel':score>=20?'atencao':'baixo';
  const recommendation=level==='iminente'?'Revisar comunicação e infraestrutura antes da próxima janela.':level==='provavel'?'Acompanhar EKAZA/Smart Life e backups; há tendência de degradação.':level==='atencao'?'Há sinais preventivos, mas o controlador local segue protegido.':'Nenhum risco operacional relevante previsto agora.';
  return{score,level,reasons,recommendation,controller_protected:true,controller_health_ok:controller>=95};
}
