import { applyCors, authorize } from '../_tuya.js';
import { storeGet, storePush } from './_store.js';

function normalizeHistory(raw) {
  if (!raw || typeof raw !== 'object') return [];
  return Object.entries(raw).map(([id, value]) => ({ id, ...(value || {}) }))
    .sort((a,b) => Number(b.ts || 0) - Number(a.ts || 0));
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!authorize(req, res)) return;

  try {
    if (req.method === 'GET') {
      const raw = await storeGet('IrrigacaoFazenda2E/history');
      const limit = Math.max(1, Math.min(200, Number(req.query?.limit || 80)));
      return res.status(200).json({ ok:true, history:normalizeHistory(raw).slice(0,limit) });
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
        source:String(body.source || 'app'),
        status:String(body.status || ''),
        detail:String(body.detail || ''),
        weather:body.weather || null,
        at:new Date().toISOString(),
        ts:Date.now()
      };
      const result = await storePush('IrrigacaoFazenda2E/history', entry);
      return res.status(200).json({ ok:true, id:result?.name || null, entry });
    }

    return res.status(405).json({ ok:false, error:'Método não permitido.' });
  } catch (error) {
    return res.status(502).json({ ok:false, error:error.message || 'Falha ao acessar histórico.' });
  }
}
