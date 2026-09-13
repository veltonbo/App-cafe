import { climate3SynchronizedReading } from './_climate3.js';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function metricValue(metric){const raw=metric?.value;if(raw==null||typeof raw==='boolean'||(typeof raw==='string'&&!raw.trim()))return null;const n=Number(raw);return Number.isFinite(n)?n:null}
const scheduleFormatter=new Intl.DateTimeFormat('en-US',{timeZone:'America/Porto_Velho',weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
function scheduleState(seconds={},now=Date.now()){
  const p=Object.fromEntries(scheduleFormatter.formatToParts(new Date(now)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  const dm={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6},day=dm[p.weekday]??0,sec=+p.hour*3600+ +p.minute*60+ +p.second;
  const start=clamp(Number(seconds.start_minutes||0),0,1439)*60,end=clamp(Number(seconds.end_minutes||1440),1,1440)*60,mask=Number(seconds.days_mask??127);
  return{inside:Boolean(mask&(1<<day))&&sec>=start&&sec<end,day,seconds:sec,start,end};
}
function confidenceScore(reading,history=[],now=Date.now()){
  let score=reading.fresh?55:0;
  if(reading.confidence==='medium')score+=15;if(reading.confidence==='high')score+=25;
  score+=Math.min(15,history.filter(r=>Number(r?.ts)>now-3600000&&Number(r?.ts)<=now).length);
  return clamp(Math.round(score),0,100);
}
function intensityPercent(on,off,baseOn,baseOff){
  const baseDuty=baseOn/(baseOn+baseOff),duty=on/(on+off);
  return baseDuty>0?Number((((duty/baseDuty)-1)*100).toFixed(1)):0;
}
function rainContext(snapshot={},seconds={},now=Date.now()){
  const metrics=snapshot?.metrics||{};
  const values=[metrics.rain24h,metrics.rainToday,metrics.rainGeneric].map(metricValue).filter(Number.isFinite);
  const rain24h=values.length?Math.max(...values):0;
  const lastRainAt=Number(seconds.rain_last_at||snapshot?.state?.lastRainAt||0);
  const hoursSinceRain=lastRainAt>0?Math.max(0,(now-lastRainAt)/3600000):null;
  return{raining:Boolean(metrics.rainDetected),rain24h_mm:Number(rain24h.toFixed(2)),last_rain_at:lastRainAt||null,hours_since_rain:hoursSinceRain==null?null:Number(hoursSinceRain.toFixed(1))};
}

export function climate4Decision(snapshot={},seconds={},climateState={},history=[],options={}){
  const now=Number(options.now)||Date.now(),reading=climate3SynchronizedReading(snapshot,climateState,now),schedule=scheduleState(seconds,now);
  const on=clamp(Math.round(Number(seconds.on_seconds||30)),1,300),off=clamp(Math.round(Number(seconds.off_seconds||120)),15,900),baseOn=clamp(Math.round(Number(seconds.base_on_seconds||on)),1,300),baseOff=clamp(Math.round(Number(seconds.base_off_seconds||off)),15,900);
  const score=confidenceScore(reading,history,now),trend=Number(reading?.trend?.vpd_slope_per_10m||0),vpd=Number(reading.vpd),t=Number(reading.temperature),h=Number(reading.humidity),rain=rainContext(snapshot,seconds,now);
  const currentIntensity=intensityPercent(on,off,baseOn,baseOff);
  const base={version:4,mode:'automatic',controls_output:true,evaluated_at:now,current_on_seconds:on,current_off_seconds:off,base_on_seconds:baseOn,base_off_seconds:baseOff,current_intensity_percent:currentIntensity,target_on_seconds:on,target_off_seconds:off,confidence_score:score,confidence_label:score>=80?'Alta':score>=60?'Média':'Baixa',reading,schedule,rain,would_act:false,factors:[],safety:['Horário','Chuva','Umidade/VPD','Chuva recente','Watchdog','Tempo máximo ligado','Falha de comunicação']};
  if(!schedule.inside)return{...base,status:'outside_schedule',decision:'AGUARDAR',should_irrigate:false,review_after_seconds:300,reason:'Fora da janela programada.'};
  if(rain.raining)return{...base,status:'blocked',decision:'NÃO IRRIGAR',should_irrigate:false,review_after_seconds:300,reason:'Chuva detectada agora. Irrigação bloqueada.'};
  if(!reading.fresh||reading.vpd==null||!Number.isFinite(vpd))return{...base,status:'observing',decision:'AGUARDAR',should_irrigate:false,review_after_seconds:180,reason:'Leitura climática insuficiente ou antiga. Por segurança, o 4.0 aguarda nova leitura.'};

  const coolHumid=Number.isFinite(t)&&Number.isFinite(h)&&t<=27&&h>=70&&vpd<=1.1;
  const veryHumidCool=Number.isFinite(t)&&Number.isFinite(h)&&t<=26&&h>=76&&vpd<=0.75;
  const recentRain=rain.hours_since_rain!=null&&rain.hours_since_rain<=12;
  const meaningfulRain=rain.rain24h_mm>=1.5;
  if(veryHumidCool||(coolHumid&&(recentRain||meaningfulRain))){
    const why=[];
    if(veryHumidCool)why.push('tempo fresco e muito úmido');
    if(recentRain)why.push('chuva recente');
    if(meaningfulRain)why.push('chuva acumulada nas últimas 24h');
    return{...base,status:'resting',decision:'NÃO IRRIGAR AGORA',should_irrigate:false,review_after_seconds:300,would_act:true,factors:why,reason:why.join(' + ')+'. O viveiro será reavaliado em 5 minutos antes de qualquer novo pulso.'};
  }

  let demand=0;const factors=[];
  if(vpd>=3.5){demand=.32;factors.push('VPD muito alto');}else if(vpd>=2.8){demand=.24;factors.push('VPD alto');}else if(vpd>=2.2){demand=.16;factors.push('VPD elevado');}else if(vpd>=1.7){demand=.07;factors.push('Demanda moderada');}else if(vpd<=.7){demand=-.35;factors.push('Ar muito úmido');}else if(vpd<=1.1){demand=-.20;factors.push('Baixa demanda');}else factors.push('VPD confortável');
  if(trend>=.2){demand+=.06;factors.push('VPD subindo');}else if(trend<=-.2){demand-=.05;factors.push('VPD caindo');}
  if(t>=36&&h<=48){demand=Math.max(demand,.28);factors.push('Calor + baixa umidade');}
  if(rain.rain24h_mm>=0.5){demand-=.08;factors.push('Chuva recente reduz necessidade');}
  if(score<60){demand=clamp(demand,-.12,.10);factors.push('Ajuste limitado por baixa confiança');}
  demand=clamp(demand,-.45,.38);

  const maxOff=Math.min(900,Math.round(baseOff*2.5));
  const targetRaw=clamp(Math.round(baseOff*(1-demand)),Math.round(baseOff*.55),maxOff);
  const maxStep=score>=80?30:score>=60?20:10,target=off+clamp(targetRaw-off,-maxStep,maxStep),delta=target-off;
  const targetIntensity=intensityPercent(on,target,baseOn,baseOff);
  let decision='MANTER';
  if(Math.abs(delta)>=5){if(delta<0)decision='INTENSIFICAR';else decision='REDUZIR';}
  const reason=decision==='MANTER'?`Condição estável. Mantém ${on}/${off}s.`:decision==='INTENSIFICAR'?`${factors.slice(0,3).join(' + ')}. Aumenta a frequência: ${on}/${off}s → ${on}/${target}s.`:`${factors.slice(0,3).join(' + ')}. Reduz a frequência: ${on}/${off}s → ${on}/${target}s.`;
  return{...base,status:decision==='MANTER'?'stable':'recommendation',decision,should_irrigate:true,target_off_seconds:decision==='MANTER'?off:target,target_intensity_percent:decision==='MANTER'?currentIntensity:targetIntensity,would_act:decision!=='MANTER',demand_percent:Number((demand*100).toFixed(1)),factors,review_after_seconds:300,reason};
}

export function climate4ShadowSuggestion(snapshot={},seconds={},climateState={},history=[],options={}){
  const d=climate4Decision(snapshot,seconds,climateState,history,options);
  return{...d,mode:'automatic',controls_output:true};
}
