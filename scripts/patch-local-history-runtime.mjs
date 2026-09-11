import fs from 'node:fs';

function patchDashboard(){
  const file='server/api/viveiro/dashboard.js';
  let text=fs.readFileSync(file,'utf8');
  let changed=false;

  const old="import { historyIndexStatus, readRecentHistory, storeGet, storeSet } from '../irrigation/_store.js';";
  if(text.includes(old)){
    text=text.replace(old,"import { historyIndexStatus, storeGet, storeSet } from '../irrigation/_store.js';\nimport { readRecentHistory } from '../irrigation/history-reader.js';");
    changed=true;
    console.log('[Fazenda 2E] Dashboard configurado para histórico local-first.');
  }else if(text.includes("../irrigation/history-reader.js"))console.log('[Fazenda 2E] Dashboard local-first já aplicado.');
  else throw new Error('Import esperado do dashboard não encontrado.');

  const oldClimate3Import="import { climate3ShadowSuggestion } from './_climate3.js';";
  const climate3Import="import { climate3Demand, climate3ShadowSuggestion, climate3SynchronizedReading } from './_climate3.js';";
  if(text.includes(oldClimate3Import)){text=text.replace(oldClimate3Import,climate3Import);changed=true;}
  else if(!text.includes(climate3Import)){
    const nextImport="import { whatsappNotificationStatus } from '../irrigation/_notify.js';";
    if(!text.includes(nextImport))throw new Error('Ponto de import do Automático 3.0 não encontrado.');
    text=text.replace(nextImport,climate3Import+'\n'+nextImport);changed=true;
  }

  const weatherEnd="      // O histórico operacional agora vem de um índice temporal limitado aos";
  if(!text.includes('const synchronizedClimate=climate3SynchronizedReading(')){
    if(!text.includes(weatherEnd))throw new Error('Fim do snapshot climático não encontrado.');
    text=text.replace(weatherEnd,"      const synchronizedClimate=climate3SynchronizedReading(weatherSnapshot,climateState||{},now);\n      const synchronizedDemand=climate3Demand(synchronizedClimate.vpd);\n"+weatherEnd);changed=true;
  }

  const climateBlock="        climate:{\n          config:climateConfig||{},\n          state:climateState||{}\n        },";
  const climateBlock3="        climate:{\n          config:climateConfig||{},\n          state:climateState||{},\n          current:{...synchronizedClimate,level:synchronizedDemand.level,level_label:synchronizedDemand.label},\n          shadow3:climate3ShadowSuggestion(weatherSnapshot||{},activeSeconds,climateState||{},{now})\n        },";
  if(text.includes(climateBlock)){text=text.replace(climateBlock,climateBlock3);changed=true;}
  else if(text.includes('shadow3:climate3ShadowSuggestion(')&&!text.includes('current:{...synchronizedClimate')){
    const marker="          state:climateState||{},\n          shadow3:";
    if(!text.includes(marker))throw new Error('Bloco do Automático 3.0 não encontrado.');
    text=text.replace(marker,"          state:climateState||{},\n          current:{...synchronizedClimate,level:synchronizedDemand.level,level_label:synchronizedDemand.label},\n          shadow3:");changed=true;
  }

  if(changed)fs.writeFileSync(file,text);
  console.log('[Fazenda 2E] Automático 3.0 e clima sincronizado expostos no dashboard.');
}

function patchHistoryCache(){
  const file='server/api/irrigation/_store.js';
  let text=fs.readFileSync(file,'utf8');
  if(!text.includes('function pruneRecentHistoryCache(')){
    const marker="function markRecentHistoryStale(){\n  for(const entry of recentHistoryCache.values())entry.freshUntil=0;\n}\n";
    const replacement=marker+"\nfunction pruneRecentHistoryCache(now=Date.now()){\n  for(const [key,entry] of recentHistoryCache){\n    if(!entry?.promise&&now>=Number(entry?.staleUntil||0))recentHistoryCache.delete(key);\n  }\n}\n";
    if(!text.includes(marker))throw new Error('Marcador do cache de histórico não encontrado.');
    text=text.replace(marker,replacement);
  }
  const readMarker="export async function readRecentHistory({sinceMs=0,limit=60000}={}){\n  const requestedStart=";
  if(text.includes(readMarker))text=text.replace(readMarker,"export async function readRecentHistory({sinceMs=0,limit=60000}={}){\n  pruneRecentHistoryCache();\n  const requestedStart=");
  else if(!text.includes("readRecentHistory({sinceMs=0,limit=60000}={}){\n  pruneRecentHistoryCache();"))throw new Error('Ponto de leitura do cache não encontrado.');
  fs.writeFileSync(file,text);
  console.log('[Fazenda 2E] Limpeza automática do cache de histórico aplicada.');
}

patchDashboard();
patchHistoryCache();
