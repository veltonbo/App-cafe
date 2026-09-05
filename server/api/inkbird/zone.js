import { applyCors, authorize, ensureCloudConfig, tuyaRequest } from '../_tuya.js';
import { resolveInkbirdDevice } from './_device.js';
import { fetchWeatherSnapshot, decideWeather } from '../weather/_weather.js';
import { appendHistory, getAutomationConfig, storeGet, storePatch, storeSet } from '../irrigation/_store.js';

function encodeStartPayload(zone, durationMinutes) {
  const payload = Buffer.alloc(34);
  payload[0] = 0x01;
  payload[1] = 0x01;
  const offset = 2 + (zone - 1) * 2;
  payload.writeUInt16BE(durationMinutes, offset);
  return payload.toString('base64');
}

function encodeStopPayload() {
  const payload = Buffer.alloc(34);
  payload[0] = 0x01;
  payload[1] = 0x01;
  return payload.toString('base64');
}

function normalizeFunctions(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.functions)) return result.functions;
  if (Array.isArray(result?.result)) return result.result;
  return [];
}

function normalizeStatus(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.status)) return result.status;
  if (Array.isArray(result?.result)) return result.result;
  return [];
}

function statusMapFrom(result) {
  return Object.fromEntries(normalizeStatus(result).map(item => [item.code, item.value]));
}

function fulfilled(result, fallback = null) {
  return result.status === 'fulfilled' ? result.value : fallback;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function readRuntimeState(deviceId) {
  const status = await tuyaRequest('GET', `/v1.0/iot-03/devices/${deviceId}/status`);
  const map = statusMapFrom(status);
  return {
    operation_mode: map.operation_mode ?? null,
    zonerun_state: Number.isFinite(Number(map.zonerun_state)) ? Number(map.zonerun_state) : 0,
    pendingzone_state: Number.isFinite(Number(map.pendingzone_state)) ? Number(map.pendingzone_state) : 0,
    irrigation_mode: map.irrigation_mode ?? null
  };
}

async function waitForZoneState(deviceId, zone, expectedOn, attempts = 5) {
  const bit = 1 << (zone - 1);
  let last = null;

  for (let i = 0; i < attempts; i++) {
    if (i) await sleep(700);
    try {
      last = await readRuntimeState(deviceId);
      const isOn = Boolean(last.zonerun_state & bit);
      if (isOn === expectedOn) return { confirmed:true, state:last };
    } catch {}
  }

  return { confirmed:false, state:last };
}

async function waitForAllZonesOff(deviceId, attempts = 6) {
  let last = null;

  for (let i = 0; i < attempts; i++) {
    if (i) await sleep(700);
    try {
      last = await readRuntimeState(deviceId);
      if (Number(last.zonerun_state || 0) === 0 && Number(last.pendingzone_state || 0) === 0) return { confirmed:true, state:last };
    } catch {}
  }

  return { confirmed:false, state:last };
}


async function evaluateServerWeather() {
  const config = await getAutomationConfig().catch(() => ({}));
  const policy = config?.weather || {
    enabled:true,
    rainThreshold:5,
    rainHoldHours:12,
    blockWhileRaining:true,
    backgroundProtection:false
  };

  const snapshot = await fetchWeatherSnapshot().catch(() => null);
  const weatherState = (await storeGet('IrrigacaoFazenda2E/weatherState').catch(() => null)) || {};

  if (snapshot?.metrics?.rainDetected) {
    weatherState.lastRainAt = Date.now();
  }

  const decision = decideWeather(snapshot, policy, weatherState);
  await storePatch('IrrigacaoFazenda2E/weatherState', {
    lastRainAt:weatherState.lastRainAt || null,
    checkedAt:Date.now(),
    decision,
    snapshot:{
      linked:snapshot?.linked || false,
      online:snapshot?.device?.online ?? null,
      metrics:snapshot?.metrics || null
    }
  }).catch(() => null);

  return { policy, snapshot, decision };
}

function controllerMeta(resolved, deviceId, zone) {
  const index = Math.max(0, (resolved.devices || []).findIndex(d => d.id === deviceId));
  return {
    controller_index:index + 1,
    sector:index * 8 + zone
  };
}

async function recordCommand(entry) {
  await appendHistory(entry).catch(() => null);
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

    const [functionsR, specificationR, statusR, infoR] = await Promise.allSettled([
      tuyaRequest('GET', `/v1.0/iot-03/devices/${deviceId}/functions`),
      tuyaRequest('GET', `/v1.0/iot-03/devices/${deviceId}/specification`),
      tuyaRequest('GET', `/v1.0/iot-03/devices/${deviceId}/status`),
      tuyaRequest('GET', `/v1.0/devices/${deviceId}`)
    ]);

    const functions = normalizeFunctions(fulfilled(functionsR));
    const specification = fulfilled(specificationR, {});
    const specFunctions = normalizeFunctions(specification);
    const specStatus = Array.isArray(specification?.status) ? specification.status : [];
    const statusList = normalizeStatus(fulfilled(statusR, []));
    const info = fulfilled(infoR, {});

    const knownCodes = new Set([
      ...functions.map(x => x?.code),
      ...specFunctions.map(x => x?.code),
      ...specStatus.map(x => x?.code),
      ...statusList.map(x => x?.code)
    ].filter(Boolean));

    const nativeSignature =
      knownCodes.has('irrigation_time_all') ||
      knownCodes.has('zonerun_state') ||
      String(info?.product_id || '') === 'h71ip90tp4mfd6mx';

    const meta = controllerMeta(resolved, deviceId, Number.isInteger(zone) ? zone : 0);
    const initialMap = Object.fromEntries(statusList.map(item => [item.code,item.value]));
    const initialActive = Number(initialMap.zonerun_state || 0);
    const initialPending = Number(initialMap.pendingzone_state || 0);

    if (!nativeSignature) {
      return res.status(400).json({
        ok:false,
        error:'O dispositivo não apresentou a assinatura esperada do IIC-800 DP45.'
      });
    }

    if (action === 'start') {
      if (info?.online === false) {
        return res.status(409).json({
          ok:false,
          error:'Controlador offline. O comando não foi enviado.'
        });
      }
      if (initialActive || initialPending) {
        const requestedBit = 1 << (zone - 1);
        return res.status(409).json({
          ok:false,
          error:(initialActive & requestedBit)
            ? 'Este setor já está irrigando.'
            : 'Já existe uma irrigação ativa ou aguardando neste controlador. Pare o ciclo atual antes de iniciar outro.',
          state:{ zonerun_state:initialActive,pendingzone_state:initialPending }
        });
      }
    }

    if (action === 'auto') {
      await tuyaRequest('POST', `/v1.0/iot-03/devices/${deviceId}/commands`, {
        commands: [{ code:'operation_mode', value:'Auto' }]
      });
      await sleep(500);
      const state = await readRuntimeState(deviceId).catch(() => null);
      const verified = state?.operation_mode === 'Auto';
      await recordCommand({
        type:'mode',
        controller_id:deviceId,
        controller_index:meta.controller_index,
        mode:'Auto',
        source:'app',
        status:verified?'confirmed':'sent',
        detail:'Controlador alterado para modo automático'
      });
      return res.status(200).json({
        ok:true,
        device_id:deviceId,
        action:'auto',
        verified,
        state
      });
    }

    if (action === 'stop') {
      let offCommandError = null;
      try {
        await tuyaRequest('POST', `/v1.0/iot-03/devices/${deviceId}/commands`, {
          commands: [{ code:'operation_mode', value:'OFF' }]
        });
      } catch (error) {
        offCommandError = error?.message || String(error);
      }

      let verification = await waitForAllZonesOff(deviceId, 5);

      if (!verification.confirmed) {
        try {
          await tuyaRequest('POST', `/v1.0/iot-03/devices/${deviceId}/commands`, {
            commands: [{ code:'irrigation_time_all', value:encodeStopPayload() }]
          });
        } catch {}

        verification = await waitForAllZonesOff(deviceId, 5);
      }

      if (!verification.confirmed) {
        return res.status(409).json({
          ok:false,
          error:'O IIC-800 não confirmou a parada da irrigação.',
          detail:offCommandError,
          device_id:deviceId,
          action:'stop',
          zone,
          state:verification.state
        });
      }

      await storeSet(`IrrigacaoFazenda2E/active/${deviceId}`, null).catch(() => null);
      await recordCommand({
        type:'stop',
        controller_id:deviceId,
        controller_index:meta.controller_index,
        zone,
        sector:meta.sector,
        mode:'Manual',
        source:'app',
        status:'confirmed',
        detail:'Irrigação manual parada'
      });
      return res.status(200).json({
        ok:true,
        device_id:deviceId,
        action:'stop',
        zone,
        verified:true,
        state:verification.state,
        warning:offCommandError || null,
        stopped_at:Date.now()
      });
    }

    if (!knownCodes.has('irrigation_time_all') && String(info?.product_id || '') !== 'h71ip90tp4mfd6mx') {
      return res.status(400).json({
        ok:false,
        error:'O controlador não apresentou irrigation_time_all (DP45).'
      });
    }

    const weather = await evaluateServerWeather();
    if (weather.decision?.blocked) {
      await recordCommand({
        type:'blocked',
        controller_id:deviceId,
        controller_index:meta.controller_index,
        zone,
        sector:meta.sector,
        duration_minutes:duration,
        mode:'Manual',
        source:'server_weather',
        status:'blocked',
        detail:weather.decision.reason,
        weather:weather.decision
      });
      return res.status(423).json({
        ok:false,
        blocked:true,
        error:'Irrigação bloqueada pela proteção meteorológica.',
        weather:weather.decision
      });
    }

    const rawBase64 = encodeStartPayload(zone, duration);

    // O IIC-800 pode entrar em Manual automaticamente quando recebe o DP45.
    // Portanto, primeiro enviamos SOMENTE o RAW e confirmamos zonerun_state.
    await tuyaRequest('POST', `/v1.0/iot-03/devices/${deviceId}/commands`, {
      commands: [{ code:'irrigation_time_all', value:rawBase64 }]
    });

    let verification = await waitForZoneState(deviceId, zone, true, 5);

    if (verification.confirmed) {
      const startedAt = Date.now();
      const expectedEndAt = startedAt + duration * 60000;
      await storeSet(`IrrigacaoFazenda2E/active/${deviceId}`, {
        zone,
        sector:meta.sector,
        controller_index:meta.controller_index,
        duration_minutes:duration,
        started_at:startedAt,
        expected_end_at:expectedEndAt,
        source:'app'
      }).catch(() => null);
      await recordCommand({
        type:'start',
        controller_id:deviceId,
        controller_index:meta.controller_index,
        zone,
        sector:meta.sector,
        duration_minutes:duration,
        mode:'Manual',
        source:'app',
        status:'confirmed',
        detail:'Irrigação manual iniciada',
        weather:weather.decision
      });
      return res.status(200).json({
        ok:true,
        verified:true,
        device_id:deviceId,
        action:'start',
        zone,
        duration_minutes:duration,
        started_at:startedAt,
        expected_end_at:expectedEndAt,
        state:verification.state,
        weather:weather.decision,
        profile:'IIC-800-DP45',
        path:'dp45-only'
      });
    }

    // Alguns firmwares exigem a troca explícita para Manual.
    // Se a Tuya rejeitar esse comando (ex.: 2008), ainda verificamos o estado
    // porque o DP45 pode ter iniciado a irrigação mesmo assim.
    let manualCommandError = null;
    try {
      await tuyaRequest('POST', `/v1.0/iot-03/devices/${deviceId}/commands`, {
        commands: [{ code:'operation_mode', value:'Manual' }]
      });
    } catch (error) {
      manualCommandError = error?.message || String(error);
    }

    verification = await waitForZoneState(deviceId, zone, true, 5);

    if (verification.confirmed) {
      const startedAt = Date.now();
      const expectedEndAt = startedAt + duration * 60000;
      await storeSet(`IrrigacaoFazenda2E/active/${deviceId}`, {
        zone,
        sector:meta.sector,
        controller_index:meta.controller_index,
        duration_minutes:duration,
        started_at:startedAt,
        expected_end_at:expectedEndAt,
        source:'app'
      }).catch(() => null);
      await recordCommand({
        type:'start',
        controller_id:deviceId,
        controller_index:meta.controller_index,
        zone,
        sector:meta.sector,
        duration_minutes:duration,
        mode:'Manual',
        source:'app',
        status:'confirmed',
        detail:'Irrigação manual iniciada',
        weather:weather.decision
      });
      return res.status(200).json({
        ok:true,
        verified:true,
        device_id:deviceId,
        action:'start',
        zone,
        duration_minutes:duration,
        started_at:startedAt,
        expected_end_at:expectedEndAt,
        state:verification.state,
        weather:weather.decision,
        profile:'IIC-800-DP45',
        path:'dp45-plus-manual',
        warning:manualCommandError || null
      });
    }

    if (verification.state?.operation_mode === 'Manual' && verification.state?.zonerun_state === 0) {
      await tuyaRequest('POST', `/v1.0/iot-03/devices/${deviceId}/commands`, {
        commands: [{ code:'operation_mode', value:'Auto' }]
      }).catch(() => null);
    }

    return res.status(409).json({
      ok:false,
      error:'O IIC-800 não confirmou a abertura do setor após o comando.',
      detail:manualCommandError,
      device_id:deviceId,
      action:'start',
      zone,
      duration_minutes:duration,
      state:verification.state,
      profile:'IIC-800-DP45'
    });
  } catch (error) {
    return res.status(502).json({
      ok:false,
      error:error.message || 'Falha ao controlar o setor no IIC-800.'
    });
  }
}
