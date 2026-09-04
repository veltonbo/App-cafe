export function cleanCycleRaw(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, '').toLowerCase() : '';
}

function read16(hex, byteIndex, endian) {
  const p = byteIndex * 2;
  const a = parseInt(hex.slice(p, p + 2), 16);
  const b = parseInt(hex.slice(p + 2, p + 4), 16);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  return endian === 'le' ? (b << 8) | a : (a << 8) | b;
}

function validValues(v) {
  return Number.isInteger(v.startMinutes) && v.startMinutes >= 0 && v.startMinutes <= 1439 &&
    Number.isInteger(v.endMinutes) && v.endMinutes >= 0 && v.endMinutes <= 1439 &&
    Number.isInteger(v.onMinutes) && v.onMinutes >= 1 && v.onMinutes <= 1440 &&
    Number.isInteger(v.offMinutes) && v.offMinutes >= 1 && v.offMinutes <= 1440;
}

export function decodeCycle(value) {
  const raw = cleanCycleRaw(value);
  if (!/^[0-9a-f]+$/.test(raw) || raw.length < 20) return null;

  const switchByte = parseInt(raw.slice(0, 2), 16);
  const daysMask = parseInt(raw.slice(2, 4), 16) & 0x7f;

  for (const endian of ['be', 'le']) {
    const values = {
      startMinutes: read16(raw, 2, endian),
      endMinutes: read16(raw, 4, endian),
      onMinutes: read16(raw, 6, endian),
      offMinutes: read16(raw, 8, endian),
    };
    if (validValues(values)) {
      return {
        raw,
        endian,
        enabled: Boolean(switchByte & 0x01),
        switchByte,
        daysMask,
        ...values,
        extraNodesRaw: raw.slice(20)
      };
    }
  }
  return null;
}

function hexByte(n) {
  return (n & 0xff).toString(16).padStart(2, '0');
}

function hex16(n, endian) {
  const hi = (n >> 8) & 0xff;
  const lo = n & 0xff;
  return endian === 'le' ? hexByte(lo) + hexByte(hi) : hexByte(hi) + hexByte(lo);
}

export function encodeCycle(config, currentRaw = '') {
  const decoded = decodeCycle(currentRaw);
  const endian = decoded?.endian || 'be';

  const onMinutes = Number(config.onMinutes);
  const offMinutes = Number(config.offMinutes);
  const startMinutes = Number(config.startMinutes);
  const endMinutes = Number(config.endMinutes);
  const daysMask = Number(config.daysMask);
  const enabled = config.enabled !== false;

  const values = { onMinutes, offMinutes, startMinutes, endMinutes };
  if (!validValues(values)) throw new Error('Tempos do ciclo fora do limite permitido.');
  if (!Number.isInteger(daysMask) || daysMask < 1 || daysMask > 127) {
    throw new Error('Selecione pelo menos um dia da semana.');
  }
  if (endMinutes <= startMinutes) {
    throw new Error('O horário final deve ser depois do horário inicial.');
  }

  const currentSwitch = decoded?.switchByte ?? 0x03;
  const switchByte = enabled ? (currentSwitch | 0x01) : (currentSwitch & 0xfe);

  const node =
    hexByte(switchByte) +
    hexByte(daysMask) +
    hex16(startMinutes, endian) +
    hex16(endMinutes, endian) +
    hex16(onMinutes, endian) +
    hex16(offMinutes, endian);

  return {
    raw: node + (decoded?.extraNodesRaw || ''),
    nodeRaw: node,
    endian,
    enabled,
    daysMask,
    startMinutes,
    endMinutes,
    onMinutes,
    offMinutes
  };
}

export function minutesToTime(value) {
  const mins = Number(value);
  if (!Number.isFinite(mins)) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
