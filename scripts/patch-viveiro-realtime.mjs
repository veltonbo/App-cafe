import fs from 'node:fs';

const file='server/continuous/seconds-manager.js';
let text=fs.readFileSync(file,'utf8');
let changed=false;

const beforeOn="    let relayOnAt=0;\n    let pulseId='';\n    try{\n      const previousOffConfirmedAt=Number(state.last_off_confirmed_at||0);\n      const onResult=await setViveiroRelay(true,{attempts:5});";
const afterOn="    let relayOnAt=0;\n    let pulseId='';\n    try{\n      const previousOffConfirmedAt=Number(state.last_off_confirmed_at||0);\n      state={...state,phase:'starting_on',relay_expected:true,last_command:'on_pending',last_command_at:Date.now(),expected_off_at:0};\n      await persist();\n      const onResult=await setViveiroRelay(true,{attempts:5});";
if(text.includes(beforeOn)){text=text.replace(beforeOn,afterOn);changed=true;}
else if(!text.includes("phase:'starting_on'"))throw new Error('Ponto de início do pulso não encontrado.');

const beforeOff="    await safeOff(interrupted?'pulse_interrupted':'pulse_deadline');\n    if(!interrupted&&onDeadline>0){";
const afterOff="    state={...state,phase:'stopping_off',relay_expected:false,last_command:'off_pending',last_command_at:Date.now()};\n    await persist();\n    await safeOff(interrupted?'pulse_interrupted':'pulse_deadline');\n    if(!interrupted&&onDeadline>0){";
if(text.includes(beforeOff)){text=text.replace(beforeOff,afterOff);changed=true;}
else if(!text.includes("phase:'stopping_off'"))throw new Error('Ponto de desligamento do pulso não encontrado.');

if(changed)fs.writeFileSync(file,text);
console.log('[Fazenda 2E] Estados LIGANDO/DESLIGANDO em tempo real aplicados.');
