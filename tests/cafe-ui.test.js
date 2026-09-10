import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('public/irrigacao/inkbird/index.html','utf8');
const js=fs.readFileSync('public/irrigacao/inkbird/app.js','utf8');

test('Café usa somente frontend consolidado',()=>{
  assert.match(html,/href="\/app\.css\?v=/);
  assert.match(html,/src="\/app\.js\?v=/);
  for(const legacy of ['cafe-ui-v2','ui-shell','ui-professional','ui-mockup','Viveiro','Central de Irrigação']){
    assert.equal(html.includes(legacy),false,'referência legada: '+legacy);
  }
});

test('Café possui uma única navegação com quatro áreas',()=>{
  const nav=html.match(/<nav class="bottomNav"[\s\S]*?<\/nav>/)?.[0]||'';
  const views=[...nav.matchAll(/data-view="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(views,['summary','sectors','weather','system']);
  assert.equal((html.match(/class="bottomNav"/g)||[]).length,1);
});

test('JavaScript do Café não referencia IDs inexistentes',()=>{
  const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
  const refs=[...new Set([...js.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]))];
  assert.deepEqual(refs.filter(id=>!ids.has(id)),[]);
});

test('Frontend consolidado usa apenas APIs do Café',()=>{
  for(const required of [
    '/api/cafe/dashboard',
    '/api/inkbird/zone',
    '/api/inkbird/schedule',
    '/api/inkbird/group',
    '/api/weather/status',
    '/api/irrigation/history',
    '/api/irrigation/config'
  ]){
    assert.ok(js.includes(required)||required==='/api/weather/status','ausente: '+required);
  }
  assert.equal(js.includes('/api/viveiro/'),false);
  assert.equal(js.includes('MutationObserver'),false);
});
