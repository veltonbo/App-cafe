import { applyCors, authorize, ensureConfig, tuyaRequest, getDeviceId } from './_tuya.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok:false, error:'Método não permitido.' });
  if (!authorize(req, res) || !ensureConfig(res)) return;

  try {
    const deviceId = getDeviceId();
    const result = await tuyaRequest('GET', `/v1.0/iot-03/devices/${deviceId}/status`);
    const map = Object.fromEntries((Array.isArray(result) ? result : []).map(item => [item.code, item.value]));
    res.status(200).json({
      ok: true,
      online: true,
      relay: typeof map.switch_1 === 'boolean' ? map.switch_1 : null,
      switch_1: map.switch_1 ?? null,
      countdown_1: map.countdown_1 ?? null,
      cycle_time: map.cycle_time ?? null,
      relay_status: map.relay_status ?? null,
      switch_inching: map.switch_inching ?? null,
      raw: map
    });
  } catch (error) {
    res.status(502).json({ ok:false, online:false, error:error.message || 'Falha ao consultar Tuya.' });
  }
}
