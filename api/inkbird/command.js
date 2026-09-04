import { applyCors, authorize, ensureCloudConfig, tuyaRequest } from '../_tuya.js';
import { resolveInkbirdDevice } from './_device.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Método não permitido.' });
  if (!authorize(req, res) || !ensureCloudConfig(res)) return;

  const code = String(req.body?.code || '').trim();
  if (!code || !Object.prototype.hasOwnProperty.call(req.body || {}, 'value')) {
    return res.status(400).json({ ok:false, error:'Informe code e value.' });
  }

  try {
    const preferredId = String(req.body?.device_id || '').trim();
    const resolved = await resolveInkbirdDevice(preferredId);
    const deviceId = resolved.id;
    if (!deviceId) return res.status(400).json({ ok:false, error:'IIC-800 ainda não sincronizado com o projeto Tuya.' });

    const functionsResult = await tuyaRequest('GET', `/v1.0/iot-03/devices/${deviceId}/functions`);
    const functions = Array.isArray(functionsResult?.functions) ? functionsResult.functions : [];
    const allowed = functions.some(item => item.code === code);

    if (!allowed) {
      return res.status(400).json({
        ok:false,
        error:'Comando não liberado pelo dispositivo.',
        code
      });
    }

    await tuyaRequest('POST', `/v1.0/iot-03/devices/${deviceId}/commands`, {
      commands: [{ code, value: req.body.value }]
    });

    return res.status(200).json({ ok:true, device_id:deviceId, code, value:req.body.value });
  } catch (error) {
    return res.status(502).json({ ok:false, error:error.message || 'Falha ao enviar comando ao INKBIRD.' });
  }
}
