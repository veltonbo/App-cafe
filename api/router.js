import cycle from '../server/api/cycle.js';
import rootStatus from '../server/api/status.js';
import rootSwitch from '../server/api/switch.js';
import weatherStatus from '../server/api/weather/status.js';
import viveiroWeather from '../server/api/viveiro/weather.js';
import viveiroSeconds from '../server/api/viveiro/seconds.js';
import viveiroPulse from '../server/api/viveiro/pulse.js';
import viveiroDashboard from '../server/api/viveiro/dashboard-cached.js';
import irrigationPush from '../server/api/irrigation/push.js';
import irrigationConfig from '../server/api/irrigation/config.js';
import irrigationHistory from '../server/api/irrigation/history.js';
import irrigationLocalHistory from '../server/api/irrigation/local-history.js';
import irrigationMonitor from '../server/api/irrigation/monitor.js';
import irrigationBackups from '../server/api/irrigation/backups.js';
import smartLifeImport from '../server/api/smartlife/import.js';
import smartLifeReauth from '../server/api/smartlife/reauth.js';
import sessionApi from '../server/api/session.js';

const ROUTES={
  'session':sessionApi,
  'cycle':cycle,
  'status':rootStatus,
  'switch':rootSwitch,
  'weather/status':weatherStatus,
  'viveiro/weather':viveiroWeather,
  'viveiro/seconds':viveiroSeconds,
  'viveiro/pulse':viveiroPulse,
  'viveiro/dashboard':viveiroDashboard,
  'irrigation/push':irrigationPush,
  'irrigation/config':irrigationConfig,
  'irrigation/history':irrigationHistory,
  'irrigation/local-history':irrigationLocalHistory,
  'irrigation/monitor':irrigationMonitor,
  'irrigation/backups':irrigationBackups,
  'smartlife/import':smartLifeImport,
  'smartlife/reauth':smartLifeReauth
};

export default async function handler(req,res){
  const route=String(req.query?.route||'').replace(/^\/+|\/+$/g,'');
  const fn=ROUTES[route];
  if(!fn)return res.status(404).json({ok:false,error:'Rota de API não encontrada.'});
  return fn(req,res);
}
