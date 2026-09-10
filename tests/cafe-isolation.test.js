import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const store=fs.readFileSync('server/api/irrigation/_store.js','utf8');
const state=fs.readFileSync('server/api/cafe/_state.js','utf8');
const router=fs.readFileSync('server/cafe/router.js','utf8');
const zone=fs.readFileSync('server/api/inkbird/zone.js','utf8');
const group=fs.readFileSync('server/api/inkbird/group.js','utf8');
const status=fs.readFileSync('server/api/inkbird/status.js','utf8');
const schedule=fs.readFileSync('server/api/inkbird/schedule.js','utf8');

test('Configuração e histórico usam namespace exclusivo do Café',()=>{
  assert.match(store,/CAFE_ROOT='IrrigacaoFazenda2E\/cafe'/);
  assert.match(store,/CAFE_ROOT\+'\/history\/'.*eventId/);
  assert.match(store,/CAFE_ROOT\+'\/config'/);
});

test('Sessão ativa, clima e cache de agenda são exclusivos do Café',()=>{
  assert.match(state,/CAFE_ACTIVE_ROOT=CAFE_ROOT\+'\/active'/);
  assert.match(state,/CAFE_WEATHER_STATE=CAFE_ROOT\+'\/weatherState'/);
  assert.match(state,/CAFE_SCHEDULE_ROOT=CAFE_ROOT\+'\/inkbirdSchedules'/);
  assert.match(zone,/getCafeActiveSession/);
  assert.match(group,/getCafeActiveSession/);
  assert.match(status,/getCafeActiveSession/);
  assert.match(schedule,/CAFE_SCHEDULE_ROOT/);
});

test('Sessões do IIC-800 usam session_id e eventos idempotentes',()=>{
  assert.match(zone,/sessionId='cafe-'/);
  assert.match(zone,/event_id:'start-'\+sessionId/);
  assert.match(group,/sessionId='cafe-group-'/);
  assert.match(status,/event_id:'complete-'\+sessionId/);
  assert.match(store,/for\(let attempt=1;attempt<=3;attempt\+\+\)/);
});

test('Roteador do Café não expõe rotas técnicas antigas',()=>{
  assert.equal(router.includes("'irrigation/linkage'"),false);
  assert.equal(router.includes("'inkbird/command'"),false);
  assert.match(router,/'cafe\/dashboard':cafeDashboard/);
});
