import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const patch=fs.readFileSync('scripts/patch-smartlife-reauth-ui.mjs','utf8');
const route=fs.readFileSync('server/api/smartlife/reauth.js','utf8');
const router=fs.readFileSync('api/router.js','utf8');
const bridge=fs.readFileSync('smartlife/bridge.py','utf8');

test('reconexão Smart Life tem fluxo completo de iniciar e confirmar',()=>{
  assert.match(route,/action==='start'/);
  assert.match(route,/action==='finish'/);
  assert.match(route,/smartLifeReauthStart/);
  assert.match(route,/smartLifeReauthFinish/);
  assert.match(router,/smartlife\/reauth/);
});

test('UI de reconexão possui botão, QR, confirmar e cancelar',()=>{
  for(const id of ['smartLifeReconnectBtn','smartLifeQrImage','smartLifeConfirmBtn','smartLifeCancelBtn']){
    assert.ok(patch.includes(id),'ausente: '+id);
  }
  assert.match(patch,/\/api\/smartlife\/reauth/);
});

test('bridge gera QR e conclui login sem expor senha',()=>{
  assert.match(bridge,/action == "reauth_start"/);
  assert.match(bridge,/action == "reauth_finish"/);
  assert.match(bridge,/qr_image/);
  assert.match(bridge,/refresh_token/);
  assert.doesNotMatch(bridge,/password\s*=/i);
});
