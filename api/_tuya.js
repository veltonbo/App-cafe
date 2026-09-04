import { TuyaContext } from '@tuya/tuya-connector-nodejs';

const baseUrl = process.env.TUYA_BASE_URL || 'https://openapi.tuyaus.com';
const accessKey = process.env.TUYA_ACCESS_ID;
const secretKey = process.env.TUYA_ACCESS_SECRET;
const deviceId = process.env.TUYA_DEVICE_ID;
const controlToken = process.env.APP_CONTROL_TOKEN;

export function applyCors(req, res) {
  const origin = req.headers.origin;
  const allowed = new Set([
    'https://veltonbo.github.io',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ]);
  if (origin && allowed.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}

export function authorize(req, res) {
  if (!controlToken) {
    res.status(500).json({ ok: false, error: 'APP_CONTROL_TOKEN não configurado no servidor.' });
    return false;
  }
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${controlToken}`) {
    res.status(401).json({ ok: false, error: 'Não autorizado.' });
    return false;
  }
  return true;
}

export function ensureConfig(res) {
  if (!accessKey || !secretKey || !deviceId) {
    res.status(500).json({ ok: false, error: 'Credenciais Tuya incompletas no servidor.' });
    return false;
  }
  return true;
}

function context() {
  return new TuyaContext({ baseUrl, accessKey, secretKey });
}

export async function tuyaRequest(method, path, body = {}) {
  const ctx = context();
  const response = await ctx.request({ method, path, body });
  const data = response?.data ?? response;
  if (!data?.success) {
    const msg = data?.msg || data?.message || 'Falha na Tuya';
    throw new Error(msg);
  }
  return data.result;
}

export function getDeviceId() {
  return deviceId;
}
