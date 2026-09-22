import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('continuous server contains preview read-only command barrier',()=>{const s=fs.readFileSync('server/continuous/server.js','utf8');assert.match(s,/PREVIEW_READ_ONLY/);assert.match(s,/x-f2e-preview/)});
test('preview frontend identifies itself as readonly on every API request',()=>{const s=fs.readFileSync('irrigacao-consolidated/app.js','utf8');assert.match(s,/PREVIEW_READONLY=location\.pathname\.startsWith\('\/irrigacao-next'\)/);assert.match(s,/x-f2e-preview':'readonly/)});
