import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function handlerHarness(safety,seconds){
  let writes=0;
  const context=vm.createContext({
    applyCors(){},authorize:()=>true,smartLifeConfigured:async()=>true,
    storeGet:async path=>path.endsWith('viveiroSafety')?safety:seconds,
    smartLifeReadDevice:async()=>({id:'new-relay',name:'Viveiro 2E',online:true}),
    viveiroDeviceHasRelay:()=>true,setViveiroBinding:async()=>{writes++;return{}},
    clearViveiroBinding:async()=>{writes++;return{}},
  });
  const source=fs.readFileSync('server/api/viveiro/device.js','utf8').replace(/^import .*;\n/gm,'').replace('export default async function','async function');
  vm.runInContext(source,context);
  return {async request(action='select'){
    const res={status(code){this.code=code;return this},json(body){this.body=body;return this}};
    await context.handler({method:'POST',body:{action,deviceId:'new-relay'}},res);
    return {code:res.code,writes};
  }};
}
for(const action of ['select','clear']){
  test(action+' bloqueado com controlador em execução',async()=>assert.deepEqual(await handlerHarness({emergency_latched:true},{enabled:true}).request(action),{code:409,writes:0}));
  test(action+' bloqueado sem parada de emergência',async()=>assert.deepEqual(await handlerHarness({emergency_latched:false},{enabled:false}).request(action),{code:409,writes:0}));
  test(action+' permitido com parada confirmada',async()=>assert.deepEqual(await handlerHarness({emergency_latched:true},{enabled:false}).request(action),{code:200,writes:1}));
}
test('teste de conectividade não altera a seleção',async()=>assert.deepEqual(await handlerHarness({},{}).request('test'),{code:200,writes:0}));
test('configuração de aparelho corrompida bloqueia o fallback automático',async()=>{
  const context=vm.createContext({process:{env:{}},path:{join:(...a)=>a.join('/')},fsp:{readFile:async()=>'{invalid'}});
  const source=fs.readFileSync('server/api/_viveiro_binding.js','utf8').replace(/^import .*;\n/gm,'').replaceAll('export async function','async function');
  vm.runInContext(source,context);
  await assert.rejects(context.getViveiroBinding(),/controle bloqueado/);
  context.fsp.readFile=async()=>{throw Object.assign(new Error('missing'),{code:'ENOENT'})};
  assert.equal((await context.getViveiroBinding()).deviceId,null);
});
