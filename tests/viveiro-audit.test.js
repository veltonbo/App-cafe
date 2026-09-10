import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const manager=fs.readFileSync('server/continuous/seconds-manager.js','utf8');
const dashboard=fs.readFileSync('server/api/viveiro/dashboard.js','utf8');
const html=fs.readFileSync('public/irrigacao/index.html','utf8');
const ui=fs.readFileSync('public/irrigacao/app.js','utf8');

test('Viveiro possui auditoria operacional a cada cinco minutos',()=>{
  assert.match(manager,/OPERATIONAL_AUDIT_MS=5\*60\*1000/);
  assert.match(manager,/runOperationalAudit/);
  assert.match(manager,/operational_audit/);
});

test('Auditoria do Viveiro cobre falhas operacionais relevantes',()=>{
  for(const code of [
    'pulse_overdue',
    'next_pulse_overdue',
    'long_pulse_gap',
    'confirmation_stale',
    'timing_unstable',
    'many_interruptions',
    'restarts_excessive',
    'weather_offline',
    'weather_stale'
  ]){
    assert.ok(manager.includes(code),'ausente: '+code);
  }
});

test('Alertas do Viveiro controlam detectado versus notificado',()=>{
  assert.match(manager,/notified_codes/);
  assert.match(manager,/newIssues=issues\.filter\(x=>!notifiedCodes\.has/);
  assert.match(manager,/cooldownMinutes|viveiro-audit-/);
});

test('Dashboard e interface expõem a auditoria',()=>{
  assert.match(dashboard,/audit:seconds\?\.operational_audit/);
  assert.match(html,/id="auditList"/);
  assert.match(html,/id="auditBadge"/);
  assert.match(ui,/operational_audit/);
  assert.match(ui,/auditCheckedAt/);
});
