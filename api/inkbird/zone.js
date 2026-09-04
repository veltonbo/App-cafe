import { applyCors, authorize, ensureCloudConfig, tuyaRequest } from '../_tuya.js';
import { resolveInkbirdDevice } from './_device.js';

function encodeStartPayload(zone, durationMinutes) {
  const payload = Buffer.alloc(34);
  payload[0] = 0x01;
  payload[1] = 0x01;
  const offset = 2 + (zone - 1) * 2;
  payload.writeUInt16BE(durationMinutes, offset);
  return payload.toString('hex');
}

function hasFunction(functions, code) {
  return functions.some(item => item.code === code);
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Método não permitido.' });
  if (!authorize(req, res) || !ensureCloudConfig(res)) return;

  const preferredId = String(req.body?.device_id || '').trim();
  const action = String(req.body?.action || '').trim().toLowerCase();
  const zone = Number(req.body?.zone);
  const duration = Number(req.body?.duration_minutes);

  if (!['start','stop','auto'].includes(action)) {
    return res.status(400).json({ ok:false, error:'Ação inválida.' });
  }
  if (action !== 'auto' && (!Number.isInteger(zone) || zone < 1 || zone > 8)) {
    return res.status(400).json({ ok:false, error:'Setor inválido. Use zona de 1 a 8.' });
  }
  if (action === 'start' && (!Number.isInteger(duration) || duration < 1 || duration > 1440)) {
    return res.status(400).json({ ok:false, error:'Duração deve ficar entre 1 e 1440 minutos.' });
  }

  try {
    const resolved = await resolveInkbirdDevice(preferredId);
    const deviceId = resolved.id;
    if (!deviceId) {
      return res.status(400).json({ ok:false, error:'IIC-800 não sincronizado com o projeto Tuya.' });
    }

    const functionsResult = await tuyaRequest('GET', `/v1.0/iot-03/devices/${deviceId}/functions`);
    const functions = Array.isArray(functionsResult?.functions) ? functionsResult.functions : [];

    if (!hasFunction(functions, 'operation_mode')) {
      return res.status(400).json({ ok:false, error:'O controlador não expôs operation_mode.' });
    }

    if (action === 'auto') {
      await tuyaRequest('POST', `/v1.0/iot-03/devices/${deviceId}/commands`, {
        commands: [{ code:'operation_mode', value:'Auto' }]
      });
      return res.status(200).json({
        ok:true,
        device_id:deviceId,
        action:'auto'
      });
    }

    if (action === 'stop') {
      await tuyaRequest('POST', `/v1.0/iot-03/devices/${deviceId}/commands`, {
        commands: [{ code:'operation_mode', value:'OFF' }]
      });
      return res.status(200).json({
        ok:true,
        device_id:deviceId,
        action:'stop',
        zone,
        note:'No IIC-800, OFF encerra a irrigação manual ativa no controlador.'
      });
    }

    if (!hasFunction(functions, 'irrigation_time_all')) {
      return res.status(400).json({ ok:false, error:'O controlador não expôs irrigation_time_all (DP45).' });
    }

    const rawHex = encodeStartPayload(zone, duration);
    await tuyaRequest('POST', `/v1.0/iot-03/devices/${deviceId}/commands`, {
      commands: [
        { code:'irrigation_time_all', value:rawHex },
        { code:'operation_mode', value:'Manual' }
      ]
    });

    return res.status(200).json({
      ok:true,
      device_id:deviceId,
      action:'start',
      zone,
      duration_minutes:duration
    });
  } catch (error) {
    return res.status(502).json({
      ok:false,
      error:error.message || 'Falha ao controlar o setor no IIC-800.'
    });
  }
}
