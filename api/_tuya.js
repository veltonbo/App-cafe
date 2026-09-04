import crypto from 'node:crypto';

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

function sha256(text) {
  return crypto.createHash('sha256').update(text || '', 'utf8').digest('hex');
}

function hmac(text) {
  return crypto.createHmac('sha256', secretKey).update(text, 'utf8').digest('hex').toUpperCase();
}

function canonicalPath(path) {
  const u = new URL(path, 'https://placeholder.local');
  const entries = [...u.searchParams.entries()].sort(([a],[b]) => a.localeCompare(b));
  const query = entries.map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return u.pathname + (query ? `?${query}` : '');
}

function stringToSign(method, path, bodyText) {
  return [
    method.toUpperCase(),
    sha256(bodyText),
    '',
    canonicalPath(path)
  ].join('\n');
}

async function signedFetch(method, path, body = null, accessToken = '') {
  const bodyText = body == null ? '' : JSON.stringify(body);
  const t = Date.now().toString();
  const sts = stringToSign(method, path, bodyText);
  const signSource = accessKey + accessToken + t + sts;
  const headers = {
    client_id: accessKey,
    sign: hmac(signSource),
    sign_method: 'HMAC-SHA256',
    t,
    lang: 'en'
  };
  if (accessToken) headers.access_token = accessToken;
  if (body != null) headers['Content-Type'] = 'application/json';

  const r = await fetch(baseUrl + canonicalPath(path), {
    method,
    headers,
    body: body == null ? undefined : bodyText
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.success === false) {
    throw new Error(data.msg || data.message || `Tuya HTTP ${r.status}`);
  }
  return data;
}

async function getAccessToken() {
  const data = await signedFetch('GET', '/v1.0/token?grant_type=1');
  const token = data?.result?.access_token;
  if (!token) throw new Error('A Tuya não retornou access_token.');
  return token;
}

export async function tuyaRequest(method, path, body = null) {
  const token = await getAccessToken();
  const data = await signedFetch(method, path, body, token);
  return data.result;
}

export function getDeviceId() {
  return deviceId;
}
