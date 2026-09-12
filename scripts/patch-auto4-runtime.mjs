import fs from 'node:fs';
const file='server/api/viveiro/dashboard.js';let s=fs.readFileSync(file,'utf8');
if(!s.includes("from './_climate4.js'")){
 const m="import { whatsappNotificationStatus } from '../irrigation/_notify.js';";
 s=s.replace(m,"import { climate4ShadowSuggestion } from './_climate4.js';\n"+m);
}
if(!s.includes('shadow4:climate4ShadowSuggestion(')){
 const m='shadow3:climate3ShadowSuggestion(weatherSnapshot||{},activeSeconds,climateState||{},{now})';
 if(!s.includes(m))throw new Error('shadow3 marker not found');
 s=s.replace(m,m+',\n          shadow4:climate4ShadowSuggestion(weatherSnapshot||{},activeSeconds,climateState||{},history||[],{now})');
}
fs.writeFileSync(file,s);console.log('[Fazenda 2E] Automático 4.0 shadow exposto no dashboard.');
