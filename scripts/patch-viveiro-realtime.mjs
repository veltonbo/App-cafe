import fs from 'node:fs';

const file='server/continuous/seconds-manager.js';
let text=fs.readFileSync(file,'utf8');
let changed=false;

// 1) Publica LIGANDO antes da chamada Smart Life. Assim a tela reage na hora,
// mas só vira IRRIGANDO depois da confirmação real do relé.
const beforeOn="    let relayOnAt=0;\n    let pulseId='';\n    try{\n      const previousOffConfirmedAt=Number(state.last_off_confirmed_at||0);\n      const onResult=await setViveiroRelay(true,{attempts:5});";
const afterOn="    let relayOnAt=0;\n    let pulseId='';\n    try{\n      const previousOffConfirmedAt=Number(state.last_off_confirmed_at||0);\n      state={...state,phase:'starting_on',relay_expected:true,last_command:'on_pending',last_command_at:Date.now(),expected_off_at:0};\n      await persist();\n      const onResult=await setViveiroRelay(true,{attempts:5});";
if(text.includes(beforeOn)){text=text.replace(beforeOn,afterOn);changed=true;}
else if(!text.includes("phase:'starting_on'"))throw new Error('Ponto de início do pulso não encontrado.');

// 2) Assim que o ON for confirmado, publica IRRIGANDO imediatamente e inicia
// o prazo absoluto de desligamento. O countdown nativo vira proteção paralela
// e não bloqueia mais a atualização da interface.
const confirmOnMarker="      relayOnAt=Number(onResult?.confirmed_at||Date.now());\n      addConfirmationLatencySample(";
const confirmOnReplacement="      relayOnAt=Number(onResult?.confirmed_at||Date.now());\n      state={...state,phase:'on',device_relay:true,relay_expected:true,pulse_started_at:relayOnAt,expected_off_at:relayOnAt+maxOn*1000,last_on_confirmed_at:relayOnAt};\n      await persist();\n      addConfirmationLatencySample(";
if(text.includes(confirmOnMarker)){text=text.replace(confirmOnMarker,confirmOnReplacement);changed=true;}
else if(!text.includes("phase:'on',device_relay:true,relay_expected:true"))throw new Error('Confirmação ON não encontrada.');

if(text.includes('      await safetyCountdown(maxOn);')){
  text=text.replace('      await safetyCountdown(maxOn);',"      safetyCountdown(maxOn).catch(()=>false);");
  changed=true;
}

// 3) No desligamento por prazo, publica DESLIGANDO no instante exato do deadline,
// antes de aguardar a confirmação da Smart Life.
const deadlineMarker="      if(deadlineOffCancelled)return false;\n      return safeOff('pulse_deadline');";
const deadlineReplacement="      if(deadlineOffCancelled)return false;\n      state={...state,phase:'stopping_off',relay_expected:false,last_command:'off_pending',last_command_at:Date.now()};\n      await persist();\n      return safeOff('pulse_deadline');";
if(text.includes(deadlineMarker)){text=text.replace(deadlineMarker,deadlineReplacement);changed=true;}
else if(!text.includes("phase:'stopping_off'"))throw new Error('Temporizador de desligamento não encontrado.');

// Desligamentos por interrupção também mostram DESLIGANDO enquanto aguardam confirmação.
const interruptedMarker="    if(interrupted){\n      deadlineOffCancelled=true;\n      await safeOff('pulse_interrupted');";
const interruptedReplacement="    if(interrupted){\n      deadlineOffCancelled=true;\n      state={...state,phase:'stopping_off',relay_expected:false,last_command:'off_pending',last_command_at:Date.now()};\n      await persist();\n      await safeOff('pulse_interrupted');";
if(text.includes(interruptedMarker)){text=text.replace(interruptedMarker,interruptedReplacement);changed=true;}

// 4) Depois da confirmação OFF de um pulso normal, publica INTERVALO antes de
// contabilidade/histórico, eliminando o atraso visual e o efeito de piscar ON/OFF.
const physicalMarker="    const physicalOffAt=Number(state.last_off_confirmed_at||Date.now());\n    const physicalOnAt=Number(state.last_on_confirmed_at||relayOnAt||state.pulse_started_at||0);";
const physicalReplacement="    const physicalOffAt=Number(state.last_off_confirmed_at||Date.now());\n    if(!interrupted){\n      state={...state,phase:'off',device_relay:false,relay_expected:false,expected_off_at:0,expected_next_on_at:physicalOffAt+Number(state.off_seconds||120)*1000};\n      await persist();\n    }\n    const physicalOnAt=Number(state.last_on_confirmed_at||relayOnAt||state.pulse_started_at||0);";
if(text.includes(physicalMarker)){text=text.replace(physicalMarker,physicalReplacement);changed=true;}
else if(!text.includes("expected_next_on_at:physicalOffAt+Number(state.off_seconds||120)*1000"))throw new Error('Confirmação OFF não encontrada.');

if(changed)fs.writeFileSync(file,text);
console.log('[Fazenda 2E] Tempo real v2: LIGANDO/IRRIGANDO/DESLIGANDO/INTERVALO sincronizados com confirmação física.');
