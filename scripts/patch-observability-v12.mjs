import fs from 'node:fs';

const MANAGER='server/continuous/seconds-manager.js';
const HANDLER='server/continuous/seconds-handler.js';
const MARK='FAZENDA2E_OBSERVABILITY_V12';

let manager=fs.readFileSync(MANAGER,'utf8');
if(!manager.includes(MARK)){
  const old=`export async function getSecondsManagerState(){\n  if(state.enabled){\n    const lastChecked=Number(state.checked_at||0);\n    const needsLiveCheck=!lastChecked||Date.now()-lastChecked>30000;\n    if(needsLiveCheck){\n      const current=await readViveiroDevice({force:true,maxAgeMs:0}).catch(()=>null);\n      if(current){\n        state={...state,device_relay:current.relay,relay_expected:current.relay===true,checked_at:Date.now()};\n      }\n    }\n  }\n  return{...state,server_read_at:Date.now()};\n}`;
  const neu=`export async function getSecondsManagerState(options={}){\n  // ${MARK}\n  const liveCheck=options?.liveCheck!==false;\n  if(liveCheck&&state.enabled){\n    const lastChecked=Number(state.checked_at||0);\n    const needsLiveCheck=!lastChecked||Date.now()-lastChecked>30000;\n    if(needsLiveCheck){\n      const current=await readViveiroDevice({force:true,maxAgeMs:0}).catch(()=>null);\n      if(current){\n        state={...state,device_relay:current.relay,relay_expected:current.relay===true,checked_at:Date.now()};\n      }\n    }\n  }\n  const now=Date.now();\n  return{\n    ...state,\n    server_read_at:now,\n    timing_observability:{\n      controller_clock:state.scheduler_precision||null,\n      smartlife_confirmation:state.confirmation_latency||null,\n      confirmed_state_window:state.precision||null,\n      note:'controller_clock mede o atraso do comando local; smartlife_confirmation mede o tempo de confirmação da nuvem; confirmed_state_window inclui a latência de confirmação e não deve ser interpretado como atraso do relógio do controlador.'\n    }\n  };\n}`;
  if(!manager.includes(old))throw new Error('getSecondsManagerState original não encontrado');
  manager=manager.replace(old,neu);
  fs.writeFileSync(MANAGER,manager);
}

let handler=fs.readFileSync(HANDLER,'utf8');
handler=handler.replace('state:await getSecondsManagerState()','state:await getSecondsManagerState({liveCheck:false})');
handler=handler.replace('state:await getSecondsManagerState()','state:await getSecondsManagerState({liveCheck:false})');
fs.writeFileSync(HANDLER,handler);

console.log('[Fazenda 2E] Observabilidade v12 aplicada: status rápido + métricas separadas.');
