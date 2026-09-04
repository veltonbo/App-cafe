import { applyCors, authorize, ensureConfig, tuyaRequest } from '../_tuya.js';

const DEFAULT_DEVICE_ID = 'eb7f32868bdffc559bkgyh';
const deviceId = (process.env.INKBIRD_DEVICE_ID || DEFAULT_DEVICE_ID).trim();

function settleValue(result, fallback = null) {
  return result.status === 'fulfilled' ? result.value : fallback;
}

function settleError(result) {
  if (result.status === 'rejected') return result.reason?.message || String(result.reason);
  return null;
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok:false, error:'Método não permitido.' });
  if (!authorize(req, res) || !ensureConfig(res)) return;

  if (!deviceId) {
    return res.status(200).json({
      ok: true,
      configured: false,
      linked: false,
      model: 'IIC-800-WIFI',
      zones: 8,
      error: 'INKBIRD_DEVICE_ID não configurado.'
    });
  }

  const [infoR, specR, funcsR, statusR, shadowR] = await Promise.allSettled([
    tuyaRequest('GET', `/v1.1/iot-03/devices/${deviceId}`),
    tuyaRequest('GET', `/v1.0/iot-03/devices/${deviceId}/specification`),
    tuyaRequest('GET', `/v1.0/iot-03/devices/${deviceId}/functions`),
    tuyaRequest('GET', `/v1.0/iot-03/devices/${deviceId}/status`),
    tuyaRequest('GET', `/v2.0/cloud/thing/${deviceId}/shadow/properties`)
  ]);

  const info = settleValue(infoR);
  const specification = settleValue(specR);
  const functionsResult = settleValue(funcsR);
  const statusList = settleValue(statusR, []);
  const shadow = settleValue(shadowR);

  const statusMap = Object.fromEntries(
    (Array.isArray(statusList) ? statusList : []).map(item => [item.code, item.value])
  );

  const shadowList = Array.isArray(shadow?.properties) ? shadow.properties : [];
  const shadowMap = Object.fromEntries(shadowList.map(item => [item.code, item.value]));

  const functions = Array.isArray(functionsResult?.functions)
    ? functionsResult.functions
    : Array.isArray(specification?.functions)
      ? specification.functions
      : [];

  const statusSpec = Array.isArray(specification?.status) ? specification.status : [];

  const errors = {
    info: settleError(infoR),
    specification: settleError(specR),
    functions: settleError(funcsR),
    status: settleError(statusR),
    shadow: settleError(shadowR)
  };

  const linked = Boolean(info || specification || functions.length || statusList?.length || shadowList.length);

  return res.status(200).json({
    ok: true,
    configured: true,
    linked,
    model: 'IIC-800-WIFI',
    zones: 8,
    device: info ? {
      id: deviceId,
      name: info.name ?? 'INKBIRD IIC-800-WIFI',
      online: info.online ?? null,
      category: info.category ?? specification?.category ?? functionsResult?.category ?? null,
      product_id: info.product_id ?? null
    } : {
      id: deviceId,
      name: 'INKBIRD IIC-800-WIFI',
      online: null,
      category: specification?.category ?? functionsResult?.category ?? null,
      product_id: null
    },
    functions,
    status_spec: statusSpec,
    status: statusMap,
    shadow: shadowMap,
    errors
  });
}
