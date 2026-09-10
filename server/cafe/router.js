import weatherStatus from '../api/weather/status.js';
import irrigationHistory from '../api/irrigation/history.js';
import irrigationConfig from '../api/irrigation/config.js';
import inkbirdControllers from '../api/inkbird/controllers.js';
import inkbirdGroup from '../api/inkbird/group.js';
import inkbirdSchedule from '../api/inkbird/schedule.js';
import inkbirdZone from '../api/inkbird/zone.js';
import inkbirdStatus from '../api/inkbird/status.js';
import smartLifeReauth from '../api/smartlife/reauth.js';
import cafeDashboard from '../api/cafe/dashboard.js';

const ROUTES={
  'cafe/dashboard':cafeDashboard,
  'weather/status':weatherStatus,
  'irrigation/history':irrigationHistory,
  'irrigation/config':irrigationConfig,
  'inkbird/controllers':inkbirdControllers,
  'inkbird/group':inkbirdGroup,
  'inkbird/schedule':inkbirdSchedule,
  'inkbird/zone':inkbirdZone,
  'inkbird/status':inkbirdStatus,
  'smartlife/reauth':smartLifeReauth
};

export default async function cafeRouter(req,res){
  const route=String(req.query?.route||'').replace(/^\/+|\/+$/g,'');
  const fn=ROUTES[route];
  if(!fn)return res.status(404).json({ok:false,error:'Rota não disponível no app Irrigação Café.'});
  return fn(req,res);
}
