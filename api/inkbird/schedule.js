import { applyCors, authorize, ensureCloudConfig, tuyaRequest } from '../_tuya.js';
import { resolveInkbirdDevice } from './_device.js';
import { decodeDp38, updateDp38Zone } from './_iic800.js';
import { appendHistory } from '../irrigation/_store.js';

function normalizeStatus(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.status)) return result.status;
  if (Array.isArray(result?.result)) return result.result;
  return [];
}

function normalizeShadow(result) {
  if (Array.isArray(result?.properties)) return result.properties;
  if (Array.isArray(result)) return result;
  return [];
}

async function readNormalTime(deviceId) {
  const [statusR, shadowR] = await Promise.allSettled([
    tuyaRequest('GET', `/v1.0/iot-03/devices/${deviceId}/status`),
    tuyaRequest('GET', `/v2.0/cloud/thing/${deviceId}/shadow/properties`)
  ]);

  const status = statusR.status === 'fulfilled' ? normalizeStatus(statusR.value) : [];
  const shadow = shadowR.status === 'fulfilled' ? normalizeShadow(shadowR.value) : [];

  const statusValue = status.find(x => x.code === 'normal_time')?.value;
  const shadowValue = shadow.find(x => x.code === 'normal_time')?.value;
  const value = statusValue ?? shadowValue ?? null;

  return {
    value,
    decoded:decodeDp38(value),
    source:statusValue != null ? 'status' : shadowValue != null ? 'shadow' : 'none'
  };
}

function validTimes(times) {
  if (!Array.isArray(times)) return [];
  return times.slice(0,6).map(x => String(typeof x === 'string' ? x : x?.value || '').trim())
    .filter(x => /^([01]?\d|2[0-3]):[0-5]\d$/.test(x));
}

function normalizeConfig(body = {}) {
  const zone = Number(body.zone);
  if (!Number.isInteger(zone) || zone < 1 || zone > 8) throw new Error('Setor inválido.');

  const enabled = body.enabled !== false;
  const duration = Math.max(1, Math.min(255, Math.round(Number(body.duration_minutes || 10))));
  const startTimes = enabled ? validTimes(body.start_times) : [];
  if (enabled && !startTimes.length) throw new Error('Informe pelo menos um horário de início.');

  const cycleMode = Math.max(0, Math.min(3, Number(body.cycle_mode || 0)));
  const daysMask = Math.max(0, Math.min(127, Number(body.days_mask ?? 127)));
  if (enabled && cycleMode === 0 && !daysMask) throw new Error('Selecione pelo menos um dia da semana.');

  return {
    zone,
    enabled,
    duration_minutes:duration,
    start_times:startTimes,
    cycle_mode:cycleMode,
    days_mask:daysMask,
    interval_days:Math.max(1,Math.min(9,Number(body.interval_days || 1))),
    interval_start:body.interval_start || {},
    rain_sensor_follow:body.rain_sensor_follow !== false
  };
}

function sameZone(a,b) {
  if (!a || !b) return false;
  const mode = Number(b.cycle_mode || 0);
  const dayMatch = mode === 0
    ? Number(a.days_mask) === Number(b.days_mask)
    : mode === 3
      ? Number(a.days_mask) === Number(b.interval_days || 1)
      : true;
  return Number(a.zone) === Number(b.zone) &&
    Number(a.duration_minutes) === Number(b.duration_minutes) &&
    Boolean(a.enabled) === Boolean(b.enabled) &&
    Number(a.cycle_mode) === mode &&
    dayMatch &&
    JSON.stringify((a.start_times || []).map(x => typeof x === 'string' ? x : x.value)) ===
      JSON.stringify((b.start_times || []).map(x => typeof x === 'string' ? x : x.value));
}

export default async function handler(req, res) {
  applyCors(req,res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!authorize(req,res) || !ensureCloudConfig(res)) return;

  try {
    const preferredId = String((req.method === 'GET' ? req.query?.device_id : req.body?.device_id) || '').trim();
    const resolved = await resolveInkbirdDevice(preferredId);
    const deviceId = resolved.id;
    if (!deviceId) return res.status(400).json({ ok:false,error:'IIC-800 não encontrado.' });

    if (req.method === 'GET') {
      const current = await readNormalTime(deviceId);
      return res.status(200).json({
        ok:true,
        device_id:deviceId,
        source:current.source,
        raw_available:current.value != null,
        channels:current.decoded.channels,
        raw_length:current.decoded.raw_length
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ ok:false,error:'Método não permitido.' });
    }

    const config = normalizeConfig(req.body || {});
    const current = await readNormalTime(deviceId);

    if (current.value == null) {
      return res.status(409).json({
        ok:false,
        error:'O IIC-800 ainda não retornou a agenda normal_time. Atualize o controlador antes de gravar a programação.'
      });
    }

    const encoded = updateDp38Zone(current.value, config.zone, config);

    await tuyaRequest('POST', `/v1.0/iot-03/devices/${deviceId}/commands`, {
      commands:[{ code:'normal_time', value:encoded.raw }]
    });

    await new Promise(resolve => setTimeout(resolve,700));
    const verify = await readNormalTime(deviceId);
    const zoneAfter = verify.decoded.channels.find(x => Number(x.zone) === config.zone);
    const expected = {
      ...config,
      start_times:config.start_times,
      enabled:config.enabled
    };

    if (!sameZone(zoneAfter, expected)) {
      return res.status(409).json({
        ok:false,
        error:'A Tuya recebeu a agenda, mas o IIC-800 ainda não confirmou a alteração.',
        requested:expected,
        current:zoneAfter || null
      });
    }

    await appendHistory({
      type:'schedule',
      controller_id:deviceId,
      zone:config.zone,
      duration_minutes:config.duration_minutes,
      mode:'Auto',
      source:'app',
      status:config.enabled ? 'enabled' : 'disabled',
      detail:config.enabled ? 'Programação automática atualizada' : 'Programação automática desativada'
    });

    return res.status(200).json({
      ok:true,
      verified:true,
      device_id:deviceId,
      channel:zoneAfter,
      channels:verify.decoded.channels
    });
  } catch (error) {
    return res.status(502).json({
      ok:false,
      error:error.message || 'Falha ao acessar programação automática do IIC-800.'
    });
  }
}
