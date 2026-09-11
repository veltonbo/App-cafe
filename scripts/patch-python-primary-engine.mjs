import fs from 'node:fs';

const file='server/continuous/seconds-manager.js';
let text=fs.readFileSync(file,'utf8');
let changed=false;

const importMarker="import { accountingDayKey, pulseAccountingForDay } from './accounting.js';";
const importLine="import { accountingDayKey, pulseAccountingForDay } from './accounting.js';\nimport { pythonEngineDecision } from './python-engine.js';";
if(text.includes(importMarker)&&!text.includes("from './python-engine.js'")){
  text=text.replace(importMarker,importLine);changed=true;
}

// Python must authorize every ON. If the Python engine is unavailable, fail safe OFF.
const readyMarker=`    const maxOn=Math.max(1,Math.min(\n      Number(state.on_seconds||30),\n      localSchedule(state).seconds_until_end||Number(state.on_seconds||30)\n    ));\n\n    let relayOnAt=0;`;
const readyReplacement=`    const maxOn=Math.max(1,Math.min(\n      Number(state.on_seconds||30),\n      localSchedule(state).seconds_until_end||Number(state.on_seconds||30)\n    ));\n\n    let pythonReady=null;\n    try{\n      pythonReady=await pythonEngineDecision({\n        phase:'ready',enabled:Boolean(state.enabled),schedule_inside:true,\n        weather_usable:Boolean(w.usable),raining:Boolean(w.raining),\n        emergency:false,maintenance:false,\n        on_seconds:maxOn,off_seconds:Number(state.off_seconds||120)\n      });\n    }catch(error){\n      await safeOff('python_engine_unavailable');\n      state={...state,engine:'python_primary_v1',phase:'python_engine_unavailable',relay_expected:false,last_error:error?.message||String(error)};\n      await persist();\n      await sleep(5000);\n      continue;\n    }\n    if(pythonReady?.action!=='turn_on'){\n      await safeOff('python_'+String(pythonReady?.reason||'blocked'));\n      state={...state,engine:'python_primary_v1',phase:'python_blocked',relay_expected:false,last_error:null};\n      await persist();\n      await sleep(5000);\n      continue;\n    }\n\n    let relayOnAt=0;`;
if(text.includes(readyMarker)){
  text=text.replace(readyMarker,readyReplacement);changed=true;
}else if(!text.includes("phase:'python_engine_unavailable'")){
  throw new Error('Ponto de autorização Python antes do ON não encontrado.');
}

// Python defines the absolute OFF deadline. Existing local deadline remains as a fail-safe fallback.
const onDeadlineMarker="    let interrupted=false;\n    const onDeadline=Number(state.expected_off_at||0)||(Date.now()+maxOn*1000);";
const onDeadlineReplacement="    let interrupted=false;\n    let onDeadline=Number(state.expected_off_at||0)||(Date.now()+maxOn*1000);\n    try{\n      const pyOn=await pythonEngineDecision({\n        phase:'on',enabled:Boolean(state.enabled),schedule_inside:true,weather_usable:true,raining:false,\n        emergency:false,maintenance:false,on_seconds:maxOn,off_seconds:Number(state.off_seconds||120),\n        relay_on_at:Number(relayOnAt||state.last_on_confirmed_at||Date.now())\n      });\n      if(Number(pyOn?.off_deadline_at)>0)onDeadline=Number(pyOn.off_deadline_at);\n      state={...state,engine:'python_primary_v1',python_engine_at:Number(pyOn?.evaluated_at||Date.now()),expected_off_at:onDeadline};\n      await persist();\n    }catch(error){\n      console.warn('python primary on deadline fallback:',error?.message||error);\n    }";
if(text.includes(onDeadlineMarker)){
  text=text.replace(onDeadlineMarker,onDeadlineReplacement);changed=true;
}else if(!text.includes("python primary on deadline fallback")){
  throw new Error('Prazo ON para Python não encontrado.');
}

// Python defines the interval deadline. If it crashes after OFF, fallback keeps irrigation OFF longer, never ON longer.
const offDeadlineMarker="    const offDeadline=Number(state.expected_next_on_at||0)\n      ||(Date.now()+Math.max(1,Number(state.off_seconds||120))*1000);";
const offDeadlineReplacement="    let offDeadline=Number(state.expected_next_on_at||0)\n      ||(Date.now()+Math.max(1,Number(state.off_seconds||120))*1000);\n    try{\n      const pyOff=await pythonEngineDecision({\n        phase:'off',enabled:Boolean(state.enabled),schedule_inside:true,weather_usable:true,raining:false,\n        emergency:false,maintenance:false,on_seconds:Number(state.on_seconds||30),off_seconds:Number(state.off_seconds||120),\n        relay_off_at:Number(state.last_off_confirmed_at||Date.now())\n      });\n      if(Number(pyOff?.next_on_at)>0)offDeadline=Number(pyOff.next_on_at);\n      state={...state,engine:'python_primary_v1',python_engine_at:Number(pyOff?.evaluated_at||Date.now()),expected_next_on_at:offDeadline};\n      await persist();\n    }catch(error){\n      console.warn('python primary off deadline fallback:',error?.message||error);\n    }";
if(text.includes(offDeadlineMarker)){
  text=text.replace(offDeadlineMarker,offDeadlineReplacement);changed=true;
}else if(!text.includes("python primary off deadline fallback")){
  throw new Error('Prazo OFF para Python não encontrado.');
}

if(changed)fs.writeFileSync(file,text);
console.log('[Fazenda 2E] Python primary v1: autorização ON e prazos ON/OFF controlados pelo motor Python.');
