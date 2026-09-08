import { applyCors, authorize } from './_tuya.js';
import { decodeCycle } from './_cycle.js';
import { readViveiroState } from './_viveiro_transport.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok:false, error:'Método não permitido.' });
  if (!authorize(req, res)) return;

  try {
    const state=await readViveiroState();
    const map=state.statusMap||{};
    const cycleTime=typeof map.cycle_time==='string'?map.cycle_time:null;

    res.status(200).json({
      ok:true,
      online:state.online!==false,
      provider:state.provider,
      relay:typeof map.switch_1==='boolean'?map.switch_1:null,
      switch_1:map.switch_1??null,
      countdown_1:map.countdown_1??null,
      cycle_time:cycleTime,
      cycle_config:decodeCycle(cycleTime),
      relay_status:map.relay_status??null,
      switch_inching:map.switch_inching??null,
      seconds_mode:null,
      raw:map,
      shadow:{}
    });
  } catch (error) {
    res.status(502).json({
      ok:false,
      online:false,
      error:error?.message||'Falha ao consultar o Viveiro.'
    });
  }
}
