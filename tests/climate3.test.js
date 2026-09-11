import test from 'node:test';
import assert from 'node:assert/strict';
import { climate3ShadowSuggestion, climate3SynchronizedReading } from '../server/api/viveiro/_climate3.js';
import { vaporPressureDeficit } from '../server/api/viveiro/_climate.js';

const NOW=new Date('2026-09-08T14:00:00Z').getTime();
function snapshot({temperature=37.4,humidity=39,rainDetected=false,checked_at=NOW}={}){
  return{checked_at,metrics:{temperature:{value:temperature},humidity:{value:humidity},rainDetected}};
}
function samples({temperature=37.4,humidity=39,count=6,slope=true}={}){
  return Array.from({length:count},(_,i)=>{
    const t=temperature-(slope?(count-1-i)*0.3:0);
    const h=humidity+(slope?(count-1-i)*1.0:0);
    return{ts:NOW-(count-1-i)*5*60000,observation_ts:NOW-(count-1-i)*5*60000,temperature:t,humidity:h,vpd:vaporPressureDeficit(t,h)};
  });
}
function seconds(extra={}){
  return{enabled:true,days_mask:127,start_minutes:8*60,end_minutes:12*60,base_on_seconds:30,base_off_seconds:120,on_seconds:30,off_seconds:90,daily_irrigated_seconds:1200,...extra};
}

test('leitura sincronizada calcula VPD da temperatura e umidade atuais',()=>{
  const reading=climate3SynchronizedReading(snapshot({temperature:28.6,humidity:62}),{samples:[]},NOW);
  assert.equal(reading.fresh,true);
  assert.ok(reading.vpd>1.4&&reading.vpd<1.6);
});

test('leitura antiga nunca reutiliza VPD antigo como atual',()=>{
  const reading=climate3SynchronizedReading(snapshot({temperature:28.6,humidity:62,checked_at:NOW-11*60000}),{samples:samples()},NOW);
  assert.equal(reading.fresh,false);
  assert.equal(reading.vpd,null);
  assert.equal(reading.confidence,'low');
});

test('Automatico 3.0 shadow nunca controla a saida',()=>{
  const result=climate3ShadowSuggestion(snapshot(),seconds(),{samples:samples()},{now:NOW});
  assert.equal(result.version,3);assert.equal(result.mode,'shadow');assert.equal(result.controls_output,false);
});

test('Automatico 3.0 sugere reduzir intervalo em calor seco persistente',()=>{
  const result=climate3ShadowSuggestion(snapshot(),seconds(),{samples:samples()},{now:NOW});
  assert.equal(result.confidence,'high');assert.ok(result.vpd>3);assert.equal(result.target_on_seconds,30);assert.ok(result.target_off_seconds<90);assert.ok(result.target_off_seconds>=75);assert.equal(result.would_act,true);
});

test('Automatico 3.0 nao sugere acao fora da janela',()=>{
  const result=climate3ShadowSuggestion(snapshot({temperature:38,humidity:35}),seconds({start_minutes:12*60,end_minutes:14*60}),{samples:samples()},{now:NOW});
  assert.equal(result.status,'outside_schedule');assert.equal(result.would_act,false);assert.equal(result.target_off_seconds,90);
});

test('Automatico 3.0 respeita chuva como prioridade',()=>{
  const result=climate3ShadowSuggestion(snapshot({temperature:38,humidity:35,rainDetected:true}),seconds(),{samples:samples()},{now:NOW});
  assert.equal(result.level,'chuva');assert.equal(result.would_act,false);assert.equal(result.target_off_seconds,90);
});

test('Automatico 3.0 aguarda quando confianca esta baixa',()=>{
  const result=climate3ShadowSuggestion(snapshot({temperature:38,humidity:35}),seconds(),{samples:samples({count:1})},{now:NOW});
  assert.equal(result.confidence,'low');assert.equal(result.status,'observing');assert.equal(result.would_act,false);
});

test('Automatico 3.0 limita aumento quando acumulado diario esta excessivo',()=>{
  const base=climate3ShadowSuggestion(snapshot(),seconds({daily_irrigated_seconds:1200}),{samples:samples()},{now:NOW});
  const excessive=climate3ShadowSuggestion(snapshot(),seconds({daily_irrigated_seconds:8000}),{samples:samples()},{now:NOW});
  assert.ok(excessive.target_off_seconds>=base.target_off_seconds);assert.ok(excessive.safeguards.length>0);
});
