import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('public/irrigacao/index.html','utf8');
const js=fs.readFileSync('public/irrigacao/app.js','utf8');

test('Viveiro usa somente o frontend consolidado',()=>{
  assert.match(html,/\/irrigacao\/app\.css/);
  assert.match(html,/\/irrigacao\/app\.js/);
  for(const legacy of ['ui-professional','ui-premium','ui-shell','ui-mockup','ui-viveiro-v']){
    assert.equal(html.includes(legacy),false,'referência legada: '+legacy);
  }
});

test('Viveiro possui uma única navegação com quatro áreas',()=>{
  const buttons=[...html.matchAll(/<button[^>]+data-view="([^"]+)"/g)].map(m=>m[1]);
  const navBlock=html.match(/<nav class="bottomNav"[\s\S]*?<\/nav>/)?.[0]||'';
  const navViews=[...navBlock.matchAll(/data-view="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(navViews,['summary','automation','history','system']);
  assert.equal((html.match(/class="bottomNav"/g)||[]).length,1);
  assert.ok(buttons.includes('history'));
  assert.ok(buttons.includes('system'));
});

test('JavaScript do Viveiro não referencia IDs inexistentes',()=>{
  const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
  const refs=[...new Set([...js.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]))];
  const missing=refs.filter(id=>!ids.has(id));
  assert.deepEqual(missing,[]);
});

test('Frontend consolidado mantém controles essenciais',()=>{
  for(const required of [
    '/api/viveiro/dashboard',
    '/api/viveiro/live',
    '/api/viveiro/seconds',
    '/api/viveiro/weather',
    'emergency_stop',
    'clear_emergency',
    'climate_config'
  ]){
    assert.ok(js.includes(required),'ausente: '+required);
  }
});

test('Frontend não reintroduz MutationObserver global',()=>{
  assert.equal(js.includes('MutationObserver'),false);
});
