import { tuyaRequest } from '../_tuya.js';

const FALLBACK_ID = (process.env.INKBIRD_DEVICE_ID || '').trim();

function normalizeList(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.list)) return result.list;
  if (Array.isArray(result?.devices)) return result.devices;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.result)) return result.result;
  return [];
}

function scoreDevice(device) {
  const text = [
    device?.name,
    device?.customName,
    device?.custom_name,
    device?.productName,
    device?.product_name,
    device?.model,
    device?.categoryName,
    device?.category_name
  ].filter(Boolean).join(' ').toLowerCase();

  let score = 0;
  if (/iic[- ]?800/.test(text)) score += 120;
  if (/inkbird/.test(text)) score += 100;
  if (/sprinkler|irrigation|irrigador|rega|controlador/.test(text)) score += 50;
  if (/8\s*(zone|zona)/.test(text)) score += 20;
  return score;
}

export async function listProjectDevices() {
  const all = [];
  let lastId = '';

  for (let page = 0; page < 5; page++) {
    const suffix = lastId ? `&last_id=${encodeURIComponent(lastId)}` : '';
    const result = await tuyaRequest('GET', `/v2.0/cloud/thing/device?page_size=20${suffix}`);
    const list = normalizeList(result);

    if (!list.length) break;
    all.push(...list);

    if (list.length < 20) break;

    const nextLastId = list[list.length - 1]?.id || list[list.length - 1]?.device_id;
    if (!nextLastId || nextLastId === lastId) break;
    lastId = nextLastId;
  }

  const seen = new Set();
  return all.filter(device => {
    const id = device?.id || device?.device_id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export async function resolveInkbirdDevice() {
  const devices = await listProjectDevices();
  const ranked = devices
    .map(device => ({ device, score: scoreDevice(device) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked.find(x => x.score > 0)?.device || null;

  if (best) {
    return {
      id: best.id || best.device_id,
      source: 'discovery',
      candidate: best,
      devices
    };
  }

  if (FALLBACK_ID) {
    return {
      id: FALLBACK_ID,
      source: 'env',
      candidate: null,
      devices
    };
  }

  return {
    id: null,
    source: 'none',
    candidate: null,
    devices
  };
}
