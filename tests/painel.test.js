import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('public/painel/index.html','utf8');
const js=fs.readFileSync('public/painel/app.js','utf8');
const server=fs.readFileSync('server/painel/server.js','utf8');

test('painel é somente leitura',()=>{
  assert.match(js,/\/api\/overview/);
  assert.equal(js.includes('/api/viveiro/'),false);
  assert.equal(js.includes('/api/inkbird/'),false);
  assert.equal(js.includes("method:'POST'"),false);
});

test('painel agrega Viveiro e Café no servidor',()=>{
  assert.match(server,/\/api\/viveiro\/dashboard/);
  assert.match(server,/\/api\/cafe\/dashboard/);
  assert.match(server,/APP_CONTROL_TOKEN/);
});

test('painel mostra os quatro estados principais',()=>{
  for(const id of ['viveiroCard','cafeCard','climateCard','alertsCard']){
    assert.ok(html.includes('id="'+id+'"'));
  }
});
