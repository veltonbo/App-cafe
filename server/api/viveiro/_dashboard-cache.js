import { historyIndexStatus, readRecentHistory, storeGet } from '../irrigation/_store.js';
import { getClimateConfig, getClimateState } from './_climate.js';
import { getViveiroMaintenance, getViveiroSafety } from './_interlock.js';
import { getSecondsManagerState } from '../../continuous/seconds-manager.js';

const cache=new Map();

function cachedRead(key,{ttlMs=10000,maxStaleMs=10*60*1000}={},loader){
  const now=Date.now();
  const current=cache.get(key);

  if(current?.value!==undefined){
    const age=now-Number(current.at||0);
    if(age<=ttlMs)return Promise.resolve(current.value);

    if(!current.refreshing){
      const refreshing=Promise.resolve()
        .then(loader)
        .then(value=>{
          cache.set(key,{value,at:Date.now(),refreshing:null});
          return value;
        })
        .catch(error=>{
          const previous=cache.get(key);
          if(previous)cache.set(key,{...previous,refreshing:null,lastError:error?.message||String(error)});
          return current.value;
        });
      cache.set(key,{...current,refreshing});
    }

    // O painel pode usar uma cópia recente enquanto a atualização acontece em
    // segundo plano. Isso nunca interfere no controlador contínuo da irrigação.
    if(age<=maxStaleMs)return Promise.resolve(current.value);
  }

  if(current?.refreshing)return current.refreshing;
  const refreshing=Promise.resolve()
    .then(loader)
    .then(value=>{
      cache.set(key,{value,at:Date.now(),refreshing:null});
      return value;
    })
    .catch(error=>{
      cache.delete(key);
      throw error;
    });
  cache.set(key,{...(current||{}),refreshing});
  return refreshing;
}

export async function getDashboardSources({root='IrrigacaoFazenda2E',historySince=0}={}){
  return Promise.all([
    cachedRead('seconds',{ttlMs:1500,maxStaleMs:30000},()=>
      getSecondsManagerState()
        .then(value=>({ok:true,value}))
        .catch(error=>({ok:false,value:null,error:error?.message||String(error)}))
    ),
    cachedRead('weatherState',{ttlMs:3000,maxStaleMs:60000},()=>storeGet(root+'/viveiroWeather/state').catch(()=>null)),
    cachedRead('weatherConfig',{ttlMs:30000,maxStaleMs:15*60*1000},()=>storeGet(root+'/viveiroWeather/config').catch(()=>null)),
    cachedRead('maintenance',{ttlMs:3000,maxStaleMs:60000},()=>getViveiroMaintenance().catch(()=>null)),
    cachedRead('history32d',{ttlMs:15000,maxStaleMs:5*60*1000},()=>readRecentHistory({sinceMs:historySince,limit:60000}).catch(()=>[])),
    cachedRead('config',{ttlMs:30000,maxStaleMs:15*60*1000},()=>storeGet(root+'/config').catch(()=>null)),
    cachedRead('climateConfig',{ttlMs:15000,maxStaleMs:5*60*1000},()=>getClimateConfig().catch(()=>null)),
    cachedRead('climateState',{ttlMs:3000,maxStaleMs:60000},()=>getClimateState().catch(()=>null)),
    cachedRead('safety',{ttlMs:2000,maxStaleMs:30000},()=>getViveiroSafety().catch(()=>null)),
    cachedRead('incidents',{ttlMs:15000,maxStaleMs:5*60*1000},()=>storeGet(root+'/viveiro/incidents').catch(()=>null)),
    cachedRead('historyIndex',{ttlMs:60000,maxStaleMs:30*60*1000},()=>historyIndexStatus().catch(()=>({})))
  ]);
}

export function invalidateDashboardCache(keys=null){
  if(!Array.isArray(keys)||!keys.length){
    cache.clear();
    return;
  }
  for(const key of keys)cache.delete(String(key));
}
