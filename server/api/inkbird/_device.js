import { smartLifeListDevices } from '../_smartlife.js';

const FALLBACK_NAME=String(process.env.SMARTLIFE_INKBIRD_NAME||'IIC-800-WIFI').trim();

function scoreDevice(device){
  const text=[
    device?.name,
    device?.product_name,
    device?.category
  ].filter(Boolean).join(' ').toLowerCase();
  const funcs=device?.function||{};
  const status=device?.status||{};
  let score=0;
  if(/iic[- ]?800/.test(text))score+=160;
  if(/inkbird/.test(text))score+=120;
  if(String(device?.category||'').toLowerCase()==='ggq')score+=80;
  if(Object.prototype.hasOwnProperty.call(funcs,'irrigation_time_all'))score+=100;
  if(Object.prototype.hasOwnProperty.call(status,'irrigation_time_all'))score+=80;
  if(Object.prototype.hasOwnProperty.call(funcs,'normal_timer'))score+=40;
  return score;
}

export async function listProjectDevices(){
  return smartLifeListDevices({maxAgeMs:3000});
}

export async function listInkbirdDevices(){
  const devices=await listProjectDevices();
  return devices
    .map(device=>({device,score:scoreDevice(device)}))
    .filter(item=>item.device?.id&&item.score>0)
    .sort((a,b)=>b.score-a.score||String(a.device?.name||'').localeCompare(String(b.device?.name||''),'pt-BR'))
    .map((item,index)=>({
      id:item.device.id,
      name:item.device.name||`INKBIRD ${index+1}`,
      online:item.device.online!==false,
      category:item.device.category||null,
      product_name:item.device.product_name||null,
      product_id:item.device.product_id||null,
      model:'IIC-800-WIFI',
      score:item.score,
      provider:'smartlife',
      raw:item.device
    }));
}

export async function resolveInkbirdDevice(preferredId=''){
  const devices=await listInkbirdDevices();
  if(preferredId){
    const selected=devices.find(item=>String(item.id)===String(preferredId));
    if(selected){
      return{
        id:selected.id,
        source:'selected_smartlife',
        candidate:selected.raw,
        devices
      };
    }
  }

  const byName=devices.find(item=>
    String(item.name||'').trim().toLowerCase()===FALLBACK_NAME.toLowerCase()
  );
  const selected=byName||devices[0]||null;
  return{
    id:selected?.id||null,
    source:selected?'smartlife':'none',
    candidate:selected?.raw||null,
    devices
  };
}
