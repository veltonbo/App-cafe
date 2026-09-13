import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';

const js=fs.readFileSync('dist/irrigacao/app.js','utf8');
const html=fs.readFileSync('dist/irrigacao/index.html','utf8');
const manager=fs.readFileSync('server/continuous/seconds-manager.js','utf8');
test('artefatos publicados têm sintaxe válida',()=>{
  for(const f of ['dist/irrigacao/app.js','dist/irrigacao/suporte.js','dist/irrigacao/sw.js','server/continuous/server.js','server/continuous/seconds-manager.js']){
    const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});assert.equal(r.status,0,f+': '+r.stderr);
  }
});
test('interface final não duplica IDs nem navegação',()=>{
  const ids=[...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);
  assert.equal(ids.length,new Set(ids).size);
  assert.equal((html.match(/class="bottomNav"/g)||[]).length,1);
});
test('apenas o controlador climático 4.0 é invocado no loop',()=>{
  assert.equal((manager.match(/await evaluateClimateControl\(\)/g)||[]).length,0);
  assert.equal((manager.match(/await evaluateClimate4Controller\(\)/g)||[]).length,1);
});
test('cancelamento durante consulta climática não sobrescreve parada de emergência',async()=>{
  const start=manager.indexOf('async function evaluateClimate4Controller(){');
  const end=manager.indexOf('async function persist(){',start);
  assert.ok(start>=0&&end>start);
  const context=vm.createContext({Date,Promise,Number,String,Math,state:{enabled:true,phase:'off'},
    fetchWeatherSnapshot:async()=>{context.state={enabled:false,phase:'emergency_stopped'};return{}},
    getClimateState:async()=>({}),climate4Decision:()=>{throw new Error('não deve avaliar depois de parar')},
  });
  vm.runInContext(manager.slice(start,end),context);
  assert.equal(await context.evaluateClimate4Controller(),false);
  assert.equal(context.state.phase,'emergency_stopped');
});
test('seletor usa conexão e escape comuns dentro do escopo principal',()=>{
  assert.ok(js.indexOf('async function ekazaRequest')<js.indexOf('bootstrap();'));
  assert.match(js,/return api\('\/api\/viveiro\/device'/);
  assert.match(js,/esc\(dev.name\|\|'Sem nome'\)/);
  assert.doesNotMatch(js,/num\(s.last_confirmation_at\|\|s.state_updated_at/);
});
