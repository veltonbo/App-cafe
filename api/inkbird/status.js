import { applyCors, authorize, ensureCloudConfig, tuyaRequest } from '../_tuya.js';
import { resolveInkbirdDevice } from './_device.js';

function settleValue(result, fallback = null) {
  return result.status === 'fulfilled' ? result.value : fallback;
}

function settleError(result) {
  if (result.status === 'rejected') return result.reason?.message || String(result.reason);
  return null;
}


function parseValues(values) {
  if (!values) return {};
  if (typeof values === 'object') return values;
  try { return JSON.parse(values); } catch { return {}; }
}

function zoneNumberFrom(text) {
  const s = String(text || '').toLowerCase();
  const patterns = [
    /(?:zone|zona|station|valve|switch|channel|way|road|outlet|port)[_\s-]*([1-8])\b/,
    /\b([1-8])[_\s-]*(?:zone|zona|station|valve|switch|channel|way|road|outlet|port)\b/
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) return Number(m[1]);
  }
  return null;
}

function buildZoneCandidates(functions, statusSpec, statusMap, shadowMap) {
  const combinedStatus = [...statusSpec];
  const candidates = [];

  for (const fn of functions) {
    const zone = zoneNumberFrom(fn.code) || zoneNumberFrom(fn.name) || zoneNumberFrom(fn.desc);
    if (!zone) continue;

    const type = String(fn.type || '').toLowerCase();
    const values = parseValues(fn.values);
    const safeType = ['boolean', 'bool', 'integer', 'value', 'enum'].some(t => type.includes(t));
    if (!safeType) continue;

    candidates.push({
      zone,
      code: fn.code,
      name: fn.name || fn.code,
      type: fn.type || null,
      values,
      current: Object.prototype.hasOwnProperty.call(statusMap, fn.code)
        ? statusMap[fn.code]
        : Object.prototype.hasOwnProperty.call(shadowMap, fn.code)
          ? shadowMap[fn.code]
          : null
    });
  }

  for (const st of combinedStatus) {
    const zone = zoneNumberFrom(st.code) || zoneNumberFrom(st.name);
    if (!zone) continue;
    if (candidates.some(x => x.zone === zone && x.code === st.code)) continue;
    candidates.push({
      zone,
      code: st.code,
      name: st.name || st.code,
      type: st.type || null,
      values: parseValues(st.values),
      current: Object.prototype.hasOwnProperty.call(statusMap, st.code)
        ? statusMap[st.code]
        : Object.prototype.hasOwnProperty.call(shadowMap, st.code)
          ? shadowMap[st.code]
          : null,
      status_only: true
    });
  }

  candidates.sort((a, b) => a.zone - b.zone || a.code.localeCompare(b.code));
  const zonesFound = [...new Set(candidates.filter(x => !x.status_only).map(x => x.zone))];

  const controls = [];
  const durations = [];

  function looksLikeDuration(item) {
    const text = (String(item.code || '') + ' ' + String(item.name || '')).toLowerCase();
    return /duration|runtime|run_time|watering_time|water_time|irrigation_time|time_set|work_time|minutes|min\b|countdown/.test(text);
  }

  for (let zone = 1; zone <= 8; zone++) {
    const booleanControls = candidates.filter(x =>
      !x.status_only &&
      x.zone === zone &&
      /boolean|bool/i.test(String(x.type || ''))
    );
    if (booleanControls.length === 1) {
      controls.push({
        zone,
        code: booleanControls[0].code,
        name: booleanControls[0].name,
        current: booleanControls[0].current
      });
    }

    const durationCandidates = candidates.filter(x =>
      !x.status_only &&
      x.zone === zone &&
      /integer|value/i.test(String(x.type || '')) &&
      looksLikeDuration(x)
    );

    if (durationCandidates.length === 1) {
      const d = durationCandidates[0];
      durations.push({
        zone,
        code: d.code,
        name: d.name,
        current: d.current,
        min: Number.isFinite(Number(d.values?.min)) ? Number(d.values.min) : null,
        max: Number.isFinite(Number(d.values?.max)) ? Number(d.values.max) : null,
        step: Number.isFinite(Number(d.values?.step)) ? Number(d.values.step) : 1,
        scale: Number.isFinite(Number(d.values?.scale)) ? Number(d.values.scale) : 0,
        unit: d.values?.unit || null
      });
    }
  }

  const scheduleCandidates = functions
    .filter(fn => /schedule|program|timer|plan|cycle|appointment|reservation/i.test(String(fn.code || '') + ' ' + String(fn.name || '') + ' ' + String(fn.desc || '')))
    .map(fn => ({
      code: fn.code,
      name: fn.name || fn.code,
      type: fn.type || null,
      values: parseValues(fn.values)
    }));

  return {
    candidates,
    controls,
    durations,
    schedule_candidates: scheduleCandidates,
    zones_found: zonesFound,
    mapped_count: zonesFound.length,
    duration_mapped_count: durations.length,
    ready: zonesFound.length === 8,
    control_ready: controls.length === 8,
    duration_ready: durations.length === 8
  };
}


function hasCode(code, functions, statusSpec, statusMap, shadowMap) {
  return functions.some(x => x.code === code) ||
    statusSpec.some(x => x.code === code) ||
    Object.prototype.hasOwnProperty.call(statusMap, code) ||
    Object.prototype.hasOwnProperty.call(shadowMap, code);
}

function applyNativeIic800Profile(mapping, functions, statusSpec, statusMap, shadowMap, info) {
  const signatureCodes = ['irrigation_time_all', 'operation_mode', 'zonerun_state'];
  const signatureHits = signatureCodes.filter(code => hasCode(code, functions, statusSpec, statusMap, shadowMap)).length;
  const productId = String(info?.product_id || '');
  const category = String(info?.category || '');

  const native = signatureHits >= 2 || productId === 'h71ip90tp4mfd6mx' ||
    (category === 'ggq' && hasCode('irrigation_time_all', functions, statusSpec, statusMap, shadowMap));

  if (!native) return mapping;

  const activeRaw = Object.prototype.hasOwnProperty.call(statusMap, 'zonerun_state')
    ? statusMap.zonerun_state
    : shadowMap.zonerun_state;
  const activeMask = Number.isFinite(Number(activeRaw)) ? Number(activeRaw) : 0;

  const controls = Array.from({ length: 8 }, (_, i) => ({
    zone: i + 1,
    code: 'irrigation_time_all',
    name: 'Zona ' + (i + 1) + ' • DP45 RAW',
    current: Boolean(activeMask & (1 << i)),
    native_raw: true
  }));

  const durations = Array.from({ length: 8 }, (_, i) => ({
    zone: i + 1,
    code: 'irrigation_time_all',
    name: 'Duração da zona ' + (i + 1) + ' • DP45 RAW',
    current: null,
    min: 1,
    max: 1440,
    step: 1,
    scale: 0,
    unit: 'min',
    native_raw: true
  }));

  const scheduleCandidates = [...(mapping.schedule_candidates || [])];
  if (hasCode('normal_time', functions, statusSpec, statusMap, shadowMap) &&
      !scheduleCandidates.some(x => x.code === 'normal_time')) {
    scheduleCandidates.push({
      code: 'normal_time',
      name: 'Programação por zona • DP38',
      type: 'string',
      values: {}
    });
  }

  return {
    ...mapping,
    native_profile: 'IIC-800-DP45',
    native_dp45: true,
    active_mask: activeMask,
    operation_mode: Object.prototype.hasOwnProperty.call(statusMap, 'operation_mode')
      ? statusMap.operation_mode
      : shadowMap.operation_mode ?? null,
    irrigation_mode: Object.prototype.hasOwnProperty.call(statusMap, 'irrigation_mode')
      ? statusMap.irrigation_mode
      : shadowMap.irrigation_mode ?? null,
    controls,
    durations,
    schedule_candidates: scheduleCandidates,
    zones_found: [1,2,3,4,5,6,7,8],
    mapped_count: 8,
    duration_mapped_count: 8,
    ready: true,
    control_ready: true,
    duration_ready: true
  };
}

function classifyAccess(errors, linked) {
  if (linked) {
    return {
      state: 'accessible',
      title: 'Acesso remoto disponível',
      detail: 'O projeto Tuya consegue consultar o IIC-800. Podemos continuar sem ir até a fazenda.'
    };
  }

  const text = Object.values(errors).filter(Boolean).join(' | ').toLowerCase();

  if (/permission|permission deny|no permission|unauthor|not authorized|access denied|1106|1010|28841105/.test(text)) {
    return {
      state: 'oem_locked',
      title: 'Controlador vinculado ao cloud da INKBIRD',
      detail: 'O Device ID responde como não autorizado para este projeto Tuya. O aparelho continua online no app INKBIRD, mas a nuvem atual não liberou acesso ao nosso projeto.'
    };
  }

  if (/not exist|device.*not found|invalid device|does not exist|2009|1100/.test(text)) {
    return {
      state: 'not_found',
      title: 'Device ID não localizado neste projeto',
      detail: 'O controlador não está vinculado ao projeto Tuya atual. Ainda não é necessário resetar o aparelho; primeiro podemos tentar autorização remota da conta/app.'
    };
  }

  return {
    state: 'unknown',
    title: 'Acesso remoto ainda não confirmado',
    detail: 'A Tuya não devolveu dados suficientes para identificar o controlador. Veja os erros técnicos para o próximo passo.'
  };
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok:false, error:'Método não permitido.' });
  if (!authorize(req, res) || !ensureCloudConfig(res)) return;

  let resolved;
  try {
    const preferredId = String(req.query?.device_id || '').trim();
    resolved = await resolveInkbirdDevice(preferredId);
  } catch (error) {
    return res.status(502).json({ ok:false, linked:false, error:error.message || 'Falha ao listar dispositivos do projeto Tuya.' });
  }

  const deviceId = resolved.id;
  if (!deviceId) {
    return res.status(200).json({
      ok: true,
      configured: true,
      linked: false,
      model: 'IIC-800-WIFI',
      zones: 8,
      access: {
        state: 'not_found',
        title: 'IIC-800 ainda não apareceu no projeto Tuya',
        detail: 'O controlador está no Smart Life, mas o projeto Tuya ainda não sincronizou esse novo dispositivo.'
      },
      candidates: resolved.devices.map((d,index) => ({id:d.id,name:d.name,online:d.online,category:d.category,model:d.model,controller_index:index+1,sector_start:index*8+1,sector_end:index*8+8}))
    });
  }

  const [legacyInfoR, infoR, specR, funcsR, statusR, shadowR] = await Promise.allSettled([
    tuyaRequest('GET', `/v1.0/devices/${deviceId}`),
    tuyaRequest('GET', `/v1.1/iot-03/devices/${deviceId}`),
    tuyaRequest('GET', `/v1.0/iot-03/devices/${deviceId}/specification`),
    tuyaRequest('GET', `/v1.0/iot-03/devices/${deviceId}/functions`),
    tuyaRequest('GET', `/v1.0/iot-03/devices/${deviceId}/status`),
    tuyaRequest('GET', `/v2.0/cloud/thing/${deviceId}/shadow/properties`)
  ]);

  const legacyInfo = settleValue(legacyInfoR);
  const info = settleValue(infoR) || legacyInfo;
  const specification = settleValue(specR);
  const functionsResult = settleValue(funcsR);
  const statusList = settleValue(statusR, []);
  const shadow = settleValue(shadowR);

  const statusMap = Object.fromEntries(
    (Array.isArray(statusList) ? statusList : []).map(item => [item.code, item.value])
  );

  const shadowList = Array.isArray(shadow?.properties) ? shadow.properties : [];
  const shadowMap = Object.fromEntries(shadowList.map(item => [item.code, item.value]));

  const functions = Array.isArray(functionsResult)
    ? functionsResult
    : Array.isArray(functionsResult?.functions)
      ? functionsResult.functions
      : Array.isArray(specification?.functions)
        ? specification.functions
        : [];

  const statusSpec = Array.isArray(specification?.status) ? specification.status : [];

  const errors = {
    legacy_info: settleError(legacyInfoR),
    info: settleError(infoR),
    specification: settleError(specR),
    functions: settleError(funcsR),
    status: settleError(statusR),
    shadow: settleError(shadowR)
  };

  const linked = Boolean(
    info ||
    specification ||
    functions.length ||
    (Array.isArray(statusList) && statusList.length) ||
    shadowList.length
  );

  const access = classifyAccess(errors, linked);
  const genericMapping = buildZoneCandidates(functions, statusSpec, statusMap, shadowMap);
  const mapping = applyNativeIic800Profile(genericMapping, functions, statusSpec, statusMap, shadowMap, info);
  const controllerIndex = Math.max(1, resolved.devices.findIndex(d => d.id === deviceId) + 1);
  const sectorStart = (controllerIndex - 1) * 8 + 1;

  return res.status(200).json({
    ok: true,
    configured: true,
    linked,
    model: 'IIC-800-WIFI',
    zones: 8,
    controller_index: controllerIndex,
    sector_start: sectorStart,
    sector_end: sectorStart + 7,
    access,
    mapping,
    discovery_source: resolved.source,
    device: {
      id: deviceId,
      name: info?.name ?? 'INKBIRD IIC-800-WIFI',
      online: info?.online ?? null,
      category: info?.category ?? specification?.category ?? functionsResult?.category ?? null,
      product_id: info?.product_id ?? null
    },
    functions,
    status_spec: statusSpec,
    status: statusMap,
    shadow: shadowMap,
    candidates: resolved.devices.map((d,index) => ({id:d.id,name:d.name,online:d.online,category:d.category,model:d.model,controller_index:index+1,sector_start:index*8+1,sector_end:index*8+8})),
    errors
  });
}
