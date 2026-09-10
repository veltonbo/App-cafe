import { storeGet, storeGetQuery, storeSet } from './_store.js';

const ROOT='IrrigacaoFazenda2E';
const BACKUPS_PATH=ROOT+'/configBackups';

function sanitizeSeconds(raw={}){
  return{
    on_seconds:Number(raw.on_seconds||30),
    off_seconds:Number(raw.off_seconds||120),
    base_on_seconds:Number(raw.base_on_seconds||30),
    base_off_seconds:Number(raw.base_off_seconds||120),
    resume_delay_minutes:Number(raw.resume_delay_minutes||0),
    start_minutes:Number(raw.start_minutes||0),
    end_minutes:Number(raw.end_minutes||0),
    days_mask:Number(raw.days_mask||0),
    enabled:Boolean(raw.enabled),
    phase:String(raw.phase||'')
  };
}

function rows(raw){
  if(!raw||typeof raw!=='object')return[];
  return Object.entries(raw).map(([id,v])=>({id,...(v||{})}))
    .sort((a,b)=>Number(b.created_at||0)-Number(a.created_at||0));
}

export async function createConfigBackup(reason='manual'){
  const [config,climate,weather,seconds]=await Promise.all([
    storeGet(ROOT+'/config').catch(()=>null),
    storeGet(ROOT+'/viveiroClimate/config').catch(()=>null),
    storeGet(ROOT+'/viveiroWeather/config').catch(()=>null),
    storeGet(ROOT+'/viveiroSecondsState').catch(()=>null)
  ]);
  const now=Date.now();
  const id=String(now);
  const payload={
    created_at:now,
    reason:String(reason||'manual').slice(0,120),
    config:config||{},
    climate:climate||{},
    weather:weather||{},
    seconds_snapshot:sanitizeSeconds(seconds||{})
  };
  await storeSet(BACKUPS_PATH+'/'+id,payload);
  return{id,...payload};
}

export async function listConfigBackups(limit=12){
  const safeLimit=Math.max(1,Math.min(30,Number(limit)||12));
  const raw=await storeGetQuery(BACKUPS_PATH,{
    orderBy:'$key',
    limitToLast:safeLimit
  }).catch(()=>null);
  return rows(raw).slice(0,safeLimit);
}

export async function getConfigBackup(id){
  const key=String(id||'').replace(/[^0-9]/g,'');
  if(!key)throw new Error('Backup inválido.');
  const item=await storeGet(BACKUPS_PATH+'/'+key);
  if(!item)throw new Error('Backup não encontrado.');
  return{id:key,...item};
}

export async function restoreConfigBackup(id){
  const backup=await getConfigBackup(id);
  await createConfigBackup('antes_de_restaurar_'+String(id));
  await Promise.all([
    storeSet(ROOT+'/config',backup.config||{}),
    storeSet(ROOT+'/viveiroClimate/config',backup.climate||{}),
    storeSet(ROOT+'/viveiroWeather/config',backup.weather||{})
  ]);
  return{
    ok:true,
    restored_id:String(id),
    restored_at:Date.now(),
    note:'O estado ao vivo do relé/ciclo em andamento não foi restaurado.'
  };
}
