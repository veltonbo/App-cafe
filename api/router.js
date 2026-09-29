import cycle from '../server/api/cycle.js';
import rootStatus from '../server/api/status.js';
import rootSwitch from '../server/api/switch.js';
import weatherStatus from '../server/api/weather/status.js';
import weatherForecast from '../server/api/weather/forecast.js';
import viveiroWeather from '../server/api/viveiro/weather.js';
import viveiroSeconds from '../server/api/viveiro/seconds.js';
import viveiroPulse from '../server/api/viveiro/pulse.js';
import viveiroDashboard from '../server/api/viveiro/dashboard-cached.js';
import viveiroDevice from '../server/api/viveiro/device.js';
import irrigationPush from '../server/api/irrigation/push.js';
import irrigationConfig from '../server/api/irrigation/config.js';
import irrigationHistory from '../server/api/irrigation/history.js';
import irrigationLocalHistory from '../server/api/irrigation/local-history.js';
import irrigationMonitor from '../server/api/irrigation/monitor.js';
import irrigationBackups from '../server/api/irrigation/backups.js';
import irrigationDiagnostics from '../server/api/irrigation/diagnostics.js';
import irrigationTelegram from '../server/api/irrigation/telegram.js';
import irrigationPythonController from '../server/api/irrigation/python-controller.js';
import smartLifeImport from '../server/api/smartlife/import.js';
import smartLifeReauth from '../server/api/smartlife/reauth.js';
import sessionApi from '../server/api/session.js';
import usersApi from '../server/api/users.js';
import farmApi from '../server/api/farm.js';
import farmManagementApi from '../server/api/farm-management.js';
import farmAttachmentApi from '../server/api/farm-attachment.js';
import farmGeoApi from '../server/api/farm-geo.js';
import farmClonesApi from '../server/api/farm-clones.js';
import farmPlantingApi from '../server/api/farm-planting.js';
import farmRowsApi from '../server/api/farm-rows.js';
import esp32Controller from '../server/api/esp32-controller.js';

const ROUTES={
  'session':sessionApi,
  'users':usersApi,
  'farm':farmApi,
  'farm/management':farmManagementApi,
  'farm/attachment':farmAttachmentApi,
  'farm/geo':farmGeoApi,
  'farm/clones':farmClonesApi,
  'farm/planting':farmPlantingApi,
  'farm/rows':farmRowsApi,
  'esp32/controller':esp32Controller,
  'cycle':cycle,
  'status':rootStatus,
  'switch':rootSwitch,
  'weather/status':weatherStatus,
  'weather/forecast':weatherForecast,
  'viveiro/weather':viveiroWeather,
  'viveiro/seconds':viveiroSeconds,
  'viveiro/pulse':viveiroPulse,
  'viveiro/dashboard':viveiroDashboard,
  'viveiro/device':viveiroDevice,
  'irrigation/push':irrigationPush,
  'irrigation/config':irrigationConfig,
  'irrigation/history':irrigationHistory,
  'irrigation/local-history':irrigationLocalHistory,
  'irrigation/monitor':irrigationMonitor,
  'irrigation/backups':irrigationBackups,
  'irrigation/diagnostics':irrigationDiagnostics,
  'irrigation/telegram':irrigationTelegram,
  'irrigation/python-controller':irrigationPythonController,
  'smartlife/import':smartLifeImport,
  'smartlife/reauth':smartLifeReauth
};

export default async function handler(req,res){
  const route=String(req.query?.route||'').replace(/^\/+|\/+$/g,'');
  const fn=ROUTES[route];
  if(!fn)return res.status(404).json({ok:false,error:'Rota de API não encontrada.'});
  return fn(req,res);
}
