import { applyCors, authorize, ensureCloudConfig, tuyaRequest } from '../_tuya.js';
import { resolveInkbirdDevice } from './_device.js';
import { encodeDp45Manual } from './_iic800.js';
import { fetchWeatherSnapshot, decideWeather } from '../weather/_weather.js';
import { appendHistory, getAutomationConfig, storeGet, storePatch, storeSet } from '../irrigation/_store.js';

function normalizeStatus(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.status)) return result.status;
  if (Array.isArray(result?.result)) return result.result;
  return [];
}

function statusMap(result) {
  return Object.fromEntries(normalizeStatus(result).map(x => [x.code, x.value]));
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function readState(deviceId) {
  const r = await tuyaRequest('GET', `/v1.0/iot-03/devices/${deviceId}/status`);
  const map = statusMap(r);
  return {
    operation_mode:map.operation_mode ?? null,
    irrigation_mode:map.irrigation_mode ?? null,
    active_mask:Number(map.zonerun_state || 0),
    pending_mask:Number(map.pendingzone_state || 0)
  };
}

async function serverWeather() {
  const cfg = await getAutomationConfig().catch(() => ({}));
  const policy = cfg?.weather || {
    enabled:true,
    rainThreshold:5,
    rainHoldHours:12,
    blockWhileRaining:true
  };
  const snapshot = await fetchWeatherSnapshot().catch(() => null);
  const ws = (await storeGet('IrrigacaoFazenda2E/weatherState').catch(() => null)) || {};
  if (snapshot?.metrics?.rainDetected) ws.lastRainAt = Date.now();
  const decision = decideWeather(snapshot, policy, ws);
  await storePatch('IrrigacaoFazenda2E/weatherState', {
    lastRainAt:ws.lastRainAt || null,
    checkedAt:Date.now(),
    decision
  }).catch(() => null);
  return { snapshot, decision };
}

function normalizeZones(input) {
  if (!Array.isArray(input) || !input.length) throw new Error('Selecione pelo menos um setor.');
  const out = input.map(item => ({
    zone:Number(item?.zone),
    duration_minutes:Math.round(Number(item?.duration_minutes || 0))
  }));
  for (const item of out) {
    if (!Number.isInteger(item.zone) || item.zone < 1 || item.zone > 8) throw new Error('Setor inválido no grupo.');
    if (!Number.isInteger(item.duration_minutes) || item.duration_minutes < 1 || item.duration_minutes > 1440) {
      throw new Error('A duração dos setores deve ficar entre 1 e 1440 minutos.');
    }
  }
  if (new Set(out.map(x => x.zone)).size !== out.length) throw new Error('O grupo contém setores duplicados.');
  return out;
}

export default async function handler(req,res) {
  applyCors(req,res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok:false,error:'Método não permitido.' });
  if (!authorize(req,res) || !ensureCloudConfig(res)) return;

  try {
    const deviceIdRequested = String(req.body?.device_id || '').trim();
    const zones = normalizeZones(req.body?.zones);
    const mode = req.body?.mode === 'together' ? 'together' : 'order';
    const name = String(req.body?.name || 'Grupo de setores').slice(0,80);

    const resolved = await resolveInkbirdDevice(deviceIdRequested);
    const deviceId = resolved.id;
    if (!deviceId) return res.status(400).json({ ok:false,error:'IIC-800 não encontrado.' });

    const index = Math.max(0,(resolved.devices || []).findIndex(d => d.id === deviceId));
    const controllerIndex = index + 1;

    const before = await readState(deviceId);
    if (before.active_mask || before.pending_mask) {
      return res.status(409).json({
        ok:false,
        error:'Já existe uma irrigação ativa ou aguardando neste controlador. Pare o ciclo atual antes de iniciar o grupo.',
        state:before
      });
    }

    const weather = await serverWeather();
    if (weather.decision?.blocked) {
      await appendHistory({
        type:'group_blocked',
        controller_id:deviceId,
        controller_index:controllerIndex,
        source:'server_weather',
        status:'blocked',
        detail:name + ': ' + weather.decision.reason,
        weather:weather.decision
      });
      return res.status(423).json({
        ok:false,
        blocked:true,
        error:'Grupo bloqueado pela proteção meteorológica.',
        weather:weather.decision
      });
    }

    if (before.irrigation_mode !== mode) {
      try {
        await tuyaRequest('POST', `/v1.0/iot-03/devices/${deviceId}/commands`, {
          commands:[{ code:'irrigation_mode', value:mode }]
        });
        await sleep(400);
      } catch (error) {
        const verifyMode = await readState(deviceId);
        if (verifyMode.irrigation_mode !== mode) {
          return res.status(409).json({
            ok:false,
            error:'Não foi possível colocar o controlador no modo sequencial do grupo.',
            detail:error?.message || String(error),
            state:verifyMode
          });
        }
      }
    }

    const durations = Object.fromEntries(zones.map(item => [item.zone,item.duration_minutes]));
    await tuyaRequest('POST', `/v1.0/iot-03/devices/${deviceId}/commands`, {
      commands:[{ code:'irrigation_time_all', value:encodeDp45Manual(durations) }]
    });

    let state = null;
    let confirmed = false;
    const requestedMask = zones.reduce((mask,item) => mask | (1 << (item.zone - 1)),0);

    for (let attempt = 0; attempt < 7; attempt++) {
      if (attempt) await sleep(700);
      state = await readState(deviceId).catch(() => null);
      if (!state) continue;
      const seen = (state.active_mask | state.pending_mask) & requestedMask;
      if (seen) { confirmed = true; break; }
    }

    if (!confirmed) {
      return res.status(409).json({
        ok:false,
        error:'O IIC-800 não confirmou o início do grupo.',
        state
      });
    }

    const startedAt = Date.now();
    const totalMinutes = mode === 'order'
      ? zones.reduce((sum,x) => sum + x.duration_minutes,0)
      : Math.max(...zones.map(x => x.duration_minutes));
    const expectedEndAt = startedAt + totalMinutes * 60000;

    const session = {
      kind:'group',
      name,
      zones,
      mode,
      controller_index:controllerIndex,
      started_at:startedAt,
      expected_end_at:expectedEndAt,
      duration_minutes:totalMinutes,
      source:'app'
    };
    await storeSet(`IrrigacaoFazenda2E/active/${deviceId}`, session).catch(() => null);
    await appendHistory({
      type:'group_start',
      controller_id:deviceId,
      controller_index:controllerIndex,
      duration_minutes:totalMinutes,
      mode,
      source:'app',
      status:'confirmed',
      detail:name,
      weather:weather.decision,
      zones
    });

    return res.status(200).json({
      ok:true,
      verified:true,
      device_id:deviceId,
      controller_index:controllerIndex,
      name,
      mode,
      zones,
      started_at:startedAt,
      expected_end_at:expectedEndAt,
      state
    });
  } catch (error) {
    return res.status(502).json({
      ok:false,
      error:error.message || 'Falha ao iniciar grupo de irrigação.'
    });
  }
}
