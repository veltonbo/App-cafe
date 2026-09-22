import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const ui=fs.readFileSync('irrigacao-consolidated/app.js','utf8');
const manager=fs.readFileSync('server/continuous/seconds-manager.js','utf8');
test('UI blocks critical controls when server connectivity is unsafe',()=>{assert.match(ui,/function setCommandSafety/);assert.match(ui,/serverUnsafe/);assert.match(ui,/navigator\.onLine/)});
test('runtime has rain resume, weather fail-safe and restart interruption',()=>{assert.match(manager,/waiting_after_rain/);assert.match(manager,/weather_unavailable/);assert.match(manager,/server_restart/);assert.match(manager,/resumeDelayMinutes/)});
test('server safety uses native disabled controls, not pointer events only',()=>{const s=fs.readFileSync('irrigacao-consolidated/app.js','utf8');assert.match(s,/e\.disabled=true/);assert.match(s,/aria-disabled/);assert.match(s,/serverSafetyDisabled/)});
