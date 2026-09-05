import { applyCors, authorize, ensureCloudConfig } from '../_tuya.js';
import { listInkbirdDevices } from './_device.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok:false, error:'Método não permitido.' });
  if (!authorize(req, res) || !ensureCloudConfig(res)) return;

  try {
    const devices = await listInkbirdDevices();
    const controllers = devices.map((device, index) => ({
      id: device.id,
      name: device.name || `INKBIRD ${index + 1}`,
      model: device.model || 'IIC-800-WIFI',
      online: device.online,
      category: device.category,
      controller_index: index + 1,
      sector_start: index * 8 + 1,
      sector_end: index * 8 + 8,
      sectors: Array.from({ length: 8 }, (_, zoneIndex) => ({
        zone: zoneIndex + 1,
        sector: index * 8 + zoneIndex + 1
      }))
    }));

    return res.status(200).json({
      ok: true,
      count: controllers.length,
      controllers
    });
  } catch (error) {
    return res.status(502).json({
      ok:false,
      error:error.message || 'Falha ao listar controladores INKBIRD.'
    });
  }
}
