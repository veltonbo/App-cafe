import crypto from 'node:crypto';
import webpush from 'web-push';
import { storeGet, storeSet } from './_store.js';

const CURVE_N=BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
const SUB_PATH='IrrigacaoFazenda2E/pushSubscriptions';

function b64url(buffer){
  return Buffer.from(buffer).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}

function deriveKeys(){
  const secret=(process.env.APP_CONTROL_TOKEN||'').trim();
  if(!secret)throw new Error('APP_CONTROL_TOKEN não configurado.');
  const digest=crypto.createHash('sha256').update(secret+'|fazenda2e-vapid-v1').digest();
  let n=BigInt('0x'+digest.toString('hex'));
  n=(n%(CURVE_N-1n))+1n;
  let hex=n.toString(16).padStart(64,'0');
  const privateKey=Buffer.from(hex,'hex');
  const ecdh=crypto.createECDH('prime256v1');
  ecdh.setPrivateKey(privateKey);
  const publicKey=ecdh.getPublicKey(null,'uncompressed');
  return{publicKey:b64url(publicKey),privateKey:b64url(privateKey)};
}

export function getVapidPublicKey(){
  return deriveKeys().publicKey;
}

function setup(){
  const keys=deriveKeys();
  webpush.setVapidDetails((process.env.PUBLIC_APP_URL||'https://app-cafe.vercel.app').trim(),keys.publicKey,keys.privateKey);
  return keys;
}

function keyForEndpoint(endpoint){
  return crypto.createHash('sha256').update(String(endpoint||'')).digest('hex');
}

export async function savePushSubscription(subscription,meta={}){
  if(!subscription?.endpoint)throw new Error('Inscrição de notificação inválida.');
  const key=keyForEndpoint(subscription.endpoint);
  const payload={
    subscription,
    meta:{
      userAgent:String(meta.userAgent||'').slice(0,220),
      platform:String(meta.platform||'').slice(0,80),
      createdAt:Date.now(),
      lastSeenAt:Date.now()
    }
  };
  await storeSet(`${SUB_PATH}/${key}`,payload);
  return key;
}

export async function removePushSubscription(endpoint){
  if(!endpoint)return false;
  const key=keyForEndpoint(endpoint);
  await storeSet(`${SUB_PATH}/${key}`,null);
  return true;
}

export async function listPushSubscriptions(){
  const raw=await storeGet(SUB_PATH).catch(()=>null);
  if(!raw||typeof raw!=='object')return[];
  return Object.entries(raw).map(([key,value])=>({key,...(value||{}) })).filter(x=>x.subscription?.endpoint);
}

export async function sendPushAlert(alert){
  setup();
  const subscriptions=await listPushSubscriptions();
  const payload=JSON.stringify({
    title:alert.title||'Fazenda 2E',
    body:alert.body||'Atualização da irrigação.',
    tag:alert.tag||'fazenda2e',
    url:alert.url||'/irrigacao/central/',
    level:alert.level||'info',
    ts:Date.now()
  });
  const results=[];
  for(const item of subscriptions){
    try{
      await webpush.sendNotification(item.subscription,payload,{TTL:300,urgency:alert.level==='critical'?'high':'normal'});
      results.push({key:item.key,ok:true});
    }catch(error){
      const code=Number(error?.statusCode||0);
      if(code===404||code===410){
        await storeSet(`${SUB_PATH}/${item.key}`,null).catch(()=>null);
      }
      results.push({key:item.key,ok:false,statusCode:code,error:error?.message||String(error)});
    }
  }
  return{sent:results.filter(x=>x.ok).length,total:subscriptions.length,results};
}
