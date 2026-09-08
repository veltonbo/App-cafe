import { storeGet, storeSet } from '../irrigation/_store.js';

const CONFIG_PATH='IrrigacaoFazenda2E/viveiroClimate/config';
const STATE_PATH='IrrigacaoFazenda2E/viveiroClimate/state';

export function normalizeClimateConfig(raw={}){
  return{
    automatic:Boolean(raw.automatic),
    observation:raw.observation===undefined?true:Boolean(raw.observation),
    trend_minutes:Math.max(20,Math.min(60,Math.round(Number(raw.trend_minutes)||30))),
    evaluation_minutes:Math.max(5,Math.min(30,Math.round(Number(raw.evaluation_minutes)||5))),
    max_adjust_percent:Math.max(10,Math.min(30,Math.round(Number(raw.max_adjust_percent)||30))),
    min_change_seconds:Math.max(2,Math.min(20,Math.round(Number(raw.min_change_seconds)||3))),
    min_change_off_seconds:Math.max(3,Math.min(30,Math.round(Number(raw.min_change_off_seconds)||6))),
    cooldown_minutes:Math.max(20,Math.min(90,Math.round(Number(raw.cooldown_minutes)||30))),
    normal_confirmations:Math.max(2,Math.min(4,Math.round(Number(raw.normal_confirmations)||2))),
    post_rain_hold_minutes:Math.max(15,Math.min(60,Math.round(Number(raw.post_rain_hold_minutes)||30))),
    enabled:raw.enabled!==false,
    version:2
  };
}

export async function getClimateConfig(){
  return normalizeClimateConfig((await storeGet(CONFIG_PATH).catch(()=>null))||{});
}

export async function setClimateConfig(input={}){
  const cfg=normalizeClimateConfig(input);
  const payload={...cfg,updated_at:Date.now()};
  await storeSet(CONFIG_PATH,payload);
  return payload;
}

export async function getClimateState(){
  return (await storeGet(STATE_PATH).catch(()=>null))||{};
}

export async function patchClimateState(patch={}){
  const current=await getClimateState();
  const next={...current,...patch,updated_at:Date.now()};
  await storeSet(STATE_PATH,next);
  return next;
}

export async function approveClimateSuggestion(id){
  const current=await getClimateState();
  if(!current?.pending||String(current.pending.id||'')!==String(id||'')){
    throw new Error('Sugestão climática não encontrada ou já atualizada.');
  }
  return patchClimateState({approved_id:String(id),rejected_id:null});
}

export async function rejectClimateSuggestion(id){
  const current=await getClimateState();
  if(!current?.pending||String(current.pending.id||'')!==String(id||'')){
    throw new Error('Sugestão climática não encontrada ou já atualizada.');
  }
  return patchClimateState({
    rejected_id:String(id),
    approved_id:null,
    pending:null,
    last_rejected_at:Date.now()
  });
}

function metricValue(row){
  const n=Number(row?.value);
  return Number.isFinite(n)?n:null;
}

export function vaporPressureDeficit(temperature,humidity){
  const t=Number(temperature),rh=Number(humidity);
  if(!Number.isFinite(t)||!Number.isFinite(rh))return null;
  const boundedRh=Math.max(1,Math.min(100,rh));
  const saturation=0.6108*Math.exp((17.27*t)/(t+237.3));
  return Math.max(0,saturation*(1-boundedRh/100));
}

export function updateClimateSamples(existing=[],snapshot={},config={},now=Date.now()){
  const cfg=normalizeClimateConfig(config);
  const temperature=metricValue(snapshot?.metrics?.temperature);
  const humidity=metricValue(snapshot?.metrics?.humidity);
  const samples=Array.isArray(existing)?existing.filter(x=>x&&Number(x.ts)>0):[];
  if(temperature!=null&&humidity!=null){
    samples.push({ts:now,temperature,humidity,vpd:vaporPressureDeficit(temperature,humidity)});
  }
  const cutoff=now-Math.max(20,Number(cfg.trend_minutes||30))*60000;
  return samples.filter(x=>Number(x.ts)>=cutoff).slice(-72);
}

function linearDelta(rows,key){
  if(rows.length<2)return 0;
  const first=Number(rows[0]?.[key]),last=Number(rows[rows.length-1]?.[key]);
  return Number.isFinite(first)&&Number.isFinite(last)?last-first:0;
}

export function climateTrend(samples=[],now=Date.now()){
  const rows=(Array.isArray(samples)?samples:[])
    .filter(x=>Number.isFinite(Number(x.temperature))&&Number.isFinite(Number(x.humidity)))
    .sort((a,b)=>Number(a.ts||0)-Number(b.ts||0));
  if(!rows.length)return{
    samples:0,temperature:null,humidity:null,vpd:null,temp_range:null,humidity_range:null,
    temp_delta:0,humidity_delta:0,vpd_delta:0,age_minutes:null,confidence:'low',confidence_label:'Baixa'
  };
  const temps=rows.map(x=>Number(x.temperature));
  const hums=rows.map(x=>Number(x.humidity));
  const vpds=rows.map(x=>Number.isFinite(Number(x.vpd))?Number(x.vpd):vaporPressureDeficit(x.temperature,x.humidity));
  const avg=a=>a.reduce((s,x)=>s+x,0)/a.length;
  const tempRange=Math.max(...temps)-Math.min(...temps);
  const humRange=Math.max(...hums)-Math.min(...hums);
  const ageMinutes=Math.max(0,(now-Number(rows[rows.length-1].ts||now))/60000);
  const vpdDelta=vpds.length>=2?vpds[vpds.length-1]-vpds[0]:0;
  let confidence='low';
  if(rows.length>=5&&ageMinutes<=10&&tempRange<=5&&humRange<=25)confidence='high';
  else if(rows.length>=3&&ageMinutes<=15&&tempRange<=7&&humRange<=35)confidence='medium';
  return{
    samples:rows.length,
    temperature:avg(temps),
    humidity:avg(hums),
    vpd:avg(vpds),
    temp_range:tempRange,
    humidity_range:humRange,
    temp_delta:linearDelta(rows,'temperature'),
    humidity_delta:linearDelta(rows,'humidity'),
    vpd_delta:vpdDelta,
    age_minutes:ageMinutes,
    confidence,
    confidence_label:confidence==='high'?'Alta':confidence==='medium'?'Média':'Baixa'
  };
}

function dryingLevel(vpd){
  if(vpd<=0.55)return{level:'muito_umido',factor:.85,label:'Muito úmido'};
  if(vpd<=0.85)return{level:'umido',factor:.92,label:'Úmido'};
  if(vpd<=1.55)return{level:'normal',factor:1,label:'Normal'};
  if(vpd<=2.0)return{level:'secando',factor:1.10,label:'Secando mais rápido'};
  if(vpd<=2.5)return{level:'seco',factor:1.20,label:'Seco'};
  return{level:'muito_seco',factor:1.30,label:'Muito quente/seco'};
}

export function climateSuggestion(snapshot={},secondsState={},config={},trendData=null){
  const cfg=normalizeClimateConfig(config);
  const instantTemperature=metricValue(snapshot?.metrics?.temperature);
  const instantHumidity=metricValue(snapshot?.metrics?.humidity);
  const temperature=Number.isFinite(Number(trendData?.temperature))?Number(trendData.temperature):instantTemperature;
  const humidity=Number.isFinite(Number(trendData?.humidity))?Number(trendData.humidity):instantHumidity;
  const vpd=Number.isFinite(Number(trendData?.vpd))?Number(trendData.vpd):vaporPressureDeficit(temperature,humidity);
  const raining=Boolean(snapshot?.metrics?.rainDetected);

  const baseOn=Math.max(1,Math.min(300,Math.round(Number(secondsState.base_on_seconds)||30)));
  const baseOff=Math.max(1,Math.min(900,Math.round(Number(secondsState.base_off_seconds)||120)));
  const currentOn=Math.max(1,Math.min(300,Math.round(Number(secondsState.on_seconds)||baseOn)));
  const currentOff=Math.max(1,Math.min(900,Math.round(Number(secondsState.off_seconds)||baseOff)));

  if(raining){
    return{
      useful:false,current_on_seconds:currentOn,current_off_seconds:currentOff,
      base_on_seconds:baseOn,base_off_seconds:baseOff,target_on_seconds:currentOn,target_off_seconds:currentOff,
      temperature,humidity,vpd,confidence:trendData?.confidence||'low',confidence_label:trendData?.confidence_label||'Baixa',
      trend:trendData||null,level:'chuva',level_label:'Chuva',
      reason:'Chuva detectada. A proteção por chuva tem prioridade e o Automático 2.0 não altera o ciclo.'
    };
  }

  if(temperature==null||humidity==null||vpd==null){
    return{
      useful:false,current_on_seconds:currentOn,current_off_seconds:currentOff,
      base_on_seconds:baseOn,base_off_seconds:baseOff,target_on_seconds:currentOn,target_off_seconds:currentOff,
      temperature,humidity,vpd,confidence:trendData?.confidence||'low',confidence_label:trendData?.confidence_label||'Baixa',
      trend:trendData||null,level:'sem_dados',level_label:'Sem dados',
      reason:'Sem temperatura e umidade suficientes para calcular um ajuste seguro.'
    };
  }

  const drying=dryingLevel(vpd);
  let factor=drying.factor;
  const vpdDelta=Number(trendData?.vpd_delta||0);

  // A tendência antecipa pequenas mudanças, mas nunca ultrapassa o limite configurado.
  if(vpdDelta>=0.25)factor+=0.05;
  else if(vpdDelta<=-0.25)factor-=0.05;

  // Situações extremas recebem o teto permitido.
  if(temperature>=35&&humidity<=40)factor=Math.max(factor,1.30);
  if(temperature<=23&&humidity>=90)factor=Math.min(factor,.85);

  const maxPct=cfg.max_adjust_percent/100;
  factor=Math.max(1-maxPct,Math.min(1+maxPct,factor));

  // Automático 2.0: preserva o pulso-base configurado e ajusta principalmente o intervalo.
  const baseDuty=baseOn/(baseOn+baseOff);
  const targetDuty=Math.max(.08,Math.min(.45,baseDuty*factor));
  const targetOn=baseOn;
  const targetOff=Math.max(30,Math.min(900,Math.round(targetOn*(1-targetDuty)/targetDuty)));

  const returningToBase=targetOn===baseOn&&targetOff===baseOff&&(currentOn!==baseOn||currentOff!==baseOff);
  const deltaOn=Math.abs(targetOn-currentOn);
  const deltaOff=Math.abs(targetOff-currentOff);
  const useful=(deltaOn>=cfg.min_change_seconds||deltaOff>=cfg.min_change_off_seconds||returningToBase)&&
    (targetOn!==currentOn||targetOff!==currentOff);

  let reason='';
  if(returningToBase){
    reason='As condições voltaram ao normal. O sistema pode retornar ao ciclo-base de '+baseOn+' s ligado / '+baseOff+' s desligado.';
  }else if(drying.level==='normal'){
    reason='Pressão de secagem normal. Mantendo o ciclo-base.';
  }else{
    const trendText=vpdDelta>=0.25?' e a tendência ainda está secando':vpdDelta<=-0.25?' e a tendência está ficando mais úmida':'';
    reason=drying.label+' (VPD '+vpd.toFixed(2)+' kPa)'+trendText+'. Ajuste feito principalmente no intervalo entre os pulsos.';
  }

  return{
    useful,
    returning_to_base:returningToBase,
    current_on_seconds:currentOn,current_off_seconds:currentOff,
    base_on_seconds:baseOn,base_off_seconds:baseOff,
    target_on_seconds:targetOn,target_off_seconds:targetOff,
    temperature,humidity,vpd,
    factor,
    water_factor:factor,
    level:drying.level,
    level_label:drying.label,
    confidence:trendData?.confidence||'low',
    confidence_label:trendData?.confidence_label||'Baixa',
    trend:trendData||null,
    reason,
    automatic:cfg.automatic,
    observation:cfg.observation,
    version:2
  };
}

// publish-auto2-20260907
