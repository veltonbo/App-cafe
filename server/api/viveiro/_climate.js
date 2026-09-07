import { storeGet, storeSet } from '../irrigation/_store.js';

const CONFIG_PATH='IrrigacaoFazenda2E/viveiroClimate/config';
const STATE_PATH='IrrigacaoFazenda2E/viveiroClimate/state';

export function normalizeClimateConfig(raw={}){
  return{
    automatic:Boolean(raw.automatic),
    evaluation_minutes:Math.max(5,Math.min(60,Math.round(Number(raw.evaluation_minutes)||15))),
    max_adjust_percent:Math.max(10,Math.min(40,Math.round(Number(raw.max_adjust_percent)||30))),
    min_change_seconds:Math.max(2,Math.min(20,Math.round(Number(raw.min_change_seconds)||3))),
    enabled:raw.enabled!==false
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

export function climateSuggestion(snapshot={},secondsState={},config={}){
  const cfg=normalizeClimateConfig(config);
  const temperature=metricValue(snapshot?.metrics?.temperature);
  const humidity=metricValue(snapshot?.metrics?.humidity);
  const raining=Boolean(snapshot?.metrics?.rainDetected);
  const current=Math.max(1,Math.min(300,Math.round(Number(secondsState.on_seconds)||30)));
  const base=Math.max(1,Math.min(300,Math.round(Number(secondsState.base_on_seconds)||current)));

  if(raining){
    return{
      useful:false,
      current_on_seconds:current,
      base_on_seconds:base,
      target_on_seconds:current,
      temperature,humidity,
      reason:'Chuva detectada. A proteção por chuva tem prioridade e o tempo de pulso não será alterado.'
    };
  }
  if(temperature==null||humidity==null){
    return{
      useful:false,
      current_on_seconds:current,
      base_on_seconds:base,
      target_on_seconds:current,
      temperature,humidity,
      reason:'Sem temperatura e umidade suficientes para calcular um ajuste seguro.'
    };
  }

  let factor=1;
  let reason='Clima dentro da faixa normal para o tempo-base.';
  if(temperature>=34&&humidity<=40){
    factor=1.30;reason='Temperatura muito alta e umidade baixa: condição de secagem rápida.';
  }else if(temperature>=32&&humidity<=50){
    factor=1.20;reason='Temperatura alta e umidade baixa: maior perda de água.';
  }else if(temperature>=30&&humidity<=60){
    factor=1.10;reason='Clima quente e relativamente seco: necessidade um pouco maior de água.';
  }else if(temperature<=24&&humidity>=85){
    factor=0.85;reason='Temperatura mais baixa e umidade muito alta: secagem mais lenta.';
  }else if(temperature<=27&&humidity>=80){
    factor=0.90;reason='Clima ameno e úmido: menor velocidade de secagem.';
  }

  const maxPct=cfg.max_adjust_percent/100;
  const minTarget=Math.max(1,Math.round(base*(1-maxPct)));
  const maxTarget=Math.min(300,Math.round(base*(1+maxPct)));
  const target=Math.max(minTarget,Math.min(maxTarget,Math.round(base*factor)));
  const delta=Math.abs(target-current);
  const useful=delta>=cfg.min_change_seconds&&target!==current;

  return{
    useful,
    current_on_seconds:current,
    base_on_seconds:base,
    target_on_seconds:target,
    temperature,
    humidity,
    factor,
    reason,
    automatic:cfg.automatic
  };
}
