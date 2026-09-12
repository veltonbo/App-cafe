import { climate3SynchronizedReading } from './_climate3.js';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function scheduleState(seconds={},now=Date.now()){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Porto_Velho',weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  const dm={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6},day=dm[p.weekday]??0,sec=+p.hour*3600+ +p.minute*60+ +p.second;
  const start=clamp(Number(seconds.start_minutes||0),0,1439)*60,end=clamp(Number(seconds.end_minutes||1440),1,1440)*60,mask=Number(seconds.days_mask??127);
  return{inside:Boolean(mask&(1<<day))&&sec>=start&&sec<end,day,seconds:sec,start,end};
}
function confidenceScore(reading,history=[]){
  let score=reading.fresh?55:0;
  if(reading.confidence==='medium')score+=15;if(reading.confidence==='high')score+=25;
  score+=Math.min(15,history.filter(r=>Number(r?.ts)>Date.now()-3600000).length);
  return clamp(Math.round(score),0,100);
}
export function climate4ShadowSuggestion(snapshot={},seconds={},climateState={},history=[],options={}){
  const now=Number(options.now)||Date.now(),reading=climate3SynchronizedReading(snapshot,climateState,now),schedule=scheduleState(seconds,now);
  const on=clamp(Math.round(Number(seconds.on_seconds||30)),1,300),off=clamp(Math.round(Number(seconds.off_seconds||120)),15,900),baseOff=clamp(Math.round(Number(seconds.base_off_seconds||off)),15,900);
  const raining=Boolean(snapshot?.metrics?.rainDetected),score=confidenceScore(reading,history),trend=Number(reading?.trend?.vpd_slope_per_10m||0),vpd=Number(reading.vpd);
  const base={version:4,mode:'shadow',controls_output:false,evaluated_at:now,current_on_seconds:on,current_off_seconds:off,target_on_seconds:on,target_off_seconds:off,confidence_score:score,confidence_label:score>=80?'Alta':score>=60?'Média':'Baixa',reading,schedule,would_act:false,factors:[],safety:['Horário','Chuva','Watchdog','Tempo máximo ligado','Falha de comunicação']};
  if(raining)return{...base,status:'blocked',decision:'PROTEGER',reason:'Chuva detectada. O 4.0 manteria a irrigação desligada.',factors:['Chuva atual']};
  if(!reading.fresh||!Number.isFinite(vpd))return{...base,status:'observing',decision:'AGUARDAR',reason:'Leitura climática insuficiente ou antiga. Nenhum ajuste seria aplicado.'};
  if(!schedule.inside)return{...base,status:'outside_schedule',decision:'OBSERVAR',reason:'Fora da janela de irrigação. O 4.0 apenas acompanha as condições.'};
  let demand=0;const factors=[];
  if(vpd>=3.5){demand=.32;factors.push('VPD muito alto');}else if(vpd>=2.8){demand=.24;factors.push('VPD alto');}else if(vpd>=2.2){demand=.16;factors.push('VPD elevado');}else if(vpd>=1.7){demand=.07;factors.push('Demanda moderada');}else if(vpd<=.7){demand=-.16;factors.push('Ar muito úmido');}else if(vpd<=1.1){demand=-.08;factors.push('Baixa demanda');}else factors.push('VPD confortável');
  if(trend>=.2){demand+=.06;factors.push('VPD subindo');}else if(trend<=-.2){demand-=.05;factors.push('VPD caindo');}
  const t=Number(reading.temperature),h=Number(reading.humidity);if(t>=36&&h<=48){demand=Math.max(demand,.28);factors.push('Calor + baixa umidade');}
  if(score<60){demand=clamp(demand,-.08,.10);factors.push('Ajuste limitado por baixa confiança');}
  demand=clamp(demand,-.20,.38);
  const targetRaw=clamp(Math.round(baseOff*(1-demand)),Math.round(baseOff*.55),Math.round(baseOff*1.3));
  const maxStep=score>=80?15:score>=60?10:6,target=off+clamp(targetRaw-off,-maxStep,maxStep),delta=target-off;
  const decision=Math.abs(delta)<5?'MANTER':delta<0?'INTENSIFICAR':'REDUZIR';
  return{...base,status:decision==='MANTER'?'stable':'recommendation',decision,target_off_seconds:decision==='MANTER'?off:target,would_act:decision!=='MANTER',demand_percent:Number((demand*100).toFixed(1)),factors,reason:decision==='MANTER'?'Condição estável. O 4.0 manteria o ciclo atual.':`${factors.slice(0,2).join(' + ')}. O 4.0 sugere ${on}/${off}s → ${on}/${target}s, sem controlar a bomba.`};
}
