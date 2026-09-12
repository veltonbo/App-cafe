import fs from 'node:fs';

const file='server/api/viveiro/_seconds.js';
let src=fs.readFileSync(file,'utf8');

const old=`export async function prepareServerPulse({onSeconds=30,offSeconds=120,resumeDelayMinutes=30,startMinutes=null,endMinutes=null,daysMask=null}={}){\n  const current=await readViveiroDevice({force:true,maxAgeMs:0});\n  const cycle=current.cycleConfig;\n  if(!cycle)throw new Error('Atualize a programação do EKAZA antes de ativar o modo em segundos.');\n\n  const on=Math.max(1,Math.min(300,Math.round(Number(onSeconds)||30)));`;

const replacement=`export async function prepareServerPulse({onSeconds=30,offSeconds=120,resumeDelayMinutes=30,startMinutes=null,endMinutes=null,daysMask=null}={}){\n  const current=await readViveiroDevice({force:true,maxAgeMs:0});\n  let cycle=current.cycleConfig;\n\n  // EKAZA recém-substituído pode chegar sem cycle_time. Nesse caso usamos\n  // a programação enviada pela própria tela para criar, primeiro, um ciclo\n  // nativo DESLIGADO. Isso apenas sincroniza horário/dias no novo aparelho;\n  // não liga a irrigação nem entrega o controle ao temporizador nativo.\n  if(!cycle){\n    const seedStart=Number.isFinite(Number(startMinutes))?Math.round(Number(startMinutes)):null;\n    const seedEnd=Number.isFinite(Number(endMinutes))?Math.round(Number(endMinutes)):null;\n    const seedMask=Number.isFinite(Number(daysMask))?Math.round(Number(daysMask)):null;\n    if(seedStart==null||seedEnd==null||seedMask==null){\n      throw new Error('O novo EKAZA ainda não tem programação. Salve novamente horário e dias para sincronizar o aparelho.');\n    }\n    if(seedStart<0||seedStart>1439||seedEnd<1||seedEnd>1440||seedEnd<=seedStart){\n      throw new Error('Confira o horário inicial e final antes de sincronizar o novo EKAZA.');\n    }\n    if(seedMask<1||seedMask>127){\n      throw new Error('Selecione pelo menos um dia antes de sincronizar o novo EKAZA.');\n    }\n    const seeded=encodeCycle({\n      enabled:false,\n      daysMask:seedMask,\n      startMinutes:seedStart,\n      endMinutes:seedEnd,\n      onMinutes:1,\n      offMinutes:1\n    },current.cycleRaw||'');\n    await writeViveiroCycle(seeded.raw);\n    current.cycleRaw=seeded.raw;\n    cycle=decodeCycle(seeded.raw);\n    if(!cycle)throw new Error('O novo EKAZA não confirmou a programação inicial.');\n  }\n\n  const on=Math.max(1,Math.min(300,Math.round(Number(onSeconds)||30)));`;

if(!src.includes(old)){
  if(src.includes('EKAZA recém-substituído pode chegar sem cycle_time')){
    console.log('[Fazenda 2E] Inicialização do novo EKAZA já aplicada.');
    process.exit(0);
  }
  throw new Error('Trecho de prepareServerPulse não encontrado para patch do novo EKAZA.');
}

src=src.replace(old,replacement);
fs.writeFileSync(file,src);
console.log('[Fazenda 2E] Inicialização segura de programação para novo EKAZA aplicada.');
