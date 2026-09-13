import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('server/api/viveiro/dashboard.js','utf8').replace(/^import .*;\n/gm,'').replace('export default async function','async function');
const context=vm.createContext({Intl,Date,Number,Math,Set});
vm.runInContext(source,context);
const now=Date.parse('2026-09-13T15:00:00Z');
const seconds={enabled:true,phase:'climate4_wait',start_minutes:420,end_minutes:1020,days_mask:127,climate4_last_evaluated_at:now,climate4_next_review_at:now+300000};
test('espera climática não é classificada como atraso do pulso',()=>{
  const d=context.buildHealth({now,seconds,weatherSnapshot:{linked:true,checked_at:now},history:[{type:'viveiro_pulse_complete',ts:now-3600000}]});
  assert.equal(d.issues.some(x=>x.code==='long_pulse_gap'),false);
});
test('estação com leitura antiga aparece stale no resumo de serviços',()=>{
  const d=context.buildHealth({now,seconds:{enabled:false},weatherSnapshot:{linked:true,checked_at:now-3600000}});
  assert.equal(d.services.weather,'stale');assert.ok(d.issues.some(x=>x.code==='weather_stale'));
});
test('parada de emergência não cobra avaliações do controlador antigo',()=>{
  const d=context.buildHealth({now,seconds:{...seconds,enabled:false,phase:'emergency_stopped'},safety:{emergency_latched:true},climateState:{last_mode:'automatic',last_evaluated_at:now-3600000},weatherSnapshot:{linked:true,checked_at:now}});
  assert.equal(d.issues.some(x=>x.code==='climate_evaluation_stale'),false);
  assert.ok(d.issues.some(x=>x.code==='emergency'));
});
