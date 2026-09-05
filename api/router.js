import cycle from '../server/api/cycle.js';
import rootStatus from '../server/api/status.js';
import rootSwitch from '../server/api/switch.js';
import weatherStatus from '../server/api/weather/status.js';
import viveiroWeather from '../server/api/viveiro/weather.js';
import viveiroSeconds from '../server/api/viveiro/seconds.js';
import viveiroPulse from '../server/api/viveiro/pulse.js';
import irrigationPush from '../server/api/irrigation/push.js';
import irrigationConfig from '../server/api/irrigation/config.js';
import irrigationHistory from '../server/api/irrigation/history.js';
import irrigationMonitor from '../server/api/irrigation/monitor.js';
import irrigationLinkage from '../server/api/irrigation/linkage.js';
import irrigationOverview from '../server/api/irrigation/overview.js';
import irrigationBackground from '../server/api/irrigation/background.js';
import inkbirdControllers from '../server/api/inkbird/controllers.js';
import inkbirdCommand from '../server/api/inkbird/command.js';
import inkbirdGroup from '../server/api/inkbird/group.js';
import inkbirdSchedule from '../server/api/inkbird/schedule.js';
import inkbirdZone from '../server/api/inkbird/zone.js';
import inkbirdStatus from '../server/api/inkbird/status.js';

const ROUTES={
  'cycle':cycle,
  'status':rootStatus,
  'switch':rootSwitch,
  'weather/status':weatherStatus,
  'viveiro/weather':viveiroWeather,
  'viveiro/seconds':viveiroSeconds,
  'viveiro/pulse':viveiroPulse,
  'irrigation/push':irrigationPush,
  'irrigation/config':irrigationConfig,
  'irrigation/history':irrigationHistory,
  'irrigation/monitor':irrigationMonitor,
  'irrigation/linkage':irrigationLinkage,
  'irrigation/overview':irrigationOverview,
  'irrigation/background':irrigationBackground,
  'inkbird/controllers':inkbirdControllers,
  'inkbird/command':inkbirdCommand,
  'inkbird/group':inkbirdGroup,
  'inkbird/schedule':inkbirdSchedule,
  'inkbird/zone':inkbirdZone,
  'inkbird/status':inkbirdStatus
};

export default async function handler(req,res){
  const route=String(req.query?.route||'').replace(/^\/+|\/+$/g,'');
  const fn=ROUTES[route];
  if(!fn)return res.status(404).json({ok:false,error:'Rota de API não encontrada.'});
  return fn(req,res);
}
