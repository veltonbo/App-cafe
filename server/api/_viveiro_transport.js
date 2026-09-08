import { getDeviceId, tuyaRequest } from './_tuya.js';
import {
  smartLifeConfigured,
  smartLifeReadDevice,
  smartLifeSendCommands
} from './_smartlife.js';

const SMARTLIFE_VIVEIRO_NAME=String(process.env.SMARTLIFE_VIVEIRO_NAME||'Viveiro').trim();

function normalizeTuyaStatus(result){
  if(Array.isArray(result))return result;
  if(Array.isArray(result?.status))return result.status;
  if(Array.isArray(result?.result))return result.result;
  return[];
}

function toStatusMap(list){
  return Object.fromEntries(
    (Array.isArray(list)?list:[]).map(item=>[item.code,item.value])
  );
}

export async function readViveiroState(){
  let smartLifeError=null;

  if(await smartLifeConfigured()){
    try{
      const device=await smartLifeReadDevice({deviceName:SMARTLIFE_VIVEIRO_NAME});
      return{
        provider:'smartlife',
        deviceId:device?.id||null,
        online:device?.online!==false,
        statusMap:device?.status&&typeof device.status==='object'?device.status:{},
        device
      };
    }catch(error){
      smartLifeError=error?.message||String(error);
    }
  }

  try{
    const deviceId=getDeviceId();
    if(!deviceId)throw new Error('TUYA_DEVICE_ID não configurado.');
    const result=await tuyaRequest('GET',`/v1.0/iot-03/devices/${deviceId}/status`);
    return{
      provider:'tuya_cloud',
      deviceId,
      online:true,
      statusMap:toStatusMap(normalizeTuyaStatus(result)),
      device:null
    };
  }catch(error){
    const cloudError=error?.message||String(error);
    if(smartLifeError){
      throw new Error('Smart Life: '+smartLifeError+' | Tuya Cloud: '+cloudError);
    }
    throw error;
  }
}

export async function sendViveiroCommands(commands){
  if(!Array.isArray(commands)||!commands.length){
    throw new Error('Nenhum comando do Viveiro informado.');
  }

  let smartLifeError=null;
  if(await smartLifeConfigured()){
    try{
      const device=await smartLifeSendCommands({
        deviceName:SMARTLIFE_VIVEIRO_NAME,
        commands
      });
      return{
        provider:'smartlife',
        deviceId:device?.id||null,
        online:device?.online!==false,
        statusMap:device?.status&&typeof device.status==='object'?device.status:{},
        device
      };
    }catch(error){
      smartLifeError=error?.message||String(error);
    }
  }

  try{
    const deviceId=getDeviceId();
    if(!deviceId)throw new Error('TUYA_DEVICE_ID não configurado.');
    await tuyaRequest('POST',`/v1.0/iot-03/devices/${deviceId}/commands`,{commands});
    return{
      provider:'tuya_cloud',
      deviceId,
      online:true,
      statusMap:{},
      device:null
    };
  }catch(error){
    const cloudError=error?.message||String(error);
    if(smartLifeError){
      throw new Error('Smart Life: '+smartLifeError+' | Tuya Cloud: '+cloudError);
    }
    throw error;
  }
}
