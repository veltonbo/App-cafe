import { climateTrend, vaporPressureDeficit } from './_climate.js';

function metricValue(metric){
  const raw=metric&&typeof metric==='object'&&'value' in metric?metric.value:metric;
  const n=Number(raw);
  return Number.isFinite(n)?n:null;
}

function localScheduleState(seconds={},now=Date.now()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
    timeZone:'America/Porto_Velho',weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
  }).formatToParts(new Date(now)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  const dayMap={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  const weekday=dayMap[parts.weekday]??0;
  const nowSeconds=Number(parts.hour||0)*3600+Number(parts.minute||0)*60+Number(parts.second||0);
  const start=Math.max(0,Math.min(1439,Number(seconds.start_minutes||0)))*60;
  const end=Math.max(1,Math.min(1440,Number(seconds.end_minutes||1440)))*60;
  const mask=Math.max(0,Number(seconds.days_mask??127));
  const selected=Boolean(mask&(1<<weekday));
  return{
    inside:selected&&nowSeconds>=start&&nowSeconds<end,
    selected,weekday,now_seconds:nowSeconds,start_seconds:start,end_seconds:end
  };
}

function cumulativeStatus(seconds={},now=Date.now()){
  const schedule=localScheduleState(seconds,now);
  const baseOn=Math.max(1,Number(seconds.base_on_seconds||seconds.on_seconds||30));
  const baseOff=Math.max(1,Number(seconds.base_off_seconds||seconds.off_seconds||120));
  const baseDuty=baseOn/(baseOn+baseOff);
  const elapsed=schedule.selected?Math.max(0,Math.min(schedule.now_seconds,schedule.end_seconds)-schedule.start_seconds):0;
  const expected=Math.round(elapsed*baseDuty);
  const actual=Math.max(0,Number(seconds.daily_irrigated_seconds||0));
  const ratio=expected>=120?actual/expected:null;
  return{
    actual_seconds:Math.round(actual),
    expected_base_seconds:expected,
    ratio:ratio==null?null:Number(ratio.toFixed(2)),
    base_duty_percent:Number((baseDuty*100).toFixed(1))
  };
}

function vpdDemand(vpd){
  if(vpd<=0.70)return{level:'muito_umido',label:'Muito úmido',demand:-0.18};
  if(vpd<=1.10)return{level:'umido',label:'Úmido',demand:-0.08};
  if(vpd<=1.70)return{level:'normal',label:'Normal',demand:0};
  if(vpd<=2.20)return{level:'secando',label:'Secando',demand:0.08};
  if(vpd<=2.80)return{level:'seco',label:'Seco',demand:0.16};
  if(vpd<=3.50)return{level:'muito_seco',label:'Muito seco',demand:0.24};
  if(vpd<=4.20)return{level:'severo',label:'Severo',demand:0.32};
  return{level:'critico',label:'Crítico',demand:0.38};
}

function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function toward(current,target,maxStep){
  const diff=target-current;
  if(Math.abs(diff)<=maxStep)return Math.round(target);
  return Math.round(current+Math.sign(diff)*maxStep);
}

export function climate3ShadowSuggestion(snapshot={},seconds={},climateState={},options={}){
  const now=Number(options.now)||Date.now();
  const baseOn=Math.max(1,Math.min(300,Math.round(Number(seconds.base_on_seconds||seconds.on_seconds||30))));
  const baseOff=Math.max(1,Math.min(900,Math.round(Number(seconds.base_off_seconds||seconds.off_seconds||120))));
  const currentOn=Math.max(1,Math.min(300,Math.round(Number(seconds.on_seconds||baseOn))));
  const currentOff=Math.max(1,Math.min(900,Math.round(Number(seconds.off_seconds||baseOff))));
  const schedule=localScheduleState(seconds,now);
  const accumulated=cumulativeStatus(seconds,now);
  const samples=Array.isArray(climateState?.samples)?climateState.samples:[];
  const trend=climateTrend(samples,now);
  const instantTemperature=metricValue(snapshot?.metrics?.temperature);
  const instantHumidity=metricValue(snapshot?.metrics?.humidity);
  const temperature=Number.isFinite(Number(trend.temperature))?Number(trend.temperature):instantTemperature;
  const humidity=Number.isFinite(Number(trend.humidity))?Number(trend.humidity):instantHumidity;
  const instantVpd=vaporPressureDeficit(instantTemperature,instantHumidity);
  const vpd=Number.isFinite(Number(trend.vpd))?Number(trend.vpd):instantVpd;
  const raining=Boolean(snapshot?.metrics?.rainDetected);
  const confidence=String(trend?.confidence||'low');
  const confidenceLabel=String(trend?.confidence_label||'Baixa');

  const base={
    version:3,
    mode:'shadow',
    controls_output:false,
    evaluated_at:now,
    current_on_seconds:currentOn,
    current_off_seconds:currentOff,
    base_on_seconds:baseOn,
    base_off_seconds:baseOff,
    target_on_seconds:currentOn,
    target_off_seconds:currentOff,
    temperature,humidity,vpd,
    confidence,confidence_label:confidenceLabel,
    trend,
    schedule,
    accumulated,
    would_act:false,
    stable_zone:false,
    safeguards:[]
  };

  if(raining){
    return{...base,status:'blocked',level:'chuva',level_label:'Chuva',reason:'Chuva detectada. O 3.0 não faria nenhum ajuste e manteria a proteção por chuva.'};
  }
  if(temperature==null||humidity==null||vpd==null){
    return{...base,status:'observing',level:'sem_dados',level_label:'Sem dados',reason:'Ainda não há temperatura e umidade suficientes para uma decisão segura.'};
  }
  if(!schedule.inside){
    return{...base,status:'outside_schedule',level:'fora_horario',level_label:'Fora do horário',reason:'Modo sombra ativo. O 3.0 observa o clima, mas não tomaria decisão fora da janela de irrigação.'};
  }
  if(confidence==='low'){
    return{...base,status:'observing',level:'baixa_confianca',level_label:'Baixa confiança',reason:'Leituras ainda insuficientes ou instáveis. O 3.0 aguardaria mais dados antes de mudar o ciclo.'};
  }

  const drying=vpdDemand(vpd);
  let demand=drying.demand;
  const safeguards=[];
  const slope=Number(trend?.vpd_slope_per_10m||0);
  if(slope>=0.25)demand+=0.07;
  else if(slope>=0.15)demand+=0.04;
  else if(slope<=-0.25)demand-=0.06;
  else if(slope<=-0.15)demand-=0.03;

  if(Number.isFinite(temperature)&&Number.isFinite(humidity)){
    if(temperature>=39&&humidity<=40)demand=Math.max(demand,0.40);
    else if(temperature>=37&&humidity<=45)demand=Math.max(demand,0.34);
    else if(temperature>=35&&humidity<=48)demand=Math.max(demand,0.27);
  }

  if(confidence==='medium'){
    demand=clamp(demand,-0.12,0.20);
    safeguards.push('Ajuste limitado porque a confiança das leituras é média.');
  }

  const ratio=Number(accumulated.ratio);
  if(Number.isFinite(ratio)&&ratio>1.80&&demand>0){
    demand=0;
    safeguards.push('Aumento bloqueado porque a irrigação acumulada já está muito acima do ciclo-base.');
  }else if(Number.isFinite(ratio)&&ratio>1.55&&demand>0){
    demand*=0.5;
    safeguards.push('Aumento reduzido pela irrigação acumulada do dia.');
  }else if(Number.isFinite(ratio)&&ratio<0.70&&vpd>=2.8&&demand>0){
    demand=Math.min(0.42,demand+0.03);
  }

  demand=clamp(demand,-0.22,0.42);
  const baseDuty=baseOn/(baseOn+baseOff);
  const targetDuty=clamp(baseDuty*(1+demand),0.06,0.55);
  let rawTargetOff=Math.round(baseOn*(1-targetDuty)/targetDuty);
  rawTargetOff=clamp(rawTargetOff,Math.max(15,Math.round(baseOff*0.55)),Math.min(900,Math.round(baseOff*1.30)));

  // Quando o clima normaliza, volta ao ciclo-base devagar em vez de saltar.
  if(drying.level==='normal'&&Math.abs(slope)<0.12){
    rawTargetOff=baseOff;
  }

  const stableThreshold=Math.max(6,Math.round(baseOff*0.05));
  if(Math.abs(rawTargetOff-currentOff)<stableThreshold){
    return{
      ...base,
      status:'stable',
      level:drying.level,
      level_label:drying.label,
      target_off_seconds:currentOff,
      stable_zone:true,
      safeguards,
      demand_percent:Number((demand*100).toFixed(1)),
      reason:'Condição dentro da zona de estabilidade. O 3.0 manteria o ciclo atual para evitar ajustes pequenos e repetitivos.'
    };
  }

  const severe=['severo','critico'].includes(drying.level);
  const maxStep=confidence==='high'?(severe?15:12):8;
  const targetOff=toward(currentOff,rawTargetOff,maxStep);
  const direction=targetOff<currentOff?'aumentaria a irrigação':targetOff>currentOff?'reduziria a irrigação':'manteria o ciclo';
  const trendText=slope>=0.15?'VPD subindo':slope<=-0.15?'VPD caindo':'tendência estável';

  return{
    ...base,
    status:'shadow_recommendation',
    level:drying.level,
    level_label:drying.label,
    target_on_seconds:currentOn,
    target_off_seconds:targetOff,
    raw_target_off_seconds:rawTargetOff,
    would_act:targetOff!==currentOff,
    max_step_seconds:maxStep,
    safeguards,
    demand_percent:Number((demand*100).toFixed(1)),
    reason:`Modo sombra: ${drying.label.toLowerCase()}, ${trendText.toLowerCase()}. O 3.0 ${direction}: ${currentOn}/${currentOff} s → ${currentOn}/${targetOff} s, sem enviar comando à bomba.`
  };
}
