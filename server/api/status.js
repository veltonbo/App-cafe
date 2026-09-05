import { applyCors, authorize, ensureConfig, tuyaRequest, getDeviceId } from './_tuya.js';
import { decodeCycle } from './_cycle.js';
import { getSecondsState } from './viveiro/_seconds.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok:false, error:'Método não permitido.' });
  if (!authorize(req, res) || !ensureConfig(res)) return;

  try {
    const deviceId = getDeviceId();
    const result = await tuyaRequest('GET', `/v1.0/iot-03/devices/${deviceId}/status`);
    const map = Object.fromEntries((Array.isArray(result) ? result : []).map(item => [item.code, item.value]));

    let shadowMap = {};
    try {
      const shadow = await tuyaRequest('GET', `/v2.0/cloud/thing/${deviceId}/shadow/properties`);
      const properties = Array.isArray(shadow?.properties) ? shadow.properties : [];
      shadowMap = Object.fromEntries(properties.map(item => [item.code, item.value]));
    } catch (_) {
      shadowMap = {};
    }

    const cycleTime = (typeof shadowMap.cycle_time === 'string') ? shadowMap.cycle_time : (map.cycle_time ?? null);
    res.status(200).json({
      ok: true,
      online: true,
      relay: typeof map.switch_1 === 'boolean' ? map.switch_1 : null,
      switch_1: map.switch_1 ?? null,
      countdown_1: map.countdown_1 ?? null,
      cycle_time: cycleTime,
      cycle_config: decodeCycle(cycleTime),
      relay_status: map.relay_status ?? null,
      switch_inching: map.switch_inching ?? null,
      seconds_mode: await getSecondsState().catch(() => ({enabled:false,phase:'unknown'})),
      raw: map,
      shadow: shadowMap
    });
  } catch (error) {
    res.status(502).json({ ok:false, online:false, error:error.message || 'Falha ao consultar Tuya.' });
  }
}
