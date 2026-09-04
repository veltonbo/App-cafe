import { applyCors, authorize, ensureCloudConfig } from '../_tuya.js';
import { fetchWeatherSnapshot } from './_weather.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ ok:false, error:'Método não permitido.' });
  if (!authorize(req, res) || !ensureCloudConfig(res)) return;

  try {
    const snapshot = await fetchWeatherSnapshot();
    return res.status(200).json(snapshot);
  } catch (error) {
    return res.status(502).json({
      ok:false,
      linked:false,
      error:error.message || 'Falha ao consultar estação meteorológica.'
    });
  }
}
