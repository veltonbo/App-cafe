import fs from 'node:fs';

function patchDashboard(){
  const file='server/api/viveiro/dashboard.js';
  let text=fs.readFileSync(file,'utf8');
  const old="import { historyIndexStatus, readRecentHistory, storeGet, storeSet } from '../irrigation/_store.js';";
  if(text.includes(old)){
    text=text.replace(old,
      "import { historyIndexStatus, storeGet, storeSet } from '../irrigation/_store.js';\n"+
      "import { readRecentHistory } from '../irrigation/history-reader.js';"
    );
    fs.writeFileSync(file,text);
    console.log('[Fazenda 2E] Dashboard configurado para histórico local-first.');
  }else if(text.includes("../irrigation/history-reader.js")){
    console.log('[Fazenda 2E] Dashboard local-first já aplicado.');
  }else{
    throw new Error('Import esperado do dashboard não encontrado.');
  }
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
  if(text.includes(readMarker)){
    text=text.replace(readMarker,
      "export async function readRecentHistory({sinceMs=0,limit=60000}={}){\n  pruneRecentHistoryCache();\n  const requestedStart="
    );
  }else if(!text.includes("readRecentHistory({sinceMs=0,limit=60000}={}){\n  pruneRecentHistoryCache();")){
    throw new Error('Ponto de leitura do cache não encontrado.');
  }
  fs.writeFileSync(file,text);
  console.log('[Fazenda 2E] Limpeza automática do cache de histórico aplicada.');
}

patchDashboard();
patchHistoryCache();
