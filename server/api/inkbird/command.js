import { applyCors, authorize, ensureCloudConfig, tuyaRequest } from '../_tuya.js';
import { resolveInkbirdDevice } from './_device.js';

function parseValues(values) {
  if (!values) return {};
  if (typeof values === 'object') return values;
  try { return JSON.parse(values); } catch { return {}; }
}

function validateValue(fn, value) {
  const type = String(fn?.type || '').toLowerCase();
  const values = parseValues(fn?.values);

  if (/boolean|bool/.test(type)) {
    return typeof value === 'boolean';
  }

  if (/integer|value/.test(type)) {
    if (!Number.isFinite(Number(value))) return false;
    const n = Number(value);
    if (Number.isFinite(Number(values.min)) && n < Number(values.min)) return false;
    if (Number.isFinite(Number(values.max)) && n > Number(values.max)) return false;
    return true;
  }

  if (/enum/.test(type)) {
    const range = Array.isArray(values.range) ? values.range : [];
    return !range.length || range.includes(value);
  }

  return true;
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Método não permitido.' });
  if (!authorize(req, res) || !ensureCloudConfig(res)) return;

  const requested = Array.isArray(req.body?.commands)
    ? req.body.commands
    : [{ code:req.body?.code, value:req.body?.value }];

  if (!requested.length || requested.length > 4) {
    return res.status(400).json({ ok:false, error:'Informe de 1 a 4 comandos.' });
  }

  const normalized = requested.map(item => ({
    code: String(item?.code || '').trim(),
    value: item?.value
  }));

  if (normalized.some(item => !item.code || item.value === undefined)) {
    return res.status(400).json({ ok:false, error:'Todos os comandos precisam de code e value.' });
  }

  try {
    const preferredId = String(req.body?.device_id || '').trim();
    const resolved = await resolveInkbirdDevice(preferredId);
    const deviceId = resolved.id;
    if (!deviceId) {
      return res.status(400).json({ ok:false, error:'IIC-800 ainda não sincronizado com o projeto Tuya.' });
    }

    const functionsResult = await tuyaRequest('GET', `/v1.0/iot-03/devices/${deviceId}/functions`);
    const functions = Array.isArray(functionsResult) ? functionsResult : Array.isArray(functionsResult?.functions) ? functionsResult.functions : [];
    const functionMap = Object.fromEntries(functions.map(item => [item.code, item]));

    for (const item of normalized) {
      const fn = functionMap[item.code];
      if (!fn) {
        return res.status(400).json({
          ok:false,
          error:'Comando não liberado pelo dispositivo.',
          code:item.code
        });
      }
      if (!validateValue(fn, item.value)) {
        return res.status(400).json({
          ok:false,
          error:'Valor fora do limite permitido para o dispositivo.',
          code:item.code
        });
      }
    }

    await tuyaRequest('POST', `/v1.0/iot-03/devices/${deviceId}/commands`, {
      commands: normalized
    });

    return res.status(200).json({
      ok:true,
      device_id:deviceId,
      commands:normalized
    });
  } catch (error) {
    return res.status(502).json({
      ok:false,
      error:error.message || 'Falha ao enviar comando ao INKBIRD.'
    });
  }
}
