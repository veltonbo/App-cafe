import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const patch=fs.readFileSync('scripts/patch-system-consistency.mjs','utf8');
const reconnect=fs.readFileSync('scripts/patch-smartlife-reauth-ui.mjs','utf8');
const diagnostics=fs.readFileSync('server/api/irrigation/diagnostics.js','utf8');
const dockerfile=fs.readFileSync('smartlife/Dockerfile','utf8');

test('incidentes ativos persistidos são reconciliados mesmo após auditoria limpa',()=>{
  assert.match(patch,/Object\.keys\(activeIncidents\)/);
  assert.match(patch,/knownActiveCodes/);
});

test('Automático 2.0 não acusa atraso durante pausa climática legítima',()=>{
  assert.match(patch,/weather_blocked/);
  assert.match(patch,/waiting_after_rain/);
  assert.match(patch,/weather_unavailable/);
});

test('cartão Smart Life usa estado real de EKAZA e Weather2-2',()=>{
  assert.match(reconnect,/smartLifeOk=deviceOk&&weatherOk/);
  assert.match(reconnect,/CONECTADO/);
  assert.match(reconnect,/ATENÇÃO/);
  assert.doesNotMatch(reconnect,/class=\"badge warn\">DESCONECTADO/);
});

test('diagnóstico de memória diferencia RSS estável de pressão real',()=>{
  assert.match(diagnostics,/rss>1536/);
  assert.match(diagnostics,/windowMinutes>=3&&rate>=20/);
  assert.match(diagnostics,/heap_used_mb/);
});

test('imagem de produção aplica correções de consistência',()=>{
  assert.match(dockerfile,/patch-system-consistency\.mjs/);
});
