function decodeRawValue(value) {
  if (Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) return Buffer.from(value);
  if (value == null) return Buffer.alloc(0);

  const text = String(value).trim();
  if (!text) return Buffer.alloc(0);

  // Tuya Cloud RAW values are normally Base64.
  try {
    const b64 = Buffer.from(text, 'base64');
    if (b64.length && b64.toString('base64').replace(/=+$/,'') === text.replace(/=+$/,'')) return b64;
  } catch {}

  // Fallback for local/legacy representations.
  if (/^[0-9a-f]+$/i.test(text) && text.length % 2 === 0) {
    try { return Buffer.from(text, 'hex'); } catch {}
  }

  return Buffer.from(text);
}

function encodeRawValue(buffer) {
  return Buffer.from(buffer).toString('base64');
}

export function decodeDp45(value, zones = 8) {
  const data = decodeRawValue(value);
  const result = {
    command_type: 0,
    target: 0,
    running_time: {},
    duration: {}
  };
  if (data.length < 34) return result;

  result.command_type = data[0];
  result.target = data[1];
  for (let zone = 1; zone <= zones; zone++) {
    const rt = 2 + (zone - 1) * 2;
    const dur = 18 + (zone - 1) * 2;
    result.running_time[zone] = data.readUInt16BE(rt);
    result.duration[zone] = data.readUInt16BE(dur);
  }
  return result;
}

export function encodeDp45Manual(durations = {}, zones = 8) {
  const data = Buffer.alloc(34);
  data[0] = 0x01;
  data[1] = 0x01;
  for (let zone = 1; zone <= zones; zone++) {
    const value = Math.max(0, Math.min(65535, Number(durations[zone] || 0)));
    data.writeUInt16BE(value, 2 + (zone - 1) * 2);
  }
  return encodeRawValue(data);
}

export function decodeDp38(value) {
  const data = decodeRawValue(value);
  const channels = [];
  if (!data.length || data.length < 20) return { raw_length:data.length, channels };

  const blocks = Math.min(8, Math.floor(data.length / 20));
  for (let i = 0; i < blocks; i++) {
    const offset = i * 20;
    const block = data.subarray(offset, offset + 20);
    const times = [];
    for (let t = 0; t < 6; t++) {
      const hour = block[2 + t * 2];
      const minute = block[3 + t * 2];
      if (!(hour === 0xff && minute === 0xff) && hour <= 23 && minute <= 59) {
        times.push({ hour, minute, value:`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}` });
      }
    }
    channels.push({
      zone: block[0] || i + 1,
      duration_minutes: block[1],
      enabled: block[1] > 0 && times.length > 0,
      start_times: times,
      cycle_mode: block[14],
      days_mask: block[15],
      interval_start: {
        year_offset: block[16],
        month: block[17],
        day: block[18]
      },
      rain_sensor_follow: block[19] !== 0
    });
  }
  return { raw_length:data.length, channels };
}

function blankScheduleBlock(zone) {
  const b = Buffer.alloc(20, 0);
  b[0] = zone;
  b[1] = 0;
  for (let i = 0; i < 6; i++) {
    b[2 + i * 2] = 0xff;
    b[3 + i * 2] = 0xff;
  }
  b[14] = 0;
  b[15] = 0x7f;
  b[16] = 0;
  b[17] = 0;
  b[18] = 0;
  b[19] = 1;
  return b;
}

export function scheduleBufferFromValue(value) {
  const current = decodeRawValue(value);
  const out = Buffer.alloc(160);
  for (let zone = 1; zone <= 8; zone++) {
    const srcStart = (zone - 1) * 20;
    if (current.length >= srcStart + 20) {
      current.copy(out, srcStart, srcStart, srcStart + 20);
      if (!out[srcStart]) out[srcStart] = zone;
    } else {
      blankScheduleBlock(zone).copy(out, srcStart);
    }
  }
  return out;
}

export function updateDp38Zone(currentValue, zone, config = {}) {
  if (!Number.isInteger(zone) || zone < 1 || zone > 8) throw new Error('Zona inválida.');
  const data = scheduleBufferFromValue(currentValue);
  const offset = (zone - 1) * 20;
  const block = blankScheduleBlock(zone);

  const enabled = config.enabled !== false;
  const duration = enabled ? Math.max(1, Math.min(255, Number(config.duration_minutes || 10))) : 0;
  block[1] = duration;

  const times = Array.isArray(config.start_times) ? config.start_times.slice(0, 6) : [];
  times.forEach((item, i) => {
    const text = typeof item === 'string' ? item : item?.value;
    const match = String(text || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return;
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (h < 0 || h > 23 || m < 0 || m > 59) return;
    block[2 + i * 2] = h;
    block[3 + i * 2] = m;
  });

  const cycleMode = Math.max(0, Math.min(3, Number(config.cycle_mode || 0)));
  block[14] = cycleMode;

  if (cycleMode === 0) {
    block[15] = Math.max(0, Math.min(127, Number(config.days_mask ?? 127)));
  } else if (cycleMode === 3) {
    block[15] = Math.max(1, Math.min(9, Number(config.interval_days || 1)));
  } else {
    block[15] = 0;
  }

  const date = config.interval_start || {};
  block[16] = Math.max(0, Math.min(255, Number(date.year_offset || 0)));
  block[17] = Math.max(0, Math.min(12, Number(date.month || 0)));
  block[18] = Math.max(0, Math.min(31, Number(date.day || 0)));
  block[19] = config.rain_sensor_follow === false ? 0 : 1;

  block.copy(data, offset);

  return {
    raw: encodeRawValue(data),
    decoded: decodeDp38(data.toString('base64'))
  };
}

export function disableAllDp38(currentValue) {
  const data = scheduleBufferFromValue(currentValue);
  for (let zone = 1; zone <= 8; zone++) {
    data[(zone - 1) * 20 + 1] = 0;
  }
  return encodeRawValue(data);
}

export function decodeDp104(value) {
  const data = decodeRawValue(value);
  if (data.length < 4) return null;
  return {
    total_time_minutes: data.readUInt16BE(0),
    zone: data[2],
    manual: ((data[3] >> 4) & 0x0f) !== 0,
    valve_state: data[3] & 0x0f
  };
}
