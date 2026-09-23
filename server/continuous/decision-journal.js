const num=(v,d=null)=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):d;
const ts=row=>num(row?.ts,Date.parse(row?.at||''))||0;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function nextRows(rows,index,windowMs=45*60000){
  const start=ts(rows[index]),out=[];
  for(let i=index+1;i<rows.length;i++){
    const delta=ts(rows[i])-start;
    if(delta<0)continue;
    if(delta>windowMs)break;
    out.push(rows[i]);
  }
  return out;
}

export function buildDecisionJournal(history=[],now=Date.now()){
  const rows=(Array.isArray(history)?history:[]).filter(r=>ts(r)>now-14*86400000).sort((a,b)=>ts(a)-ts(b));
  const journal=[];
  for(let i=0;i<rows.length;i++){
    const d=rows[i]; if(String(d.type)!=='viveiro_automatic4_decision')continue;
    const after=nextRows(rows,i);
    const pulses=after.filter(r=>String(r.type)==='viveiro_pulse_complete');
    const failures=after.filter(r=>['viveiro_error','viveiro_start_failure','viveiro_pulse_interrupted'].includes(String(r.type)));
    const external=after.filter(r=>['viveiro_weather_unavailable'].includes(String(r.type))||String(r.audit_code||'')==='weather_offline'||(String(r.type)==='viveiro_pulse_interrupted'&&['weather_unavailable','weather_offline','weather_blocked','inactive','window','disabled','server_restart','maintenance','on'].includes(String(r.reason||r.status||''))));
    const operationalFailures=failures.filter(f=>!external.some(e=>e===f||Math.abs(ts(e)-ts(f))<=120000));
    const climate=after.filter(r=>Number.isFinite(num(r.vpd))||Number.isFinite(num(r.temperature)));
    const lastClimate=climate.at(-1)||{};
    const beforeVpd=num(d.vpd),afterVpd=num(lastClimate.vpd);
    const vpdDelta=Number.isFinite(beforeVpd)&&Number.isFinite(afterVpd)?afterVpd-beforeVpd:null;
    const decision=String(d.decision||'MANTER').toUpperCase();
    const elapsed=Math.max(0,now-ts(d));
    const mature=elapsed>=20*60000;
    const evidence=mature&&pulses.length>=2;
    let outcome=null;
    if(evidence){
      outcome=70+Math.min(18,pulses.length*4)-Math.min(45,operationalFailures.length*18);
      // VPD é contexto, não prova causal. Só penaliza quando a direção contradiz fortemente
      // a decisão; nunca premia sozinho uma mudança natural do clima.
      if(decision==='REDUZIR'&&Number.isFinite(vpdDelta)&&vpdDelta<-.25)outcome-=8;
      if(['INTENSIFICAR','AUMENTAR'].includes(decision)&&Number.isFinite(vpdDelta)&&vpdDelta>.35)outcome-=8;
      outcome=clamp(Math.round(outcome),0,100);
    }
    journal.push({at:ts(d),decision,reason:d.reason||'',from_off_seconds:num(d.from_off_seconds),to_off_seconds:num(d.to_off_seconds),temperature:num(d.temperature),humidity:num(d.humidity),vpd:beforeVpd,demand_percent:num(d.demand_percent),pulses_after:pulses.length,failures_after:failures.length,operational_failures_after:operationalFailures.length,external_failures_after:external.length,failure_classification:failures.length?(operationalFailures.length?'operational':'external_transient'):'none',vpd_delta:vpdDelta,evidence_ready:evidence,evaluation_age_minutes:Math.round(elapsed/60000),outcome_score:outcome,outcome_label:outcome==null?'aguardando':outcome>=85?'bom':outcome>=65?'neutro':'revisar'});
  }
  return journal.slice(-120).reverse();
}

export function learnFromDecisionResults(journal=[]){
  const rows=Array.isArray(journal)?journal:[];
  const scored=rows.filter(x=>x.outcome_score!=null&&Number.isFinite(Number(x.outcome_score)));
  if(!scored.length)return{mode:'recommendation',samples:0,confidence:'baixa',summary:'Ainda não há decisões suficientes avaliadas.',recommendations:[]};
  const avg=scored.reduce((s,x)=>s+Number(x.outcome_score),0)/scored.length;
  const byDecision={};
  for(const row of scored){
    const key=row.decision||'MANTER'; const list=byDecision[key]||(byDecision[key]=[]); list.push(Number(row.outcome_score));
  }
  const performance=Object.fromEntries(Object.entries(byDecision).map(([k,v])=>[k,{samples:v.length,average:Math.round(v.reduce((a,b)=>a+b,0)/v.length)}]));
  const recommendations=[];
  for(const [decision,p] of Object.entries(performance)){
    if(p.samples>=3&&p.average<65)recommendations.push(`Revisar decisões ${decision}: resultado médio ${p.average}/100.`);
    else if(p.samples>=3&&p.average>=85)recommendations.push(`Decisões ${decision} estão respondendo bem: média ${p.average}/100.`);
  }
  const confidence=scored.length>=20?'alta':scored.length>=8?'média':'baixa';
  return{mode:'recommendation',samples:scored.length,confidence,average_outcome:Math.round(avg),performance,recommendations,summary:`${scored.length} decisão(ões) avaliadas • resultado médio ${Math.round(avg)}/100.`};
}


export function buildDailyLearningScore(journal=[],now=Date.now()){
  const d=new Date(now); d.setHours(0,0,0,0); const start=d.getTime();
  const rows=(Array.isArray(journal)?journal:[]).filter(x=>Number(x.at)>=start&&x.outcome_score!=null&&Number.isFinite(Number(x.outcome_score)));
  if(!rows.length)return{version:'4.11',score:null,label:'coletando',samples:0,validated:false,summary:'Aguardando decisões maduras suficientes hoje.'};
  const score=Math.round(rows.reduce((a,x)=>a+Number(x.outcome_score),0)/rows.length);
  return{version:'4.11',score,label:score>=85?'excelente':score>=70?'bom':score>=55?'atenção':'revisar',samples:rows.length,validated:rows.length>=5,failures:rows.reduce((a,x)=>a+Number(x.failures_after||0),0),summary:`${rows.length} decisão(ões) maduras hoje • score ${score}/100.`};
}
