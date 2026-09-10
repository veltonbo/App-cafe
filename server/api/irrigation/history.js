import { applyCors, authorize } from '../_tuya.js';
import { listInkbirdDevices } from '../inkbird/_device.js';
import { appendHistory, storeGet, storeSet } from './_store.js';

const CAFE_HISTORY_PATH='IrrigacaoFazenda2E/cafe/history';
const LEGACY_HISTORY_PATH='IrrigacaoFazenda2E/history';
const MIGRATION_MARKER='IrrigacaoFazenda2E/cafe/historyMigrationV1';

function normalizeHistory(raw) {
  if (!raw || typeof raw !== 'object') return [];
  return Object.entries(raw).map(([id, value]) => ({ id, ...(value || {}) }))
    .sort((a,b) => Number(b.ts || 0) - Number(a.ts || 0));
}

function isViveiroEvent(entry){
  const type=String(entry?.type||'').toLowerCase();
  const source=String(entry?.source||'').toLowerCase();
  return type.startsWith('viveiro_')||source.includes('viveiro');
}

function uniqueHistory(rows){
  const seen=new Set();
  return rows.filter(row=>{
    const key=[
      row.id||'',
      row.type||'',
      row.controller_id||'',
      row.zone||0,
      row.sector||0,
      row.ts||row.at||''
    ].join('|');
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  });
}

async function cafeControllerIds(){
  const devices=await listInkbirdDevices().catch(()=>[]);
  return new Set((Array.isArray(devices)?devices:[])
    .map(device=>String(device?.id||'').trim())
    .filter(Boolean));
}

function legacyCafeRows(raw,controllerIds){
  return normalizeHistory(raw).filter(entry=>{
    if(isViveiroEvent(entry))return false;
    const controllerId=String(entry?.controller_id||'').trim();
    return Boolean(controllerId&&controllerIds.has(controllerId));
  });
}

async function migrateLegacyCafeHistory(){
  const marker=await storeGet(MIGRATION_MARKER).catch(()=>null);
  if(marker?.done)return 0;

  const [legacyRaw,controllerIds]=await Promise.all([
    storeGet(LEGACY_HISTORY_PATH).catch(()=>null),
    cafeControllerIds()
  ]);
  const rows=legacyCafeRows(legacyRaw,controllerIds);
  let migrated=0;
  for(const row of rows){
    const legacyId=String(row.id||'').replace(/[^A-Za-z0-9_-]/g,'_');
    const eventId='legacy-'+legacyId;
    const payload={
      ...row,
      id:undefined,
      event_id:eventId,
      app:'cafe',
      migrated_from_legacy:true
    };
    await storeSet(CAFE_HISTORY_PATH+'/'+eventId,payload).then(()=>{migrated+=1}).catch(()=>null);
  }
  await storeSet(MIGRATION_MARKER,{done:true,migrated,at:Date.now()}).catch(()=>null);
  return migrated;
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!authorize(req, res)) return;

  try {
    if (req.method === 'GET') {
      const migrated=await migrateLegacyCafeHistory().catch(()=>0);
      const cafeRaw=await storeGet(CAFE_HISTORY_PATH).catch(()=>null);
      const history=uniqueHistory(
        normalizeHistory(cafeRaw).filter(entry=>!isViveiroEvent(entry))
      ).sort((a,b)=>Number(b.ts||0)-Number(a.ts||0));
      const limit = Math.max(1, Math.min(300, Number(req.query?.limit || 100)));
      return res.status(200).json({
        ok:true,
        scope:'cafe',
        isolated:true,
        migrated_legacy:migrated,
        history:history.slice(0,limit)
      });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const entry = {
        type:String(body.type || 'note'),
        controller_id:String(body.controller_id || ''),
        controller_index:Number(body.controller_index || 0),
        zone:Number(body.zone || 0),
        sector:Number(body.sector || 0),
        duration_minutes:Number(body.duration_minutes || 0),
        mode:String(body.mode || ''),
        source:String(body.source || 'cafe_app'),
        status:String(body.status || ''),
        detail:String(body.detail || ''),
        weather:body.weather || null,
        app:'cafe',
        at:new Date().toISOString(),
        ts:Date.now()
      };
      if(isViveiroEvent(entry)){
        return res.status(400).json({ok:false,error:'Evento do Viveiro não pertence ao histórico do Café.'});
      }
      const result = await appendHistory(entry);
      return res.status(200).json({ ok:true, id:result?.id || null, entry:result?.entry || entry });
    }

    return res.status(405).json({ok:false,error:'Método não permitido.'});
  } catch (error) {
    return res.status(502).json({ok:false,error:error.message || 'Falha ao acessar histórico do Café.'});
  }
}
