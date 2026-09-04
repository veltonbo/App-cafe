import { ensureCloudConfig, tuyaRequest } from '../_tuya.js';
import { listInkbirdDevices } from '../inkbird/_device.js';
import { disableAllDp38 } from '../inkbird/_iic800.js';
import { fetchWeatherSnapshot, decideWeather } from '../weather/_weather.js';
import { appendHistory, getAutomationConfig, storeGet, storeSet } from './_store.js';

function token(req) {
  const header=String(req.headers.authorization||'');
  return header.toLowerCase().startsWith('bearer ')?header.slice(7).trim():'';
}
function allowed(req) {
  const supplied=token(req);
  const cron=(process.env.CRON_SECRET||'').trim();
  const app=(process.env.APP_CONTROL_TOKEN||'').trim();
  return Boolean(supplied&&((cron&&supplied===cron)||(app&&supplied===app)));
}
function normalizeStatus(result){
  if(Array.isArray(result))return result;
  if(Array.isArray(result?.status))return result.status;
  if(Array.isArray(result?.result))return result.result;
  return [];
}
function normalizeShadow(result){
  if(Array.isArray(result?.properties))return result.properties;
  if(Array.isArray(result))return result;
  return [];
}
async function readScheduleRaw(deviceId){
  const [sR,shR]=await Promise.allSettled([
    tuyaRequest('GET',`/v1.0/iot-03/devices/${deviceId}/status`),
    tuyaRequest('GET',`/v2.0/cloud/thing/${deviceId}/shadow/properties`)
  ]);
  const status=sR.status==='fulfilled'?normalizeStatus(sR.value):[];
  const shadow=shR.status==='fulfilled'?normalizeShadow(shR.value):[];
  return status.find(x=>x.code==='normal_time')?.value??shadow.find(x=>x.code==='normal_time')?.value??null;
}
async function writeScheduleRaw(deviceId,value){
  return tuyaRequest('POST',`/v1.0/iot-03/devices/${deviceId}/commands`,{
    commands:[{code:'normal_time',value}]
  });
}

export default async function handler(req,res){
  if(req.method!=='GET'&&req.method!=='POST')return res.status(405).json({ok:false,error:'Método não permitido.'});
  if(!allowed(req))return res.status(401).json({ok:false,error:'Não autorizado.'});
  if(!ensureCloudConfig(res))return;

  try{
    const config=await getAutomationConfig();
    const policy=config?.weather||{};
    if(policy.backgroundProtection!==true){
      return res.status(200).json({ok:true,enabled:false,message:'Proteção meteorológica em segundo plano desativada.'});
    }

    const snapshot=await fetchWeatherSnapshot();
    const weatherState=(await storeGet('IrrigacaoFazenda2E/weatherState').catch(()=>null))||{};
    if(snapshot?.metrics?.rainDetected)weatherState.lastRainAt=Date.now();
    const decision=decideWeather(snapshot,policy,weatherState);
    await storeSet('IrrigacaoFazenda2E/weatherState',{
      ...weatherState,checkedAt:Date.now(),decision,
      snapshot:{linked:snapshot?.linked||false,online:snapshot?.device?.online??null,metrics:snapshot?.metrics||null}
    }).catch(()=>null);

    const controllers=await listInkbirdDevices();
    const results=[];

    for(let i=0;i<controllers.length;i++){
      const ctrl=controllers[i],id=ctrl.id;
      const state=(await storeGet(`IrrigacaoFazenda2E/background/${id}`).catch(()=>null))||{};

      if(decision.blocked&&!state.suspended){
        const raw=await readScheduleRaw(id);
        if(raw==null){results.push({device_id:id,action:'skip',reason:'agenda_indisponivel'});continue;}
        const disabledRaw=disableAllDp38(raw);
        await writeScheduleRaw(id,disabledRaw);
        await storeSet(`IrrigacaoFazenda2E/background/${id}`,{
          suspended:true,saved_raw:raw,suspended_at:Date.now(),reason:decision
        });
        await appendHistory({
          type:'weather_suspend',controller_id:id,controller_index:i+1,source:'server_weather',
          status:'confirmed',detail:'Agenda automática suspensa pelo clima',weather:decision
        });
        results.push({device_id:id,action:'suspended'});
      }else if(!decision.blocked&&state.suspended&&state.saved_raw){
        await writeScheduleRaw(id,state.saved_raw);
        await storeSet(`IrrigacaoFazenda2E/background/${id}`,{
          suspended:false,restored_at:Date.now(),saved_raw:null
        });
        await appendHistory({
          type:'weather_restore',controller_id:id,controller_index:i+1,source:'server_weather',
          status:'confirmed',detail:'Agenda automática restaurada após liberação do clima',weather:decision
        });
        results.push({device_id:id,action:'restored'});
      }else{
        results.push({device_id:id,action:'none',suspended:Boolean(state.suspended)});
      }
    }

    return res.status(200).json({ok:true,enabled:true,decision,controllers:results});
  }catch(error){
    return res.status(502).json({ok:false,error:error.message||'Falha na proteção meteorológica em segundo plano.'});
  }
}
