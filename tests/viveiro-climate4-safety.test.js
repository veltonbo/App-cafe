import test from 'node:test';
import assert from 'node:assert/strict';
import { climate4Decision } from '../server/api/viveiro/_climate4.js';

const now=Date.parse('2026-09-13T15:00:00Z');
const seconds={start_minutes:420,end_minutes:1020,days_mask:127,on_seconds:30,off_seconds:150};
const weather=()=>({ok:true,linked:true,device:{online:true},checked_at:now,metrics:{temperature:{value:34},humidity:{value:45},rainDetected:false}});
for(const [name,modify] of [
  ['temperatura nula',w=>w.metrics.temperature.value=null],
  ['temperatura vazia',w=>w.metrics.temperature.value=''],
  ['temperatura booleana',w=>w.metrics.temperature.value=false],
  ['sensor offline',w=>w.device.online=false],
  ['estação desconectada',w=>w.linked=false],
  ['falha da leitura',w=>w.ok=false],
  ['leitura antiga',w=>w.checked_at=now-11*60000],
  ['relógio inválido',w=>w.checked_at=now+60000],
  ['chuva presente',w=>w.metrics.rainDetected=true],
])test('Automático 4.0 aguarda com '+name,()=>{const w=weather();modify(w);assert.equal(climate4Decision(w,seconds,{},[],{now}).should_irrigate,false)});
test('Automático 4.0 permite avaliar irrigação com leitura válida e horário aberto',()=>assert.equal(climate4Decision(weather(),seconds,{},[],{now}).should_irrigate,true));
test('Automático 4.0 respeita dia desmarcado',()=>assert.equal(climate4Decision(weather(),{...seconds,days_mask:0},{},[],{now}).should_irrigate,false));
test('confiança usa o instante da avaliação e ignora amostras futuras',()=>{
  const base=climate4Decision(weather(),seconds,{},[],{now});
  const d=climate4Decision(weather(),seconds,{},[{ts:now-1000},{ts:now+1000}],{now});
  assert.equal(d.confidence_score,base.confidence_score+1);
});
