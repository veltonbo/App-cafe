import {
  smartLifeConfigured,
  smartLifeReadDevice,
  smartLifeSendCommands
} from './_smartlife.js';

const SMARTLIFE_VIVEIRO_ID=String(process.env.SMARTLIFE_VIVEIRO_ID||'').trim();
const SMARTLIFE_VIVEIRO_NAME=String(process.env.SMARTLIFE_VIVEIRO_NAME||'Viveiro').trim();

async function ensureSmartLife(){
  if(!(await smartLifeConfigured())){
    throw new Error('Smart Life ainda não conectado ao servidor.');
  }
}

export async function readViveiroState(options={}){
  await ensureSmartLife();
  const device=await smartLifeReadDevice({
    deviceId:SMARTLIFE_VIVEIRO_ID||null,
    deviceName:SMARTLIFE_VIVEIRO_ID?null:SMARTLIFE_VIVEIRO_NAME,
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
}

export async function sendViveiroCommands(commands){
  if(!Array.isArray(commands)||!commands.length){
    throw new Error('Nenhum comando do Viveiro informado.');
  }
  await ensureSmartLife();
  const priority=commands.some(cmd=>cmd?.code==='switch_1'&&cmd?.value===false);
  const device=await smartLifeSendCommands({
    deviceId:SMARTLIFE_VIVEIRO_ID||null,
    deviceName:SMARTLIFE_VIVEIRO_ID?null:SMARTLIFE_VIVEIRO_NAME,
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
}
