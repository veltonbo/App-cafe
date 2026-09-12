import fs from 'node:fs';

const file='server/api/viveiro/_climate.js';
let src=fs.readFileSync(file,'utf8');
if(src.includes('FAZENDA2E_AUTOMATIC_STABILITY_V3')){
  console.log('[Fazenda 2E] Automatic Stability V3 já aplicado.');
  process.exit(0);
}
const old=`  const baseOn=Math.max(1,Math.min(300,Math.round(Number(secondsState.base_on_seconds)||30)));\n  const baseOff=Math.max(1,Math.min(900,Math.round(Number(secondsState.base_off_seconds)||120)));\n  const currentOn=Math.max(1,Math.min(300,Math.round(Number(secondsState.on_seconds)||baseOn)));\n  const currentOff=Math.max(1,Math.min(900,Math.round(Number(secondsState.off_seconds)||baseOff)));`;
const replacement=`  // FAZENDA2E_AUTOMATIC_STABILITY_V3\n  // Depois de troca de EKAZA/reinício, base_on/base_off podem ainda não existir.\n  // Nesse caso o ciclo configurado atual é a base correta; nunca voltamos\n  // silenciosamente para 30/120 apenas por ausência temporária desses campos.\n  const configuredOn=Number(secondsState.on_seconds);\n  const configuredOff=Number(secondsState.off_seconds);\n  const baseOn=Math.max(1,Math.min(300,Math.round(Number(secondsState.base_on_seconds)||(Number.isFinite(configuredOn)?configuredOn:30))));\n  const baseOff=Math.max(1,Math.min(900,Math.round(Number(secondsState.base_off_seconds)||(Number.isFinite(configuredOff)?configuredOff:120))));\n  const currentOn=Math.max(1,Math.min(300,Math.round(Number.isFinite(configuredOn)?configuredOn:baseOn)));\n  const currentOff=Math.max(1,Math.min(900,Math.round(Number.isFinite(configuredOff)?configuredOff:baseOff)));`;
if(!src.includes(old))throw new Error('Trecho base do Automático 2.0 não encontrado.');
src=src.replace(old,replacement);
fs.writeFileSync(file,src);
console.log('[Fazenda 2E] Automatic Stability V3 aplicado.');
