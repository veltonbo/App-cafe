import fs from 'node:fs';

const file='server/api/viveiro/dashboard.js';
let source=fs.readFileSync(file,'utf8');

const importAnchor="import { buildViveiroReports } from '../../continuous/reporting.js';";
const importLine="import { getDashboardSources, invalidateDashboardCache } from './_dashboard-cache.js';";
if(!source.includes(importLine)){
  if(!source.includes(importAnchor))throw new Error('dashboard import anchor not found');
  source=source.replace(importAnchor,importAnchor+'\n'+importLine);
}

const oldBlock=`      const [secondsRead,weatherState,weatherConfig,maintenance,historyRecent,config,climateConfig,climateState,safety,incidentsRaw,historyIndex]=await Promise.all([\n        storeGet(ROOT+'/viveiroSecondsState')\n          .then(value=>({ok:true,value}))\n          .catch(error=>({ok:false,value:null,error:error?.message||String(error)})),\n        storeGet(ROOT+'/viveiroWeather/state').catch(()=>null),\n        storeGet(ROOT+'/viveiroWeather/config').catch(()=>null),\n        getViveiroMaintenance().catch(()=>null),\n        readRecentHistory({sinceMs:historySince,limit:60000}).catch(()=>[]),\n        storeGet(ROOT+'/config').catch(()=>null),\n        getClimateConfig().catch(()=>null),\n        getClimateState().catch(()=>null),\n        getViveiroSafety().catch(()=>null),\n        storeGet(ROOT+'/viveiro/incidents').catch(()=>null),\n        historyIndexStatus().catch(()=>({}))\n      ]);`;
const newBlock=`      const [secondsRead,weatherState,weatherConfig,maintenance,historyRecent,config,climateConfig,climateState,safety,incidentsRaw,historyIndex]=await getDashboardSources({\n        root:ROOT,historySince\n      });`;
if(source.includes(oldBlock))source=source.replace(oldBlock,newBlock);
else if(!source.includes('await getDashboardSources({'))throw new Error('dashboard Promise.all block not found');

// Alterações feitas pelo próprio painel devem forçar renovação dos dados de
// configuração no próximo GET. O controlador contínuo não depende deste cache.
const postAnchor="      const action=String(req.body?.action||'');";
const postReplacement="      const action=String(req.body?.action||'');\n      invalidateDashboardCache();";
if(source.includes(postAnchor)&&!source.includes(postReplacement)){
  source=source.replace(postAnchor,postReplacement);
}

fs.writeFileSync(file,source,'utf8');
console.log('[Fazenda 2E] dashboard performance patch applied');
