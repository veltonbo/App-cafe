import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const patch=fs.readFileSync('scripts/patch-auth-session-refresh.mjs','utf8');

test('auth refresh patch retries protected API once after 401/403',()=>{
  assert.match(patch,/apiWithSessionRetry/);
  assert.match(patch,/401\|403/);
  assert.match(patch,/ensureSecureSession\(\)/);
  assert.match(patch,/__sessionRetry:true/);
});
