import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('runtime notification modules required by dashboard and diagnostics exist',()=>{assert.equal(fs.existsSync('server/api/irrigation/_telegram.js'),true);assert.match(fs.readFileSync('server/api/irrigation/_telegram.js','utf8'),/telegramNotificationStatus/)});
test('dashboard has no stale weather import',()=>{const s=fs.readFileSync('server/api/viveiro/dashboard.js','utf8');assert.doesNotMatch(s,/effectiveRainNow/)});
test('release image defaults to production port 8080',()=>{const s=fs.readFileSync('smartlife/Dockerfile','utf8');assert.match(s,/ENV PORT=8080/);assert.match(s,/EXPOSE 8080/)});
