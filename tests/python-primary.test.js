import test from 'node:test';
import assert from 'node:assert/strict';
import { pythonEngineDecision, stopPythonEngine } from '../server/continuous/python-engine.js';

const base={
  now:1_000_000,
  enabled:true,
  schedule_inside:true,
  weather_usable:true,
  raining:false,
  emergency:false,
  maintenance:false,
  on_seconds:30,
  off_seconds:120
};

async function decide(extra={}){
  return pythonEngineDecision({...base,...extra});
}

test.after(()=>stopPythonEngine());

test('Python bloqueia ON se automação estiver desativada',async()=>{
  const r=await decide({phase:'ready',enabled:false});
  assert.equal(r.action,'force_off');
  assert.equal(r.reason,'disabled');
  assert.equal(r.relay_wanted,false);
});

test('Python bloqueia por emergência, manutenção, fora do horário, clima indisponível e chuva',async()=>{
  const cases=[
    [{emergency:true},'emergency'],
    [{maintenance:true},'maintenance'],
    [{schedule_inside:false},'outside_schedule'],
    [{weather_usable:false},'weather_unavailable'],
    [{raining:true},'rain']
  ];
  for(const [extra,reason] of cases){
    const r=await decide({phase:'ready',...extra});
    assert.equal(r.action,'force_off');
    assert.equal(r.reason,reason);
    assert.equal(r.relay_wanted,false);
  }
});

test('Python autoriza ON somente em estado pronto e seguro',async()=>{
  const r=await decide({phase:'ready'});
  assert.equal(r.action,'turn_on');
  assert.equal(r.relay_wanted,true);
  assert.equal(r.reason,'cycle_ready');
});

test('Python mantém ON antes do deadline e manda OFF no deadline',async()=>{
  const started=900_000;
  const before=await decide({phase:'on',now:929_000,relay_on_at:started,on_seconds:30});
  assert.equal(before.action,'keep_on');
  assert.equal(before.off_deadline_at,930_000);
  assert.equal(before.remaining_ms,1_000);
  const at=await decide({phase:'on',now:930_000,relay_on_at:started,on_seconds:30});
  assert.equal(at.action,'turn_off');
  assert.equal(at.relay_wanted,false);
  assert.equal(at.remaining_ms,0);
});

test('Python respeita intervalo e só autoriza novo ON quando ele termina',async()=>{
  const offAt=900_000;
  const waiting=await decide({phase:'off',now:1_019_000,relay_off_at:offAt,off_seconds:120});
  assert.equal(waiting.action,'wait');
  assert.equal(waiting.next_on_at,1_020_000);
  assert.equal(waiting.relay_wanted,false);
  const due=await decide({phase:'off',now:1_020_000,relay_off_at:offAt,off_seconds:120});
  assert.equal(due.action,'turn_on');
  assert.equal(due.relay_wanted,true);
});

test('Python limita tempos fora da faixa segura',async()=>{
  const r=await decide({phase:'ready',on_seconds:9999,off_seconds:-40});
  assert.equal(r.on_seconds,300);
  assert.equal(r.off_seconds,1);
});

test('fase desconhecida nunca liga a saída',async()=>{
  const r=await decide({phase:'qualquer_coisa'});
  assert.equal(r.action,'wait');
  assert.equal(r.relay_wanted,false);
  assert.equal(r.reason,'unknown_phase');
});
