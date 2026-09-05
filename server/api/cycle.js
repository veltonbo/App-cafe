import { applyCors, authorize, ensureConfig, tuyaRequest, getDeviceId } from './_tuya.js';
import { decodeCycle, encodeCycle } from './_cycle.js';

async function getStatusMap(deviceId) {
  const result = await tuyaRequest('GET', `/v1.0/iot-03/devices/${deviceId}/status`);
  return Object.fromEntries((Array.isArray(result) ? result : []).map(item => [item.code, item.value]));
}

async function getShadowMap(deviceId) {
  try {
    const shadow = await tuyaRequest('GET', `/v2.0/cloud/thing/${deviceId}/shadow/properties`);
    const properties = Array.isArray(shadow?.properties) ? shadow.properties : [];
    return Object.fromEntries(properties.map(item => [item.code, item.value]));
  } catch (_) {
    return {};
  }
}

async function getCycleRaw(deviceId) {
  const [statusMap, shadowMap] = await Promise.all([
    getStatusMap(deviceId),
    getShadowMap(deviceId)
  ]);
  if (typeof shadowMap.cycle_time === 'string') return shadowMap.cycle_time;
  if (typeof statusMap.cycle_time === 'string') return statusMap.cycle_time;
  return '';
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!authorize(req, res) || !ensureConfig(res)) return;

  const deviceId = getDeviceId();

  if (req.method === 'GET') {
    try {
      const currentRaw = await getCycleRaw(deviceId);
      return res.status(200).json({
        ok: true,
        cycle_time: currentRaw || null,
        cycle_config: decodeCycle(currentRaw)
      });
    } catch (error) {
      return res.status(502).json({ ok:false, error:error.message || 'Falha ao consultar ciclo Tuya.' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok:false, error:'Método não permitido.' });
  }

  try {
    const currentRaw = await getCycleRaw(deviceId);
    if (currentRaw && !decodeCycle(currentRaw)) {
      throw new Error('Formato atual do cycle_time não reconhecido. Nenhuma alteração foi enviada.');
    }

    const encoded = encodeCycle({
      enabled: req.body?.enabled,
      daysMask: req.body?.daysMask,
      startMinutes: req.body?.startMinutes,
      endMinutes: req.body?.endMinutes,
      onMinutes: req.body?.onMinutes,
      offMinutes: req.body?.offMinutes
    }, currentRaw);

    await tuyaRequest('POST', `/v1.0/iot-03/devices/${deviceId}/commands`, {
      commands: [{ code:'cycle_time', value: encoded.raw }]
    });

    return res.status(200).json({
      ok: true,
      cycle_time: encoded.raw,
      cycle_config: encoded
    });
  } catch (error) {
    return res.status(400).json({ ok:false, error:error.message || 'Falha ao salvar ciclo de irrigação.' });
  }
}
