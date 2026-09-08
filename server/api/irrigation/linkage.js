import { applyCors, authorize } from '../_tuya.js';
import { listInkbirdDevices } from '../inkbird/_device.js';
import { readInkbirdState } from '../inkbird/_transport.js';
import { fetchWeatherSnapshot } from '../weather/_weather.js';

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'Método não permitido.'});
  if(!authorize(req,res))return;

  try{
    const [weather,controllers]=await Promise.all([
      fetchWeatherSnapshot({maxAgeMs:5000}),
      listInkbirdDevices()
    ]);
    const rows=await Promise.all(controllers.map(async(ctrl)=>{
      try{
        const state=await readInkbirdState({deviceId:ctrl.id,maxAgeMs:2500});
        return{
          id:ctrl.id,
          name:ctrl.name,
          online:state.online!==false,
          provider:'smartlife',
          dp38:Object.prototype.hasOwnProperty.call(state.statusMap,'normal_timer'),
          dp44:Object.prototype.hasOwnProperty.call(state.statusMap,'irrigation_mode'),
          dp45:Object.prototype.hasOwnProperty.call(state.statusMap,'irrigation_time_all')
        };
      }catch(error){
        return{id:ctrl.id,name:ctrl.name,online:false,provider:'smartlife',error:error?.message||String(error)};
      }
    }));

    return res.status(200).json({
      ok:true,
      provider:'smartlife',
      cloud_linkage:false,
      server_guard:true,
      weather:{
        id:weather?.device?.id||null,
        name:weather?.device?.name||'Weather2-2',
        online:weather?.device?.online!==false,
        linked:Boolean(weather?.linked),
        rain_detected:Boolean(weather?.metrics?.rainDetected)
      },
      controllers:rows,
      possible_space_ids:[],
      note:'A proteção Weather2-2 ↔ IIC-800 é aplicada pelo Railway usando Smart Life. O IoT Core antigo não é necessário.'
    });
  }catch(error){
    return res.status(502).json({
      ok:false,error:error?.message||'Falha ao verificar integração Smart Life.'
    });
  }
}
