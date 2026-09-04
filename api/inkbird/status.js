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

  return {
    candidates,
    zones_found: zonesFound,
    mapped_count: zonesFound.length,
    ready: zonesFound.length === 8
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

  const functions = Array.isArray(functionsResult?.functions)
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
  const mapping = buildZoneCandidates(functions, statusSpec, statusMap, shadowMap);
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
