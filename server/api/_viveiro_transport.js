import { getDeviceId, tuyaRequest } from './_tuya.js';
import {
  smartLifeConfigured,
  smartLifeReadDevice,
  smartLifeSendCommands
} from './_smartlife.js';

const SMARTLIFE_VIVEIRO_NAME=String(process.env.SMARTLIFE_VIVEIRO_NAME||'Viveiro').trim();
const SMARTLIFE_PRIMARY_ONLY=!/^(0|false|no)$/i.test(
  String(process.env.SMARTLIFE_PRIMARY_ONLY||'true').trim()
);

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

export async function readViveiroState(options={}){
  let smartLifeError=null;
  const smartLifeReady=await smartLifeConfigured();

  if(smartLifeReady){
    try{
      const device=await smartLifeReadDevice({
        deviceName:SMARTLIFE_VIVEIRO_NAME,
        force:Boolean(options?.force),
        maxAgeMs:Number.isFinite(Number(options?.maxAgeMs))?Number(options.maxAgeMs):undefined
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
      if(SMARTLIFE_PRIMARY_ONLY){
        throw new Error('Smart Life: '+smartLifeError);
      }
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
  const smartLifeReady=await smartLifeConfigured();

  if(smartLifeReady){
    try{
      const priority=commands.some(cmd=>
        cmd?.code==='switch_1'&&cmd?.value===false
      );
      const device=await smartLifeSendCommands({
        deviceName:SMARTLIFE_VIVEIRO_NAME,
        commands,
        priority
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
      if(SMARTLIFE_PRIMARY_ONLY){
        throw new Error('Smart Life: '+smartLifeError);
      }
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
