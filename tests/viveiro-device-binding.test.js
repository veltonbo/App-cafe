import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('server/api/_viveiro_transport.js','utf8').replace(/import[\s\S]*?from '\.\/_smartlife.js';/,'').replaceAll('export async function','async function');
function harness(env){
 const calls=[];const invoke=async options=>{calls.push(options);return{id:options.deviceId||'legacy',online:true,status:{switch_1:false}}};
 const api=new Function('process','smartLifeConfigured','smartLifeReadDevice','smartLifeSendCommands',source+';return {readViveiroState,sendViveiroCommands}')({env},async()=>true,invoke,invoke);
 return{calls,api};
}
test('ID fixo elimina seleção por nome tanto na leitura quanto no comando',async()=>{const h=harness({SMARTLIFE_VIVEIRO_ID:'new-id',SMARTLIFE_VIVEIRO_NAME:'Viveiro'});await h.api.readViveiroState();await h.api.sendViveiroCommands([{code:'switch_1',value:false}]);assert.equal(h.calls.length,2);for(const c of h.calls){assert.equal(c.deviceId,'new-id');assert.equal(c.deviceName,null)}assert.equal(h.calls[1].priority,true)});
test('instalações sem ID preservam configuração por nome',async()=>{const h=harness({SMARTLIFE_VIVEIRO_NAME:'Viveiro'});await h.api.readViveiroState();assert.equal(h.calls[0].deviceId,null);assert.equal(h.calls[0].deviceName,'Viveiro')});
test('comandos vazios são rejeitados antes de chamar Smart Life',async()=>{const h=harness({});await assert.rejects(h.api.sendViveiroCommands([]));assert.equal(h.calls.length,0)});
