import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
test('todos os scripts de build têm sintaxe JavaScript válida',()=>{
 for(const name of fs.readdirSync('scripts').filter(x=>/\.(mjs|js)$/.test(x))){
  const result=spawnSync(process.execPath,['--check','scripts/'+name],{encoding:'utf8'});
  assert.equal(result.status,0,name+': '+result.stderr);
 }
});
