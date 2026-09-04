import { tuyaRequest } from '../_tuya.js';

const TARGET_NAME = (process.env.WEATHER_DEVICE_NAME || 'Weather2-2').trim().toLowerCase();

function normalizeList(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.list)) return result.list;
  if (Array.isArray(result?.devices)) return result.devices;
  if (Array.isArray(result?.data)) return result.data;
  return [];
}

function specMap(spec) {
  const all = [
    ...(Array.isArray(spec?.status) ? spec.status : []),
    ...(Array.isArray(spec?.functions) ? spec.functions : [])
  ];
  return Object.fromEntries(all.map(item => [item.code, item]));
}

function parseValuesMeta(item) {
  const raw = item?.values;
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

function collectMetrics(statusMap, shadowMap, spec) {
  const merged = { ...statusMap, ...shadowMap };
  const meta = specMap(spec);
  const rows = Object.entries(merged).map(([code, value]) => {
    const m = meta[code] || {};
    const values = parseValuesMeta(m);
    return {
      code,
      value,
      name: m.name || m.desc || code,
      type: m.type || null,
      unit: values.unit || null,
      scale: Number.isFinite(values.scale) ? values.scale : 0
    };
  });

  const find = (...patterns) => rows.find(r => patterns.some(p => p.test(r.code.toLowerCase()) || p.test(String(r.name).toLowerCase())));

  const rainState = find(/rain.*state/, /rain_sensor/, /precip.*state/, /weather.*rain/);
  const rainToday = find(/rain.*today/, /today.*rain/, /rain_day/, /daily.*rain/, /precip.*today/);
  const rain24h = find(/rain.*24/, /24.*rain/, /rainfall_24/, /precip.*24/);
  const rainRate = find(/rain.*rate/, /rain.*current/, /precip.*rate/, /current.*rain/);
  const rainGeneric = find(/^rain$/, /rainfall$/, /precipitation$/);
  const temp = find(/temp_current/, /^temp/, /temperature/);
  const humidity = find(/humidity_current/, /^humidity/, /^hum/);
  const wind = find(/wind.*speed/, /windspeed/, /^wind_speed/);
  const pressure = find(/pressure/, /barometric/);

  const scaled = row => {
    if (!row || typeof row.value !== 'number') return null;
    const divisor = Math.pow(10, Number(row.scale) || 0);
    return {
      code: row.code,
      value: row.value / divisor,
      raw: row.value,
      unit: row.unit,
      scale: row.scale,
      name: row.name
    };
  };

  const stateText = rainState ? String(rainState.value).toLowerCase() : '';
  const currentRain = [rainRate, rainGeneric].map(scaled).filter(Boolean);

  const rainDetected =
    /rain|raining|wet|yes|true|1/.test(stateText) ||
    currentRain.some(x => x.value > 0);

  return {
    rainDetected,
    rainState: rainState ? { code: rainState.code, value: rainState.value, name: rainState.name } : null,
    rainToday: scaled(rainToday),
    rain24h: scaled(rain24h),
    rainRate: scaled(rainRate),
    rainGeneric: scaled(rainGeneric),
    temperature: scaled(temp),
    humidity: scaled(humidity),
    windSpeed: scaled(wind),
    pressure: scaled(pressure),
    candidates: rows.filter(r => /rain|precip|temp|hum|wind|press|uv|weather/i.test(r.code + ' ' + r.name))
  };
}

export async function fetchWeatherSnapshot() {
  const deviceListResult = await tuyaRequest('GET', '/v2.0/cloud/thing/device?page_size=20');
  const devices = normalizeList(deviceListResult);
  const device = devices.find(d => String(d.name || d.custom_name || '').trim().toLowerCase() === TARGET_NAME)
    || devices.find(d => String(d.name || d.custom_name || '').toLowerCase().includes(TARGET_NAME));

  if (!device) {
    return {
      ok:true,
      linked:false,
      name:'Weather2-2',
      error:'Estação Weather2-2 não encontrada entre os dispositivos do projeto Tuya.',
      devices:devices.map(d => ({ id:d.id || d.device_id, name:d.name || d.custom_name || 'Sem nome', online:d.online ?? null }))
    };
  }

  const deviceId = device.id || device.device_id;
  const [infoR, specR, statusR, shadowR] = await Promise.allSettled([
    tuyaRequest('GET', `/v1.1/iot-03/devices/${deviceId}`),
    tuyaRequest('GET', `/v1.0/iot-03/devices/${deviceId}/specification`),
    tuyaRequest('GET', `/v1.0/iot-03/devices/${deviceId}/status`),
    tuyaRequest('GET', `/v2.0/cloud/thing/${deviceId}/shadow/properties`)
  ]);

  const info = infoR.status === 'fulfilled' ? infoR.value : null;
  const specification = specR.status === 'fulfilled' ? specR.value : null;
  const rawStatus = statusR.status === 'fulfilled' ? statusR.value : [];
  const statusList = Array.isArray(rawStatus) ? rawStatus : Array.isArray(rawStatus?.status) ? rawStatus.status : [];
  const shadow = shadowR.status === 'fulfilled' ? shadowR.value : null;

  const statusMap = Object.fromEntries(statusList.map(item => [item.code, item.value]));
  const shadowList = Array.isArray(shadow?.properties) ? shadow.properties : [];
  const shadowMap = Object.fromEntries(shadowList.map(item => [item.code, item.value]));
  const metrics = collectMetrics(statusMap, shadowMap, specification);

  return {
    ok:true,
    linked:true,
    device:{
      id:deviceId,
      name:info?.name || device.name || 'Weather2-2',
      online:info?.online ?? device.online ?? null,
      category:info?.category || specification?.category || device.category || null,
      product_id:info?.product_id || device.product_id || null
    },
    metrics,
    status:statusMap,
    shadow:shadowMap,
    specification:specification || null,
    errors:{
      info:infoR.status === 'rejected' ? (infoR.reason?.message || String(infoR.reason)) : null,
      specification:specR.status === 'rejected' ? (specR.reason?.message || String(specR.reason)) : null,
      status:statusR.status === 'rejected' ? (statusR.reason?.message || String(statusR.reason)) : null,
      shadow:shadowR.status === 'rejected' ? (shadowR.reason?.message || String(shadowR.reason)) : null
    }
  };
}

function rainAmount(metrics = {}) {
  const x = [metrics.rain24h, metrics.rainToday, metrics.rainGeneric].find(Boolean);
  return x ? Number(x.value) : null;
}

export function decideWeather(snapshot, policy = {}, state = {}) {
  const p = {
    enabled: policy.enabled !== false,
    rainThreshold: Number(policy.rainThreshold ?? 5),
    rainHoldHours: Number(policy.rainHoldHours ?? 12),
    blockWhileRaining: policy.blockWhileRaining !== false
  };

  if (!p.enabled) return { blocked:false, reason:'Proteção meteorológica desativada.', code:'disabled' };
  if (!snapshot?.linked || !snapshot?.metrics) return { blocked:false, reason:'Sem dados meteorológicos suficientes.', code:'no_data' };

  const metrics = snapshot.metrics;
  const amount = rainAmount(metrics);
  if (p.blockWhileRaining && metrics.rainDetected) {
    return { blocked:true, reason:'Chuva detectada pela Weather2-2.', code:'raining', rain_mm:amount };
  }

  const lastRainAt = Number(state.lastRainAt || 0);
  const holdMs = Math.max(0, p.rainHoldHours) * 3600000;
  if (lastRainAt && holdMs > 0 && Date.now() - lastRainAt < holdMs) {
    return {
      blocked:true,
      reason:'Período de espera após chuva ainda ativo.',
      code:'post_rain_hold',
      rain_mm:amount,
      remaining_ms:holdMs - (Date.now() - lastRainAt)
    };
  }

  if (Number.isFinite(amount) && amount >= p.rainThreshold) {
    return {
      blocked:true,
      reason:`Chuva acumulada ${amount} mm acima do limite de ${p.rainThreshold} mm.`,
      code:'rain_threshold',
      rain_mm:amount
    };
  }

  return { blocked:false, reason:'Irrigação liberada pelo clima.', code:'clear', rain_mm:amount };
}
