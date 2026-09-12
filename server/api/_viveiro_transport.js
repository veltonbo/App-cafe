import {
  smartLifeConfigured,
  smartLifeListDevices,
  smartLifeReadDevice,
  smartLifeSendCommands
} from './_smartlife.js';
import { getViveiroBinding } from './_viveiro_binding.js';

const SMARTLIFE_VIVEIRO_NAME=String(process.env.SMARTLIFE_VIVEIRO_NAME||'Viveiro').trim();
let resolvedDevice={id:null,name:null,at:0};
const RESOLVE_CACHE_MS=30_000;

async function ensureSmartLife(){if(!(await smartLifeConfigured()))throw new Error('Smart Life ainda não conectado ao servidor.');}
function norm(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();}
function isWeather(device){const name=norm(device?.name);return /weather|clima|estacao|estação/.test(name);}
export function viveiroDeviceHasRelay(device){
  const status=device?.status&&typeof device.status==='object'?device.status:{};
  const functions=device?.function&&typeof device.function==='object'?device.function:{};
  const range=device?.status_range&&typeof device.status_range==='object'?device.status_range:{};
  return Object.prototype.hasOwnProperty.call(status,'switch_1')||Object.prototype.hasOwnProperty.call(functions,'switch_1')||Object.prototype.hasOwnProperty.call(range,'switch_1');
}
function scoreDevice(device){
  if(!device||isWeather(device)||!viveiroDeviceHasRelay(device))return -1000;
  const name=norm(device.name),preferred=norm(SMARTLIFE_VIVEIRO_NAME);let score=25;
  if(name===preferred)score+=100;if(preferred&&name.includes(preferred))score+=60;if(/viveiro/.test(name))score+=50;if(/ekaza/.test(name))score+=35;if(/irrig/.test(name))score+=30;return score;
}
function chooseRankedDevices(devices){const candidates=devices.map(device=>({device,score:scoreDevice(device)})).filter(x=>x.score>0);const online=candidates.filter(x=>x.device?.online!==false);return(online.length?online:candidates).sort((a,b)=>b.score-a.score);}

async function resolveViveiroDevice({force=false}={}){
  const binding=await getViveiroBinding();
  if(binding.deviceId){
    try{
      const explicit=await smartLifeReadDevice({deviceId:binding.deviceId,maxAgeMs:force?0:4000});
      if(!viveiroDeviceHasRelay(explicit))throw new Error('O EKAZA selecionado não possui o relé switch_1.');
      resolvedDevice={id:explicit?.id||binding.deviceId,name:explicit?.name||binding.deviceName,at:Date.now()};
      return explicit;
    }catch(error){
      throw new Error('O EKAZA selecionado no app não está acessível. Abra Sistema > Smart Life > Trocar EKAZA e escolha outro aparelho. '+(error?.message||''));
    }
  }

  const age=Date.now()-Number(resolvedDevice.at||0);
  if(!force&&resolvedDevice.id&&age>=0&&age<RESOLVE_CACHE_MS){
    try{const cached=await smartLifeReadDevice({deviceId:resolvedDevice.id,maxAgeMs:4000});if(cached?.online!==false)return cached;resolvedDevice={id:null,name:null,at:0};}catch{resolvedDevice={id:null,name:null,at:0};}
  }
  const devices=await smartLifeListDevices({force,maxAgeMs:force?0:4000});
  if(!Array.isArray(devices)||!devices.length)throw new Error('Nenhum dispositivo encontrado no Smart Life.');
  const ranked=chooseRankedDevices(devices);
  if(!ranked.length){const names=devices.map(d=>String(d?.name||'')).filter(Boolean);throw new Error('Não encontrei automaticamente o dispositivo do Viveiro. Dispositivos disponíveis: '+names.join(', '));}
  const best=ranked[0],second=ranked[1];
  if(second&&best.score===second.score&&String(best.device?.id||'')!==String(second.device?.id||''))throw new Error('Há mais de um possível dispositivo ONLINE do Viveiro no Smart Life. Selecione o correto em Sistema > Smart Life > Trocar EKAZA.');
  resolvedDevice={id:best.device?.id||null,name:best.device?.name||null,at:Date.now()};return best.device;
}

export async function readViveiroState(options={}){
  await ensureSmartLife();const binding=await getViveiroBinding();const device=await resolveViveiroDevice({force:Boolean(options?.force)});
  return{provider:'smartlife',deviceId:device?.id||null,deviceName:device?.name||null,autoDetected:!binding.deviceId,selected:Boolean(binding.deviceId),online:device?.online!==false,statusMap:device?.status&&typeof device.status==='object'?device.status:{},device};
}

export async function sendViveiroCommands(commands){
  if(!Array.isArray(commands)||!commands.length)throw new Error('Nenhum comando do Viveiro informado.');
  await ensureSmartLife();const binding=await getViveiroBinding();const target=await resolveViveiroDevice({force:true});
  if(!target?.id)throw new Error('Dispositivo do Viveiro não identificado.');if(target.online===false)throw new Error('O dispositivo do Viveiro está offline no Smart Life.');
  const priority=commands.some(cmd=>cmd?.code==='switch_1'&&cmd?.value===false);
  const device=await smartLifeSendCommands({deviceId:target.id,commands,priority});resolvedDevice={id:device?.id||target.id,name:device?.name||target.name,at:Date.now()};
  return{provider:'smartlife',deviceId:device?.id||target.id||null,deviceName:device?.name||target.name||null,autoDetected:!binding.deviceId,selected:Boolean(binding.deviceId),online:device?.online!==false,statusMap:device?.status&&typeof device.status==='object'?device.status:{},device};
}
