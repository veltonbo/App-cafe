import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const monitor=fs.readFileSync('server/cafe/runtime-monitor.js','utf8');
const server=fs.readFileSync('server/cafe/server.js','utf8');
const auth=fs.readFileSync('server/api/_tuya.js','utf8');
const session=fs.readFileSync('server/api/session.js','utf8');
const ui=fs.readFileSync('public/irrigacao/inkbird/app.js','utf8');

test('monitor do Café observa execução automática sem classificar manual imediatamente',()=>{
  assert.match(monitor,/auto_candidates/);
  assert.match(monitor,/now-Number\(candidate\.first_seen_at\|\|now\)<12000/);
  assert.match(monitor,/type:'auto_start'/);
  assert.match(monitor,/type:'auto_complete'/);
  assert.match(server,/CAFE_RUNTIME_MONITOR_MS=10000/);
});

test('proteção climática contínua do Café está ligada ao monitor',()=>{
  assert.match(monitor,/backgroundProtection===true/);
  assert.match(monitor,/encodeDp45Stop/);
  assert.match(monitor,/type:'weather_stop'/);
});

test('sessão segura do Café usa cookie HttpOnly e remove token local',()=>{
  assert.match(auth,/HttpOnly; Secure; SameSite=Strict/);
  assert.match(session,/issueControlSession/);
  assert.match(ui,/ensureSecureSession/);
  assert.match(ui,/store\.settings\.token=''/);
});
