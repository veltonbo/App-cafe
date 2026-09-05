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

  for (let page = 0; page < 10; page++) {
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

export async function listInkbirdDevices() {
  const devices = await listProjectDevices();
  return devices
    .map(device => ({
      device,
      score: scoreDevice(device),
      id: device?.id || device?.device_id
    }))
    .filter(item => item.id && item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const an = String(a.device?.name || a.device?.custom_name || '');
      const bn = String(b.device?.name || b.device?.custom_name || '');
      return an.localeCompare(bn, 'pt-BR');
    })
    .map((item, index) => ({
      id: item.id,
      name: item.device?.name || item.device?.customName || item.device?.custom_name || `INKBIRD ${index + 1}`,
      online: item.device?.online ?? null,
      category: item.device?.category ?? null,
      product_name: item.device?.productName || item.device?.product_name || null,
      model: item.device?.model || 'IIC-800-WIFI',
      score: item.score,
      raw: item.device
    }));
}

export async function resolveInkbirdDevice(preferredId = '') {
  const inkbirds = await listInkbirdDevices();

  if (preferredId) {
    const selected = inkbirds.find(item => item.id === preferredId);
    if (selected) {
      return {
        id: selected.id,
        source: 'selected',
        candidate: selected.raw,
        devices: inkbirds
      };
    }
  }

  if (inkbirds.length) {
    return {
      id: inkbirds[0].id,
      source: 'discovery',
      candidate: inkbirds[0].raw,
      devices: inkbirds
    };
  }

  if (FALLBACK_ID) {
    return {
      id: FALLBACK_ID,
      source: 'env',
      candidate: null,
      devices: inkbirds
    };
  }

  return {
    id: null,
    source: 'none',
    candidate: null,
    devices: inkbirds
  };
}
