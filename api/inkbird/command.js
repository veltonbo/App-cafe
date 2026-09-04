import { applyCors, authorize, ensureConfig, tuyaRequest } from '../_tuya.js';

const DEFAULT_DEVICE_ID = 'eb7f32868bdffc559bkgyh';
const deviceId = (process.env.INKBIRD_DEVICE_ID || DEFAULT_DEVICE_ID).trim();

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Método não permitido.' });
  if (!authorize(req, res) || !ensureConfig(res)) return;

  const code = String(req.body?.code || '').trim();
  if (!code || !Object.prototype.hasOwnProperty.call(req.body || {}, 'value')) {
    return res.status(400).json({ ok:false, error:'Informe code e value.' });
  }

  try {
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

    return res.status(200).json({ ok:true, code, value:req.body.value });
  } catch (error) {
    return res.status(502).json({ ok:false, error:error.message || 'Falha ao enviar comando ao INKBIRD.' });
  }
}
