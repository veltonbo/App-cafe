import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const patch=fs.readFileSync('scripts/patch-secure-session-ui.mjs','utf8');
const inject=fs.readFileSync('scripts/inject-irrigacao-ui.js','utf8');

test('patch removes legacy f2e session bypass after UI injection',()=>{
  assert.match(inject,/startsWith\('f2e\.'\)/);
  assert.match(patch,/legacyBypass/);
  assert.match(patch,/app\.replace\(legacyBypass,''\)/);
});
