export function cleanCycleRaw(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, '') : '';
}

function validValues(v) {
  return Number.isInteger(v.startMinutes) && v.startMinutes >= 0 && v.startMinutes <= 1439 &&
    Number.isInteger(v.endMinutes) && v.endMinutes >= 0 && v.endMinutes <= 1439 &&
    Number.isInteger(v.onMinutes) && v.onMinutes >= 1 && v.onMinutes <= 1440 &&
    Number.isInteger(v.offMinutes) && v.offMinutes >= 1 && v.offMinutes <= 1440;
}

function parseNodes(value) {
  const raw = cleanCycleRaw(value);
  if (!raw) return { raw: '', buffer: Buffer.alloc(0), nodes: [] };

  let buffer;
  try {
    buffer = Buffer.from(raw, 'base64');
  } catch {
    return null;
  }

  if (!buffer.length || buffer.length % 10 !== 0) return null;

  const nodes = [];
  for (let offset = 0; offset < buffer.length; offset += 10) {
    const switchByte = buffer[offset];
    const node = {
      index: offset / 10,
      switchByte,
      enabled: Boolean(switchByte & 0x01),
      daysMask: buffer[offset + 1] & 0x7f,
      startMinutes: buffer.readUInt16BE(offset + 2),
      endMinutes: buffer.readUInt16BE(offset + 4),
      onMinutes: buffer.readUInt16BE(offset + 6),
      offMinutes: buffer.readUInt16BE(offset + 8)
    };
    if (!validValues(node)) return null;
    nodes.push(node);
  }

  return { raw, buffer, nodes };
}

export function decodeCycle(value) {
  const parsed = parseNodes(value);
  if (!parsed || !parsed.nodes.length) return null;

  const first = parsed.nodes[0];
  return {
    raw: parsed.raw,
    encoding: 'base64',
    ...first,
    nodes: parsed.nodes,
    extraNodesRaw: parsed.nodes.length > 1
      ? parsed.buffer.subarray(10).toString('base64')
      : ''
  };
}

export function encodeCycle(config, currentRaw = '') {
  const parsed = parseNodes(currentRaw);
  const current = parsed?.nodes?.[0] || null;

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

  const node = Buffer.alloc(10);
  const currentSwitch = current?.switchByte ?? 0x03;
  const switchByte = enabled ? (currentSwitch | 0x01) : (currentSwitch & 0xfe);

  node[0] = switchByte;
  node[1] = daysMask & 0x7f;
  node.writeUInt16BE(startMinutes, 2);
  node.writeUInt16BE(endMinutes, 4);
  node.writeUInt16BE(onMinutes, 6);
  node.writeUInt16BE(offMinutes, 8);

  const extra = parsed?.buffer?.length > 10 ? parsed.buffer.subarray(10) : Buffer.alloc(0);
  const output = Buffer.concat([node, extra]);

  return {
    raw: output.toString('base64'),
    nodeRaw: node.toString('base64'),
    encoding: 'base64',
    enabled,
    switchByte,
    daysMask,
    startMinutes,
    endMinutes,
    onMinutes,
    offMinutes,
    nodesPreserved: extra.length / 10
  };
}

export function minutesToTime(value) {
  const mins = Number(value);
  if (!Number.isFinite(mins)) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
