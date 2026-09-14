const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;

function irrigationForecast(seconds={},dailyPlan={},resultLearning={}){
  const on=Math.max(1,num(seconds.base_on_seconds||seconds.on_seconds,30));
  const off=Math.max(1,num(seconds.base_off_seconds||seconds.off_seconds,120));
  const start=clamp(num(seconds.start_minutes,360),0,1439);
  const end=clamp(num(seconds.end_minutes,1080),start+1,1440);
  const windowSeconds=(end-start)*60;
  const cycleSeconds=on+off;
  let pulses=Math.floor(windowSeconds/cycleSeconds);
  const rain=num(dailyPlan.rain_probability_24h,0);
  const demand=String(dailyPlan.demand||'normal').toLowerCase();
  let factor=demand==='alta'?1.18:demand==='elevada'?1.10:demand==='baixa'?0.85:1;
  if(rain>=70)factor*=.55; else if(rain>=40)factor*=.78;
  pulses=Math.max(0,Math.round(pulses*factor));
  const irrigatedSeconds=pulses*on;
  const learningSamples=num(resultLearning.samples,0);
  let confidence=num(dailyPlan.confidence==='alta'?88:dailyPlan.confidence==='média'?72:52);
  confidence+=Math.min(7,learningSamples/3);
  confidence=clamp(Math.round(confidence),35,95);
  return{pulses,irrigated_seconds:irrigatedSeconds,rain_probability:rain,demand:demand||'normal',confidence_score:confidence,confidence_label:confidence>=82?'Alta':confidence>=62?'Média':'Baixa'};
}

export function buildIntelligence42({seconds={},weather={},forecast=null,resultLearning={},decisionJournal=[],dailyPlan={}}={}){
  const vpd=num(weather?.metrics?.vpd?.value,num(seconds?.climate4_vpd,NaN));
  const temp=num(weather?.metrics?.temperature?.value,NaN);
  const humidity=num(weather?.metrics?.humidity?.value,NaN);
  const rainNow=Boolean(weather?.metrics?.rainDetected);
  const outcome=num(resultLearning?.average_outcome,75);
  const samples=num(resultLearning?.samples,0);
  const controllerOk=String(seconds?.automatic_controller||'')==='automatic4'&&num(seconds?.automatic_version)===4;
  const recent=(Array.isArray(decisionJournal)?decisionJournal:[]).slice(0,8);
  const outcomes=recent.map(x=>num(x?.outcome_score,NaN)).filter(Number.isFinite);
  const recentOutcome=outcomes.length?outcomes.reduce((a,b)=>a+b,0)/outcomes.length:outcome;
  let confidence=45+(controllerOk?15:0)+Math.min(20,samples*2)+clamp((recentOutcome-60)*.35,0,15);
  if(!Number.isFinite(vpd))confidence-=18;
  confidence=clamp(Math.round(confidence),20,95);
  let tendency='MANTER',why='Condições e resultados recentes estão dentro do padrão.';
  if(rainNow){tendency='MENOR DEMANDA';why='Chuva detectada; a proteção do Automático 4.0 continua prioritária.';}
  else if(Number.isFinite(vpd)&&vpd>=2.5){tendency='MAIOR DEMANDA';why=`VPD ${vpd.toFixed(2)} kPa indica maior demanda atmosférica.`;}
  else if(Number.isFinite(vpd)&&vpd<=0.85){tendency='MENOR DEMANDA';why=`VPD ${vpd.toFixed(2)} kPa indica ambiente úmido e menor demanda.`;}
  else if(['alta','elevada'].includes(String(dailyPlan?.demand||'').toLowerCase())){tendency='MAIOR DEMANDA';why='Plano do dia indica aumento de demanda hídrica.';}
  const next=String(seconds?.phase||'off')==='on'?'Concluir o pulso atual e reavaliar':'Reavaliar clima antes do próximo pulso';
  const learning=samples>=12?'maduro':samples>=5?'em evolução':'coletando';
  return{version:4.2,role:'advisory',physical_control:false,controller:'automatic4',evaluated_at:Date.now(),confidence_score:confidence,confidence_label:confidence>=82?'Alta':confidence>=62?'Média':'Baixa',tendency,next_action:next,reason:why,learning_stage:learning,result_samples:samples,result_score:Math.round(outcome),forecast:irrigationForecast(seconds,dailyPlan,resultLearning),observed:{vpd:Number.isFinite(vpd)?Number(vpd.toFixed(2)):null,temperature:Number.isFinite(temp)?Number(temp.toFixed(1)):null,humidity:Number.isFinite(humidity)?Math.round(humidity):null,rain:rainNow},safeguard:'Automático 4.0 continua sendo o único controlador físico.'};
}
