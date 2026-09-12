import fsp from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR=String(process.env.DATA_DIR||'/data');
const FILE=path.join(DATA_DIR,'viveiro-device.json');

export async function getViveiroBinding(){
  try{
    const raw=await fsp.readFile(FILE,'utf8');
    const data=JSON.parse(raw);
    return{
      deviceId:String(data?.deviceId||'').trim()||null,
      deviceName:String(data?.deviceName||'').trim()||null,
      selectedAt:data?.selectedAt||null
    };
  }catch{
    return{deviceId:null,deviceName:null,selectedAt:null};
  }
}

export async function setViveiroBinding({deviceId,deviceName=null}={}){
  const id=String(deviceId||'').trim();
  if(!id)throw new Error('Dispositivo EKAZA não informado.');
  await fsp.mkdir(DATA_DIR,{recursive:true});
  const data={deviceId:id,deviceName:String(deviceName||'').trim()||null,selectedAt:new Date().toISOString()};
  const tmp=FILE+'.tmp';
  await fsp.writeFile(tmp,JSON.stringify(data,null,2)+'\n','utf8');
  await fsp.rename(tmp,FILE);
  return data;
}

export async function clearViveiroBinding(){
  try{await fsp.unlink(FILE)}catch(error){if(error?.code!=='ENOENT')throw error}
  return{deviceId:null,deviceName:null,selectedAt:null};
}
