import fs from 'node:fs';

const file='server/api/viveiro/_seconds.js';
const marker='FAZENDA2E_NEW_EKAZA_SYNC_V2';
const legacy="if(!cycle)throw new Error('Atualize a programação do EKAZA antes de ativar o modo em segundos.');";
let src=fs.readFileSync(file,'utf8');

if(!src.includes(marker)){
  src=src.replace(
    /export async function prepareServerPulse\(\{onSeconds=30,offSeconds=120,resumeDelayMinutes=30,startMinutes=null,endMinutes=null,daysMask=null\}=\{\}\)\{\n  const current=await readViveiroDevice\(\{force:true,maxAgeMs:0\}\);\n  (?:const|let) cycle=current\.cycleConfig;\n(?:  if\(!cycle\).*?\n)?/s,
    `export async function prepareServerPulse({onSeconds=30,offSeconds=120,resumeDelayMinutes=30,startMinutes=null,endMinutes=null,daysMask=null}={}){\n  const current=await readViveiroDevice({force:true,maxAgeMs:0});\n  let cycle=current.cycleConfig;\n  // ${marker}\n  // EKAZA novo pode não publicar cycle_time até receber a primeira programação.\n  // Criamos uma programação nativa DESLIGADA usando horário/dias enviados pela tela.\n  if(!cycle){\n    const seedStart=Number.isFinite(Number(startMinutes))?Math.round(Number(startMinutes)):null;\n    const seedEnd=Number.isFinite(Number(endMinutes))?Math.round(Number(endMinutes)):null;\n    const seedMask=Number.isFinite(Number(daysMask))?Math.round(Number(daysMask)):null;\n    if(seedStart==null||seedEnd==null||seedMask==null)throw new Error('O novo EKAZA ainda não tem programação. Salve horário e dias novamente.');\n    if(seedStart<0||seedStart>1439||seedEnd<1||seedEnd>1440||seedEnd<=seedStart)throw new Error('Confira o horário inicial e final antes de sincronizar o novo EKAZA.');\n    if(seedMask<1||seedMask>127)throw new Error('Selecione pelo menos um dia antes de sincronizar o novo EKAZA.');\n    const seeded=encodeCycle({enabled:false,daysMask:seedMask,startMinutes:seedStart,endMinutes:seedEnd,onMinutes:1,offMinutes:1},current.cycleRaw||'');\n    await writeViveiroCycle(seeded.raw);\n    current.cycleRaw=seeded.raw;\n    cycle=decodeCycle(seeded.raw);\n    if(!cycle)throw new Error('O novo EKAZA não confirmou a programação inicial.');\n  }\n`
  );
}

// Remove explicitamente qualquer guarda antiga que possa ter sobrevivido a patches anteriores.
src=src.replaceAll(legacy,'');

if(!src.includes(marker))throw new Error('Falha: marcador do novo EKAZA não entrou em _seconds.js.');
if(src.includes('Atualize a programação do EKAZA antes de ativar o modo em segundos.')){
  throw new Error('Falha: mensagem antiga do EKAZA ainda existe após o patch.');
}

fs.writeFileSync(file,src);
console.log('[Fazenda 2E] Novo EKAZA V2 aplicado e verificado.');
