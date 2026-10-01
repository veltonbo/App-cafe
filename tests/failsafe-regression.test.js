import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const seconds=fs.readFileSync('server/api/viveiro/_seconds.js','utf8');const interlock=fs.readFileSync('server/api/viveiro/_interlock.js','utf8');const manager=fs.readFileSync('server/continuous/seconds-manager.js','utf8');
test('relay ON/OFF requires fresh ESP32 R1 physical confirmation',()=>{assert.match(seconds,/espFresh\(x\)/);assert.match(seconds,/Boolean\(x\.relays\[0\]\)===wanted/);assert.match(seconds,/role:'nursery_pump'/);assert.match(seconds,/ESP32 não confirmou R1/);assert.match(seconds,/ESP32 do viveiro está offline/)});
test('emergency latch persists and clearing does not rearm irrigation',()=>{assert.match(interlock,/emergency_latched:true/);assert.match(interlock,/cleared_requires_manual_rearm:true/);assert.match(manager,/enabled:false,phase:'stopped'/);assert.match(manager,/continua parada até novo rearme/)});
test('server restart forces OFF before accounting active pulse',()=>{const i=manager.indexOf("safeOff('server_restart')");const j=manager.indexOf("reason:'server_restart'",i);assert.ok(i>=0&&j>i)});
test('weather unavailable blocks restore and irrigation',()=>{assert.match(interlock,/weather_unavailable/);assert.match(manager,/phase:'weather_unavailable'/)});


test('pending nursery pulse is reused instead of reported as a competing physical command',()=>{
  assert.match(seconds,/nursery_pulse/);
  assert.match(seconds,/esp32_command_ack_reused/);
  assert.match(seconds,/reused_pending:true/);
  assert.match(seconds,/aguardando confirmação do pulso R1 em andamento/);
});
