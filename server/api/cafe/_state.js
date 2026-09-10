import { storeGet, storeSet } from '../irrigation/_store.js';

export const CAFE_ROOT='IrrigacaoFazenda2E/cafe';
export const CAFE_ACTIVE_ROOT=CAFE_ROOT+'/active';
export const CAFE_WEATHER_STATE=CAFE_ROOT+'/weatherState';
export const CAFE_SCHEDULE_ROOT=CAFE_ROOT+'/inkbirdSchedules';

export async function getCafeActiveSession(deviceId){
  const id=String(deviceId||'').trim();
  if(!id)return null;
  const current=await storeGet(CAFE_ACTIVE_ROOT+'/'+id).catch(()=>null);
  if(current)return current;

  // Migração apenas de uma sessão antiga do mesmo IIC-800, se existir.
  const legacy=await storeGet('IrrigacaoFazenda2E/active/'+id).catch(()=>null);
  if(legacy&&typeof legacy==='object'){
    const migrated={...legacy,migrated_from_legacy_at:Date.now()};
    await storeSet(CAFE_ACTIVE_ROOT+'/'+id,migrated).catch(()=>null);
    return migrated;
  }
  return null;
}

export async function setCafeActiveSession(deviceId,value){
  const id=String(deviceId||'').trim();
  if(!id)throw new Error('Controlador inválido.');
  return storeSet(CAFE_ACTIVE_ROOT+'/'+id,value??null);
}

export async function getCafeWeatherState(){
  const current=await storeGet(CAFE_WEATHER_STATE).catch(()=>null);
  if(current&&typeof current==='object')return current;

  const legacy=await storeGet('IrrigacaoFazenda2E/weatherState').catch(()=>null);
  if(legacy&&typeof legacy==='object'){
    const migrated={...legacy,migrated_from_legacy_at:Date.now()};
    await storeSet(CAFE_WEATHER_STATE,migrated).catch(()=>null);
    return migrated;
  }
  return{};
}

export async function setCafeWeatherState(value){
  return storeSet(CAFE_WEATHER_STATE,value||{});
}


export async function getCafeScheduleCache(deviceId){
  const id=String(deviceId||'').trim();
  if(!id)return{};
  const current=await storeGet(CAFE_SCHEDULE_ROOT+'/'+id).catch(()=>null);
  if(current&&typeof current==='object'&&Object.keys(current).length)return current;

  const legacy=await storeGet('IrrigacaoFazenda2E/inkbirdSchedules/'+id).catch(()=>null);
  if(legacy&&typeof legacy==='object'&&Object.keys(legacy).length){
    await storeSet(CAFE_SCHEDULE_ROOT+'/'+id,legacy).catch(()=>null);
    return legacy;
  }
  return current&&typeof current==='object'?current:{};
}
