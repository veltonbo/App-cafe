import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow=fs.readFileSync('.github/workflows/viveiro-weather.yml','utf8');
const server=fs.readFileSync('server/continuous/server.js','utf8');
const dashboard=fs.readFileSync('server/api/viveiro/dashboard.js','utf8');
const ui=fs.readFileSync('public/irrigacao/app.js','utf8');
const html=fs.readFileSync('public/irrigacao/index.html','utf8');

test('diagnóstico manual aponta para Oracle/Tailscale e não para Railway',()=>{
  assert.doesNotMatch(workflow,/^\s*schedule:/m);
  assert.doesNotMatch(workflow,/\/api\/viveiro\/pulse/);
  assert.match(workflow,/workflow_dispatch/);
  assert.match(workflow,/fazenda2e\.tail890201\.ts\.net/);
  assert.doesNotMatch(workflow,/up\.railway\.app/);
  assert.match(workflow,/\/health/);
});

test('fonte do servidor ainda é patchável para isolamento climático no build',()=>{
  assert.match(server,/const intervalMs=4000/);
  assert.doesNotMatch(server,/Math\.min\(4000,configuredMs\)/);
  assert.match(html,/id="weatherCheck"[^>]+value="≈ 4"[^>]+disabled/);
});

test('badge climatico usa o campo realmente persistido pelo Automatico 2.0',()=>{
  assert.match(ui,/drying_level_label\|\|cs\.drying_level/);
});

test('dashboard usa janela temporal e nao o no inteiro de historico',()=>{
  assert.match(dashboard,/readRecentHistory\(\{sinceMs:historySince,limit:60000\}\)/);
  assert.doesNotMatch(dashboard,/storeGet\(ROOT\+'\/history'\)/);
});

test('service worker nao fica preso em cache antigo por uma hora',()=>{
  assert.match(server,/base==='sw\.js'/);
  assert.match(server,/\?'no-cache'/);
});

test('limites visiveis do Automatico 2.0 coincidem com o backend',()=>{
  assert.match(html,/id="evaluationMinutes"[^>]+min="5"[^>]+max="30"/);
  assert.match(html,/id="maxAdjustPercent"[^>]+min="10"[^>]+max="30"/);
});

test('diagnostico nao declara Firebase online sem confirmar leitura',()=>{
  assert.match(dashboard,/firebaseOnline/);
  assert.match(dashboard,/firebase:firebaseOnline\?'online':'offline'/);
});
