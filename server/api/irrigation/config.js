import { applyCors, authorize } from '../_tuya.js';
import { getAutomationConfig, patchAutomationConfig } from './_store.js';
import { createConfigBackup } from './_backup.js';

function sanitize(body = {}) {
  const out = {};

  if (body.weather && typeof body.weather === 'object') {
    out.weather = {
      enabled: body.weather.enabled !== false,
      rainThreshold: Math.max(0, Number(body.weather.rainThreshold ?? 5)),
      rainHoldHours: Math.max(0, Math.min(168, Number(body.weather.rainHoldHours ?? 12))),
      blockWhileRaining: body.weather.blockWhileRaining !== false,
      backgroundProtection: body.weather.backgroundProtection === true
    };
  }

  if (body.profiles && typeof body.profiles === 'object') out.profiles = body.profiles;
  if (body.groups && typeof body.groups === 'object') out.groups = body.groups;
  if (body.controllerPrefs && typeof body.controllerPrefs === 'object') out.controllerPrefs = body.controllerPrefs;

  if (body.waterFlow && typeof body.waterFlow === 'object') {
    const cleaned = {};
    for (const [controllerId, zones] of Object.entries(body.waterFlow)) {
      if (!zones || typeof zones !== 'object') continue;
      cleaned[controllerId] = {};
      for (const [zone, value] of Object.entries(zones)) {
        const z = Number(zone);
        const flow = Number(value);
        if (Number.isInteger(z) && z >= 1 && z <= 8 && Number.isFinite(flow) && flow >= 0 && flow <= 100000) {
          cleaned[controllerId][z] = flow;
        }
      }
    }
    out.waterFlow = cleaned;
  }

  if (body.alerts && typeof body.alerts === 'object') {
    const priorities=body.alerts.priorities&&typeof body.alerts.priorities==='object'?body.alerts.priorities:{};
    const channels=body.alerts.channels&&typeof body.alerts.channels==='object'?body.alerts.channels:{};
    out.alerts = {
      weather: body.alerts.weather !== false,
      offline: body.alerts.offline !== false,
      overdue: body.alerts.overdue !== false,
      irrigation: body.alerts.irrigation !== false,
      priorities:{
        critical:priorities.critical !== false,
        warning:priorities.warning !== false,
        info:priorities.info === true
      },
      channels:{
        push:channels.push !== false,
        whatsapp:channels.whatsapp === true
      }
    };
  }

  out.updated_at = new Date().toISOString();
  return out;
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!authorize(req, res)) return;

  try {
    if (req.method === 'GET') {
      const config = await getAutomationConfig();
      return res.status(200).json({ ok:true, config:config || {} });
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
      const patch = sanitize(req.body || {});
      await createConfigBackup('antes_de_salvar_configuracao').catch(()=>null);
      await patchAutomationConfig(patch);
      const config = await getAutomationConfig();
      return res.status(200).json({ ok:true, config:config || {} });
    }

    return res.status(405).json({ ok:false, error:'Método não permitido.' });
  } catch (error) {
    return res.status(502).json({
      ok:false,
      error:error.message || 'Falha ao salvar configurações da irrigação.'
    });
  }
}
