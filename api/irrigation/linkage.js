import { applyCors, authorize, ensureCloudConfig, tuyaRequest } from '../_tuya.js';
import { listInkbirdDevices } from '../inkbird/_device.js';
import { fetchWeatherSnapshot } from '../weather/_weather.js';

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'Método não permitido.'});
  if(!authorize(req,res)||!ensureCloudConfig(res))return;

  try{
    const weather=await fetchWeatherSnapshot();
    const controllers=await listInkbirdDevices();
    const weatherId=weather?.device?.id||null;

    const weatherLinkR=weatherId
      ? await Promise.allSettled([
          tuyaRequest('GET',`/v1.0/devices/${weatherId}/enable-linkage/codes`),
          tuyaRequest('GET',`/v2.0/cloud/thing/${weatherId}`)
        ])
      : [];

    const controllerRows=[];
    for(const ctrl of controllers){
      const [linkR,infoR]=await Promise.allSettled([
        tuyaRequest('GET',`/v1.0/devices/${ctrl.id}/enable-linkage/codes`),
        tuyaRequest('GET',`/v2.0/cloud/thing/${ctrl.id}`)
      ]);
      controllerRows.push({
        id:ctrl.id,
        name:ctrl.name,
        linkage:linkR.status==='fulfilled'?linkR.value:null,
        info:infoR.status==='fulfilled'?infoR.value:null,
        errors:{
          linkage:linkR.status==='rejected'?(linkR.reason?.message||String(linkR.reason)):null,
          info:infoR.status==='rejected'?(infoR.reason?.message||String(infoR.reason)):null
        }
      });
    }

    const weatherInfo=weatherLinkR[1]?.status==='fulfilled'?weatherLinkR[1].value:null;
    const possibleSpaces=[
      weatherInfo?.space_id,weatherInfo?.spaceId,weatherInfo?.asset_id,weatherInfo?.home_id,
      ...controllerRows.flatMap(x=>[x.info?.space_id,x.info?.spaceId,x.info?.asset_id,x.info?.home_id])
    ].filter(Boolean);

    return res.status(200).json({
      ok:true,
      weather:{
        id:weatherId,
        name:weather?.device?.name||'Weather2-2',
        linkage:weatherLinkR[0]?.status==='fulfilled'?weatherLinkR[0].value:null,
        info:weatherInfo,
        error:weatherLinkR[0]?.status==='rejected'?(weatherLinkR[0].reason?.message||String(weatherLinkR[0].reason)):null
      },
      controllers:controllerRows,
      possible_space_ids:[...new Set(possibleSpaces.map(String))]
    });
  }catch(error){
    return res.status(502).json({ok:false,error:error.message||'Falha ao verificar automação Tuya.'});
  }
}
