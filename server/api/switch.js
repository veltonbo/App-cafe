import { applyCors, authorize, ensureConfig, tuyaRequest, getDeviceId } from './_tuya.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Método não permitido.' });
  if (!authorize(req, res) || !ensureConfig(res)) return;

  const on = req.body?.on;
  if (typeof on !== 'boolean') return res.status(400).json({ ok:false, error:'Informe on=true ou on=false.' });

  try {
    const deviceId = getDeviceId();
    await tuyaRequest('POST', `/v1.0/iot-03/devices/${deviceId}/commands`, {
      commands: [{ code:'switch_1', value:on }]
    });
    res.status(200).json({ ok:true, relay:on });
  } catch (error) {
    res.status(502).json({ ok:false, error:error.message || 'Falha ao enviar comando Tuya.' });
  }
}
