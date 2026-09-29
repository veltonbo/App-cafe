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
  const generatedAt=Date.now();
  const weatherAt=num(weather?.checked_at,0),weatherAge=weatherAt?Math.max(0,generatedAt-weatherAt):null;
  const forecastAt=num(forecast?.generated_at,0),forecastAge=forecastAt?Math.max(0,generatedAt-forecastAt):null;
  const rain24=num(forecast?.summary?.precipitation_24h_mm,0),rainProb=num(forecast?.summary?.max_rain_probability_24h,0);
  const allHourly=Array.isArray(forecast?.hourly)?forecast.hourly:[]; const horizon=(n)=>{const h=allHourly.slice(0,n);return{hours:n,rain_mm:Number(h.reduce((a,x)=>a+num(x?.precipitation,0),0).toFixed(1)),rain_probability:Math.round(h.reduce((a,x)=>Math.max(a,num(x?.precipitation_probability,0)),0)),max_temperature:h.length?Math.max(...h.map(x=>num(x?.temperature??x?.temperature_2m,temp)).filter(Number.isFinite)):null}}; const h1=horizon(1),h3=horizon(3),h6=horizon(6),h12=horizon(12),h24=horizon(24); const hourly=allHourly.slice(0,6),rain6=h6.rain_mm,rainProb6=h6.rain_probability;
  const dataQuality={weather:{fresh:weatherAge!=null&&weatherAge<=120000,age_seconds:weatherAge==null?null:Math.round(weatherAge/1000)},forecast:{available:Boolean(forecast?.ok),stale:Boolean(forecast?.stale)||forecastAge!=null&&forecastAge>30*60000,age_minutes:forecastAge==null?null:Math.round(forecastAge/60000)},learning:{samples,stage:learning}};
  const explanations=[];
  explanations.push(rainNow?'Chuva física detectada pela Weather2-2.':'Weather2-2 não detecta chuva neste momento.');
  if(forecast?.ok)explanations.push(`Previsão 24h: ${rain24.toFixed(1)} mm, probabilidade máxima ${Math.round(rainProb)}%.`);
  if(Number.isFinite(vpd))explanations.push(`VPD atual ${vpd.toFixed(2)} kPa.`);
  explanations.push(`Confiança consultiva ${confidence}% (${confidence>=82?'alta':confidence>=62?'média':'baixa'}).`);
  const diagnostics=resultLearning?.diagnostics||{};
  if(diagnostics.degradation)explanations.push(`Aprendizado em degradação: variação ${diagnostics.score_delta??'—'} pontos no resultado recente.`);
  const sourceReliability={weather:dataQuality.weather.fresh?100:45,forecast:dataQuality.forecast.available&&!dataQuality.forecast.stale?95:dataQuality.forecast.available?65:35,learning:samples>=12?90:samples>=5?70:45,controller:controllerOk?100:40,history:recent.length>=5?90:recent.length?65:40};
  const reliabilityScore=Math.round(Object.values(sourceReliability).reduce((a,b)=>a+b,0)/3);
  const climate40={version:'4.1',rain_now:rainNow,horizons:{h1,h3,h6,h12,h24},next_window_risk:rainNow?'bloqueio_chuva_observada':h3.rain_mm>=2&&h3.rain_probability>=60?'alto':h6.rain_probability>=60?'moderado':'baixo',forecast_rain_6h_mm:Number(rain6.toFixed(1)),rain_probability_6h:Math.round(rainProb6),temperature:Number.isFinite(temp)?Number(temp.toFixed(1)):null,humidity:Number.isFinite(humidity)?Math.round(humidity):null,vpd:Number.isFinite(vpd)?Number(vpd.toFixed(2)):null,source_reliability:sourceReliability,reliability_score:reliabilityScore,decision_quality:reliabilityScore>=82?'alta':reliabilityScore>=62?'média':'baixa',physical_control:false};
  const currentOff=Math.max(30,Number(seconds.off_seconds||seconds.base_off_seconds||120));
  const candidateOff=reliabilityScore<62?currentOff:tendency==='MAIOR DEMANDA'?Math.max(60,Math.round(currentOff*.9)):tendency==='MENOR DEMANDA'?Math.min(300,Math.round(currentOff*1.12)):currentOff;
  const shadowDelta=candidateOff-currentOff;
  const auto41={version:'4.1-shadow',mode:'consultivo',current_off_seconds:currentOff,candidate_off_seconds:candidateOff,delta_off_seconds:shadowDelta,would_change:shadowDelta!==0,reliability_score:reliabilityScore,decision:tendency,recommendation:reliabilityScore<62?'Manter ciclo atual até melhorar a confiabilidade dos dados.':shadowDelta<0?'Shadow sugere intervalo menor; somente comparar com o Automático 4.0.':shadowDelta>0?'Shadow sugere intervalo maior; somente comparar com o Automático 4.0.':'Manter configuração atual.',validation:{eligible:reliabilityScore>=82&&samples>=8,minimum_reliability:82,minimum_samples:8,samples,reason:reliabilityScore<82?'Aguardando confiabilidade >= 82%.':samples<8?'Aguardando pelo menos 8 amostras confirmadas.':'Elegível para comparação prolongada em shadow.'},physical_control:false,automatic_changes:false,commands_sent:0};
  const auto42={version:'4.2-simulation',mode:'simulation_only',scenario:tendency,current_off_seconds:currentOff,candidate_off_seconds:candidateOff,expected_effect:shadowDelta<0?'maior frequência de pulsos':shadowDelta>0?'menor frequência de pulsos':'sem alteração',confidence:reliabilityScore,source_reliability:sourceReliability,physical_control:false,automatic_changes:false,commands_sent:0};
  const whatIf={version:'1.0',automatic_4_0:{off_seconds:currentOff,authority:'physical'},automatic_4_1:{off_seconds:candidateOff,authority:'shadow'},automatic_4_2:{off_seconds:candidateOff,authority:'simulation'},expected: auto42.expected_effect,physical_actions:false};
  return{version:4.8,suite_version:5.1,role:'advisory',physical_control:false,controller:'automatic4',evaluated_at:generatedAt,confidence_score:confidence,confidence_label:confidence>=82?'Alta':confidence>=62?'Média':'Baixa',tendency,next_action:next,reason:why,explanations,data_quality:dataQuality,learning_stage:learning,result_samples:samples,result_score:Math.round(outcome),learning_diagnostics:diagnostics,climate_3_1:{weather_fresh:dataQuality.weather.fresh,forecast_stale:dataQuality.forecast.stale,rain_now:rainNow,rain_24h_mm:Number(rain24.toFixed(1)),rain_probability_24h:Math.round(rainProb),agreement:rainNow&&rainProb>=50?'confirmado':rainNow&&rainProb<50?'chuva_observada_nao_prevista':!rainNow&&rainProb>=70?'chuva_prevista_ainda_nao_observada':'sem_conflito',physical_control:false},climate_3_2:{weather_fresh:dataQuality.weather.fresh,weather_age_seconds:dataQuality.weather.age_seconds,forecast_stale:dataQuality.forecast.stale,forecast_age_minutes:dataQuality.forecast.age_minutes,rain_now:rainNow,observed_rain_mm:num(weather?.rain_mm,num(weather?.precipitation_mm,null)),forecast_rain_24h_mm:Number(rain24.toFixed(1)),rain_probability_24h:Math.round(rainProb),temperature:Number.isFinite(temp)?Number(temp.toFixed(1)):null,humidity:Number.isFinite(humidity)?Math.round(humidity):null,vpd:Number.isFinite(vpd)?Number(vpd.toFixed(2)):null,agreement:rainNow&&rainProb>=50?'confirmado':rainNow&&rainProb<50?'observada_nao_prevista':!rainNow&&rainProb>=70?'prevista_nao_observada':'sem_conflito',physical_control:false},climate_4_0:climate40,climate_4_1:climate40,automatic_4_1:auto41,automatic_4_2:auto42,what_if:whatIf,climate_3_3:{weather_fresh:dataQuality.weather.fresh,forecast_stale:dataQuality.forecast.stale,rain_now:rainNow,forecast_rain_6h_mm:Number(rain6.toFixed(1)),rain_probability_6h:Math.round(rainProb6),forecast_rain_24h_mm:Number(rain24.toFixed(1)),rain_probability_24h:Math.round(rainProb),temperature:Number.isFinite(temp)?Number(temp.toFixed(1)):null,humidity:Number.isFinite(humidity)?Math.round(humidity):null,vpd:Number.isFinite(vpd)?Number(vpd.toFixed(2)):null,operational_reading:rainNow?'chuva_observada':rain6>=2&&rainProb6>=60?'chuva_relevante_proximas_6h':rainProb6>=60?'possibilidade_chuva_proximas_6h':'sem_sinal_relevante',recommendation:rainNow?'Proteção por chuva observada; aguardar Automático 4.0.':rain6>=2&&rainProb6>=60?'Previsão indica chuva relevante nas próximas 6h; acompanhar antes do próximo ciclo.':'Sem recomendação climática adicional.',physical_control:false},forecast:irrigationForecast(seconds,dailyPlan,resultLearning),observed:{vpd:Number.isFinite(vpd)?Number(vpd.toFixed(2)):null,temperature:Number.isFinite(temp)?Number(temp.toFixed(1)):null,humidity:Number.isFinite(humidity)?Math.round(humidity):null,rain:rainNow},safeguard:'Automático 4.0 continua sendo o único controlador físico; 4.1 permanece em shadow até validação.'};
}
// Compatibilidade de contrato: climate_4_0 version:'4.0'
