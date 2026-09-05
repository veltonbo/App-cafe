const DB_URL = (process.env.FIREBASE_DATABASE_URL || 'https://manej-cafe-default-rtdb.firebaseio.com').replace(/\/$/,'');

function cleanPath(path) {
  return String(path || '').replace(/^\/+|\/+$/g,'').replace(/[.#$\[\]]/g,'_');
}

async function request(path, options = {}) {
  const url = DB_URL + '/' + cleanPath(path) + '.json';
  const r = await fetch(url, {
    ...options,
    headers: { 'Content-Type':'application/json', ...(options.headers || {}) }
  });
  const text = await r.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!r.ok) throw new Error(body?.error || ('Firebase HTTP ' + r.status));
  return body;
}

export async function storeGet(path) {
  return request(path);
}

export async function storeSet(path, value) {
  return request(path, { method:'PUT', body:JSON.stringify(value) });
}

export async function storePatch(path, value) {
  return request(path, { method:'PATCH', body:JSON.stringify(value) });
}

export async function storePush(path, value) {
  return request(path, { method:'POST', body:JSON.stringify(value) });
}

export async function appendHistory(entry) {
  const payload = {
    ...entry,
    at: entry?.at || new Date().toISOString(),
    ts: entry?.ts || Date.now()
  };
  try {
    return await storePush('IrrigacaoFazenda2E/history', payload);
  } catch (error) {
    return { error:error.message || String(error) };
  }
}

export async function getAutomationConfig() {
  return (await storeGet('IrrigacaoFazenda2E/config')) || {};
}

export async function patchAutomationConfig(value) {
  return storePatch('IrrigacaoFazenda2E/config', value || {});
}
