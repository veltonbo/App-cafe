import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const manager=fs.readFileSync('server/continuous/seconds-manager.js','utf8');
const store=fs.readFileSync('server/api/irrigation/_store.js','utf8');
const ui=fs.readFileSync('public/irrigacao/app.js','utf8');

test('cada pulso usa pulse_id no inicio e no desfecho',()=>{
  assert.match(manager,/current_pulse_id:pulseId/);
  assert.match(manager,/viveiro_pulse_start[\s\S]*pulse_id:pulseId/);
  assert.match(manager,/viveiro_pulse_complete[\s\S]*pulse_id:pulseId/);
  assert.match(manager,/viveiro_pulse_interrupted[\s\S]*pulse_id:pulseId/);
});

test('historico usa escrita idempotente e retries',()=>{
  assert.match(store,/storeSet\('IrrigacaoFazenda2E\/history\/'\+eventId,payload\)/);
  assert.match(store,/for\(let attempt=1;attempt<=3;attempt\+\+\)/);
  assert.match(store,/throw error/);
});

test('falhas de historico entram em fila e reconciliacao periodica existe',()=>{
  assert.match(manager,/pending_history_events/);
  assert.match(manager,/ACCOUNTING_RECONCILE_MS=5\*60\*1000/);
  assert.match(manager,/reconcileDailyAccounting/);
  assert.match(manager,/history_sync/);
});

test('polling da interface e adaptativo ao SSE',()=>{
  assert.match(ui,/app\.liveConnected\?60000:8000/);
  assert.match(ui,/app\.liveConnected\?60000:15000/);
  assert.doesNotMatch(ui,/loadDashboard\(false\)\},15000/);
  assert.doesNotMatch(ui,/loadStatus\(\)\},30000/);
});
