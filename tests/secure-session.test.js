import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const auth=fs.readFileSync('server/api/_tuya.js','utf8');
const session=fs.readFileSync('server/api/session.js','utf8');
const ui=fs.readFileSync('public/irrigacao/app.js','utf8');

test('sessão do Viveiro usa cookie HttpOnly Secure Strict',()=>{
  assert.match(auth,/HttpOnly; Secure; SameSite=Strict/);
  assert.match(auth,/createHmac\('sha256'/);
  assert.match(auth,/authorizeControlToken/);
});

test('pareamento mantém Bearer como fallback e remove token local',()=>{
  assert.match(session,/issueControlSession/);
  assert.match(ui,/ensureSecureSession/);
  assert.match(ui,/store\.settings\.token=''/);
  assert.match(ui,/credentials:'same-origin'/);
});
