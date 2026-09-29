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
    const predictedOff=num(d.to_off_seconds),realizedOff=pulses.length?num(pulses[0].off_seconds,num(pulses[0].configured_off_seconds)):null;
    const predictedOn=num(d.to_seconds,num(d.target_on_seconds)),realizedOn=pulses.length?num(pulses[0].on_seconds,num(pulses[0].duration_seconds,num(pulses[0].irrigated_seconds))):null;
    const measurementConfirmed=Boolean(pulses.length&&Number.isFinite(realizedOff)&&Number.isFinite(realizedOn));
    journal.push({at:ts(d),measurement_confirmed:measurementConfirmed,decision,reason:d.reason||'',from_off_seconds:num(d.from_off_seconds),to_off_seconds:predictedOff,predicted_on_seconds:predictedOn,realized_on_seconds:realizedOn,predicted_off_seconds:predictedOff,realized_off_seconds:realizedOff,temperature:num(d.temperature),humidity:num(d.humidity),vpd:beforeVpd,demand_percent:num(d.demand_percent),pulses_after:pulses.length,failures_after:failures.length,operational_failures_after:operationalFailures.length,external_failures_after:external.length,failure_classification:failures.length?(operationalFailures.length?'operational':'external_transient'):'none',vpd_delta:vpdDelta,evidence_ready:evidence,evaluation_age_minutes:Math.round(elapsed/60000),outcome_score:outcome,outcome_label:outcome==null?'aguardando':outcome>=85?'bom':outcome>=65?'neutro':'revisar'});
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

export function buildLearningDiagnostics(journal=[],now=Date.now()){
  const rows=(Array.isArray(journal)?journal:[]).filter(x=>x?.outcome_score!=null&&Number.isFinite(Number(x.outcome_score))).sort((a,b)=>Number(a.at||0)-Number(b.at||0));
  const recent=rows.filter(x=>Number(x.at||0)>=now-3*86400000).slice(-20);
  const previous=rows.filter(x=>Number(x.at||0)<now-3*86400000&&Number(x.at||0)>=now-14*86400000).slice(-40);
  const avg=a=>a.length?a.reduce((s,x)=>s+Number(x.outcome_score),0)/a.length:null;
  const recentAvg=avg(recent),previousAvg=avg(previous);
  const delta=recentAvg!=null&&previousAvg!=null?recentAvg-previousAvg:null;
  const operational=recent.reduce((s,x)=>s+Number(x.operational_failures_after||0),0);
  const external=recent.reduce((s,x)=>s+Number(x.external_failures_after||0),0);
  const evidencePending=(Array.isArray(journal)?journal:[]).filter(x=>!x.evidence_ready).length;
  let state='collecting',label='Coletando evidências',degradation=false;
  if(recent.length>=5){state='stable';label='Aprendizado estável';}
  if(recent.length>=5&&((recentAvg!=null&&recentAvg<60)||(delta!=null&&delta<=-15))){state='degraded';label='Degradação detectada';degradation=true;}
  const comparable=recent.filter(x=>Number.isFinite(Number(x.predicted_off_seconds))&&Number.isFinite(Number(x.realized_off_seconds)));
  const absErrors=comparable.map(x=>Math.abs(Number(x.realized_off_seconds)-Number(x.predicted_off_seconds)));
  const meanAbsError=absErrors.length?absErrors.reduce((a,b)=>a+b,0)/absErrors.length:null;
  const withinTolerance=comparable.filter(x=>Math.abs(Number(x.realized_off_seconds)-Number(x.predicted_off_seconds))<=Math.max(5,Number(x.predicted_off_seconds)*.1)).length;
  const forecastVsRealized={samples:comparable.length,metric:'off_seconds',predicted_average:comparable.length?Math.round(comparable.reduce((a,x)=>a+Number(x.predicted_off_seconds),0)/comparable.length):null,realized_average:comparable.length?Math.round(comparable.reduce((a,x)=>a+Number(x.realized_off_seconds),0)/comparable.length):null,mean_absolute_error_seconds:meanAbsError==null?null:Number(meanAbsError.toFixed(1)),within_tolerance_percent:comparable.length?Math.round(withinTolerance/comparable.length*100):null,evidence:'decision_target_vs_first_completed_pulse'};
  return{version:1,state,label,degradation,window_days:14,recent_samples:recent.length,previous_samples:previous.length,recent_score:recentAvg==null?null:Math.round(recentAvg),previous_score:previousAvg==null?null:Math.round(previousAvg),score_delta:delta==null?null:Math.round(delta),operational_failures:operational,external_failures:external,evidence_pending:evidencePending,forecast_vs_realized:forecastVsRealized,physical_control:false,action:'advisory_only'};
}

export function buildLearning46(journal=[]){
  const rows=(Array.isArray(journal)?journal:[]).filter(x=>Number.isFinite(Number(x.predicted_off_seconds))&&Number.isFinite(Number(x.realized_off_seconds)));
  const groups={};for(const x of rows){const v=Number(x.vpd);const band=Number.isFinite(v)?(v<.9?'umido':v>=2?'seco':'normal'):'sem_vpd';(groups[band]||(groups[band]=[])).push(x);}
  const by_condition=Object.fromEntries(Object.entries(groups).map(([k,a])=>{const e=a.map(x=>Math.abs(Number(x.realized_off_seconds)-Number(x.predicted_off_seconds)));return[k,{samples:a.length,mean_absolute_error_seconds:Number((e.reduce((u,v)=>u+v,0)/e.length).toFixed(1)),bias_seconds:Number((a.reduce((u,x)=>u+Number(x.realized_off_seconds)-Number(x.predicted_off_seconds),0)/a.length).toFixed(1))}]}));
  const enough=rows.length>=8,errors=rows.map(x=>Math.abs(Number(x.realized_off_seconds)-Number(x.predicted_off_seconds))),mae=rows.length?errors.reduce((a,b)=>a+b,0)/rows.length:null;
  return{version:'4.6',mode:'advisory_only',samples:rows.length,validated:enough,mean_absolute_error_seconds:mae==null?null:Number(mae.toFixed(1)),by_condition,recommendation:enough&&mae>15?'Revisar calibração consultiva: diferença prevista × realizada persistente.':'Continuar coletando e comparando resultados.',physical_control:false};
}

export function buildLearning47(journal=[],now=Date.now()){
  const source=(Array.isArray(journal)?journal:[]).filter(x=>Number(x.at||0)>=now-14*86400000);
  const measured=source.filter(x=>x.measurement_confirmed===true&&Number.isFinite(Number(x.predicted_off_seconds))&&Number.isFinite(Number(x.realized_off_seconds))&&Number.isFinite(Number(x.predicted_on_seconds))&&Number.isFinite(Number(x.realized_on_seconds)));
  const band=x=>{const v=Number(x.vpd);return Number.isFinite(v)?(v<.9?'umido':v>=2?'seco':'normal'):'sem_vpd'};
  const calc=(rows,p,r)=>{const e=rows.map(x=>Math.abs(Number(x[r])-Number(x[p])));return{samples:rows.length,validated:rows.length>=5,mae_seconds:rows.length?Number((e.reduce((a,b)=>a+b,0)/rows.length).toFixed(1)):null,bias_seconds:rows.length?Number((rows.reduce((a,x)=>a+Number(x[r])-Number(x[p]),0)/rows.length).toFixed(1)):null}};
  const groups={};for(const x of measured)(groups[band(x)]||(groups[band(x)]=[])).push(x);
  const by_condition=Object.fromEntries(Object.entries(groups).map(([k,a])=>[k,{samples:a.length,confidence:a.length>=8?'alta':a.length>=5?'média':'baixa',validated:a.length>=5,on:calc(a,'predicted_on_seconds','realized_on_seconds'),off:calc(a,'predicted_off_seconds','realized_off_seconds')} ]));
  const on=calc(measured,'predicted_on_seconds','realized_on_seconds'),off=calc(measured,'predicted_off_seconds','realized_off_seconds');
  return{version:'4.7',mode:'advisory_only',window_days:14,samples:measured.length,rejected_unconfirmed:source.length-measured.length,validated:measured.length>=8,minimum_samples_per_condition:5,on,off,by_condition,recommendation:measured.length>=8&&(Number(off.mae_seconds||0)>15||Number(on.mae_seconds||0)>10)?'Revisar calibração consultiva: diferença medida persistente.':'Continuar coletando somente pulsos confirmados.',physical_control:false};
}

export function buildLearning48(journal=[],now=Date.now()){
 const base=buildLearning47(journal,now),rows=(Array.isArray(journal)?journal:[]).filter(x=>Number(x.at||0)>=now-14*86400000&&x.measurement_confirmed===true);
 const recent=rows.filter(x=>Number(x.at||0)>=now-3*86400000);
 const completion=recent.length?Math.round(100*recent.filter(x=>x.evidence_ready===true).length/recent.length):null;
 const conditions=Object.fromEntries(Object.entries(base.by_condition||{}).map(([k,v])=>[k,{...v,ready_for_review:v.samples>=8&&v.on?.validated&&v.off?.validated}]));
 return{...base,version:'4.8',recent_samples:recent.length,evidence_completion_percent:completion,conditions,review_ready:base.validated&&Object.values(conditions).some(x=>x.ready_for_review),recommendation:base.validated?'Dados reais suficientes para revisão consultiva; nenhuma calibração é aplicada automaticamente.':'Continuar coletando pulsos reais confirmados.',physical_control:false,automatic_changes:false};
}

export function buildLearning50(journal=[],now=Date.now()){
  const base=buildLearning48(journal,now);
  const groups={madrugada:[],manha:[],calor_seco:[],umidade_alta:[],pos_chuva:[],normal:[]};
  for(const row of (Array.isArray(journal)?journal:[])){if(row?.measurement_confirmed!==true)continue;const h=new Date(Number(row.ts||row.at||now)).getHours(),v=Number(row.vpd),hum=Number(row.humidity),rain=Boolean(row.rain||row.rain_detected);const k=rain?'pos_chuva':Number.isFinite(v)&&v>=2.5?'calor_seco':Number.isFinite(hum)&&hum>=85?'umidade_alta':h<6?'madrugada':h<12?'manha':'normal';groups[k].push(row)}
  const conditions=Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,{samples:v.length,ready:v.length>=8}]));
  return{version:5.0,role:'advisory',samples:base.samples||0,validated:Boolean(base.validated),conditions,recommendation:base.recommendation||'Continuar coletando evidências reais por condição.',physical_control:false,automatic_changes:false};
}

export function buildLearning51(journal=[],now=Date.now()){const b=buildLearning50(journal,now),c=b.conditions||{};const ready=Object.entries(c).filter(([,v])=>v.ready).map(([k])=>k);return{...b,version:5.1,scenario_learning:true,ready_scenarios:ready,scenario_count:Object.keys(c).length,recommendation:ready.length?'Cenários com evidência suficiente podem ser comparados em shadow; nenhuma alteração física automática.':'Continuar coletando evidência real por cenário.',physical_control:false,automatic_changes:false}}

export function buildLearning52(journal=[],now=Date.now()){
  const base=buildLearning51(journal,now);
  const rows=(Array.isArray(journal)?journal:[]).filter(x=>x?.outcome_score!=null&&Number.isFinite(Number(x.outcome_score)));
  const scored=rows.slice(0,60);
  const scenario=(r)=>{
    const h=new Date(Number(r.at||now)).getHours();
    if(Number(r.vpd_delta||0)<-.2)return 'pos_chuva';
    if(Number(r.humidity||0)>=85)return 'umidade_alta';
    if(Number(r.temperature||0)>=32||Number(r.vpd||0)>=2)return 'calor_seco';
    if(h<6)return 'madrugada';
    if(h<12)return 'manha';
    return 'normal';
  };
  const groups={};
  for(const r of scored){const k=scenario(r);(groups[k]||(groups[k]=[])).push(r)}
  const scenario_performance={};
  for(const [k,list] of Object.entries(groups)){
    const avg=Math.round(list.reduce((a,x)=>a+Number(x.outcome_score),0)/list.length);
    scenario_performance[k]={samples:list.length,average_outcome:avg,ready:list.length>=5,confidence:list.length>=12?'alta':list.length>=5?'média':'baixa'};
  }
  const comparable=scored.filter(x=>Number.isFinite(Number(x.predicted_off_seconds))&&Number.isFinite(Number(x.realized_off_seconds)));
  const mae=comparable.length?Number((comparable.reduce((a,x)=>a+Math.abs(Number(x.predicted_off_seconds)-Number(x.realized_off_seconds)),0)/comparable.length).toFixed(1)):null;
  const validated=Object.values(scenario_performance).filter(x=>x.ready).length;
  return {...base,version:5.2,mode:'shadow_learning',evaluated_samples:scored.length,scenario_performance,validated_scenarios:validated,shadow_validation:{samples:comparable.length,mean_absolute_error_seconds:mae,evidence_ready:comparable.length>=8},recommendation:validated?'Há cenários com evidência suficiente para comparação Shadow; manter validação sem controle físico.':'Continuar coletando resultados reais antes de qualquer evolução de autonomia.',physical_control:false,automatic_changes:false,commands_sent:0};
}
