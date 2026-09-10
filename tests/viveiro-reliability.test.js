import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const manager=fs.readFileSync('server/continuous/seconds-manager.js','utf8');
const store=fs.readFileSync('server/api/irrigation/_store.js','utf8');
const ui=fs.readFileSync('public/irrigacao/app.js','utf8');
const dashboard=fs.readFileSync('server/api/viveiro/dashboard.js','utf8');

test('cada pulso usa pulse_id no inicio e no desfecho',()=>{
  assert.match(manager,/current_pulse_id:pulseId/);
  assert.match(manager,/viveiro_pulse_start[\s\S]*pulse_id:pulseId/);
  assert.match(manager,/viveiro_pulse_complete[\s\S]*pulse_id:pulseId/);
  assert.match(manager,/viveiro_pulse_interrupted[\s\S]*pulse_id:pulseId/);
});

test('historico usa escrita idempotente, indice temporal e retries',()=>{
  assert.match(store,/storeSet\(HISTORY_PATH\+'\/'\+eventId,payload\)/);
  assert.match(store,/storeSet\(HISTORY_TIME_PATH\+'\/'\+timeKey,payload\)/);
  assert.match(store,/readRecentHistory/);
  assert.match(store,/orderBy:'\$key'/);
  assert.match(store,/for\(let attempt=1;attempt<=3;attempt\+\+\)/);
  assert.match(store,/throw error/);
  assert.doesNotMatch(manager,/orderBy:'ts'/);
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

test('dashboard nao carrega o historico inteiro do Firebase',()=>{
  assert.doesNotMatch(dashboard,/storeGet\(ROOT\+'\/history'\)/);
  assert.match(dashboard,/readRecentHistory/);
  assert.match(dashboard,/historySince=now-32\*86400000/);
});

test('retomada apos chuva usa a configuracao atual sem exigir rearme',()=>{
  assert.match(manager,/resumeDelayMinutes:Math\.max\(0,Number\(cfg\?\.resumeDelayMinutes/);
  assert.match(manager,/w\.resumeDelayMinutes\?\?state\.resume_delay_minutes/);
});

test('SSE de protecao nao dispara refresh completo do dashboard',()=>{
  const protectionStart=ui.indexOf("event.type==='protection'");
  const confirmationStart=ui.indexOf("event.type==='confirmation'",protectionStart);
  assert.ok(protectionStart>=0);
  assert.ok(confirmationStart>protectionStart);
  const protectionBranch=ui.slice(protectionStart,confirmationStart);
  assert.doesNotMatch(protectionBranch,/loadDashboard/);
});

test('rearmar ciclo preserva contadores do dia e reinício fecha pulso ativo',()=>{
  assert.match(manager,/const dailySnapshot=\{/);
  assert.match(manager,/\.\.\.dailySnapshot/);
  assert.match(manager,/Pulso interrompido por reinício do servidor/);
  assert.match(manager,/reason:'server_restart'/);
});

test('reconciliação do dia é não destrutiva e recupera snapshot anterior',()=>{
  assert.match(manager,/recoverDailyCountersFromReconciliation/);
  assert.match(manager,/source:'pre_reconciliation_snapshot'/);
  assert.match(manager,/status:mismatch\?'mismatch':'ok'/);
  assert.match(manager,/Divergência contábil preservada sem alterar o estado ao vivo/);
  assert.doesNotMatch(manager,/daily_pulses_started:expected\.started/);
  assert.doesNotMatch(manager,/daily_pulses_completed:expected\.completed/);
  assert.doesNotMatch(manager,/daily_irrigated_seconds:expected\.irrigated/);
});

test('dashboard usa contadores ao vivo como fonte do dia atual',()=>{
  assert.match(dashboard,/overlayCurrentDayFromLive/);
  assert.match(dashboard,/const confirmed=completed\+interrupted/);
  assert.match(dashboard,/summary\.today\.irrigated_seconds=irrigated/);
  assert.match(dashboard,/reports\.today=\{/);
});
