import { createHmac, timingSafeEqual } from 'node:crypto';
import { TuyaContext } from '@tuya/tuya-connector-nodejs';

const baseUrl = 'https://openapi.tuyaus.com';
const accessKey = (process.env.TUYA_ACCESS_ID || '').trim();
const secretKey = (process.env.TUYA_ACCESS_SECRET || '').trim();
const deviceId = (process.env.TUYA_DEVICE_ID || '').trim();
const controlToken = (process.env.APP_CONTROL_TOKEN || '').trim();
const SESSION_COOKIE='f2e_session';
const SESSION_TTL_SECONDS=30*24*60*60;
let quotaBlockedUntil=0;
let quotaMessage='IoT Core trial quota is exhausted. [28841004]';
const TUYA_QUOTA_BACKOFF_MS=10*60*1000;
function quotaErrorMessage(value){return /28841004|quota is exhausted|trial quota/i.test(String(value||''))}

function safeEqualText(a,b){
  const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));
  return x.length===y.length&&x.length>0&&timingSafeEqual(x,y);
}
function parseCookies(req){
  const raw=String(req.headers?.cookie||'');
  const out={};
  for(const part of raw.split(';')){
    const i=part.indexOf('=');
    if(i<0)continue;
    const key=part.slice(0,i).trim();
    const value=part.slice(i+1).trim();
    if(key)out[key]=value;
  }
  return out;
}
function sessionSignature(exp){
  return createHmac('sha256',controlToken).update('f2e-session:'+String(exp)).digest('base64url');
}
function validSession(req){
  if(!controlToken)return false;
  const raw=parseCookies(req)[SESSION_COOKIE]||'';
  const [expRaw,sig]=String(raw).split('.');
  const exp=Number(expRaw);
  if(!Number.isFinite(exp)||exp<=Date.now()||!sig)return false;
  return safeEqualText(sig,sessionSignature(expRaw));
}
function bearerMatches(req){
  const auth=String(req.headers?.authorization||'');
  return safeEqualText(auth,`Bearer ${controlToken}`);
}

export function applyCors(req, res) {
  const origin = req.headers.origin;
  const publicUrl=(process.env.PUBLIC_APP_URL||'').trim().replace(/\/$/,'');
  const allowed = new Set([
    'https://veltonbo.github.io',
    'https://app-cafe.vercel.app',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    ...(publicUrl?[publicUrl]:[])
  ]);
  if (origin && allowed.has(origin)){
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials','true');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
}

export function authorizeControlToken(req,res){
  if(!controlToken){
    res.status(500).json({ok:false,error:'APP_CONTROL_TOKEN não configurado no servidor.'});
    return false;
  }
  if(!bearerMatches(req)){
    res.status(401).json({ok:false,error:'Token de pareamento inválido.'});
    return false;
  }
  return true;
}

export function issueControlSession(res){
  const exp=Date.now()+SESSION_TTL_SECONDS*1000;
  const value=String(exp)+'.'+sessionSignature(String(exp));
  res.setHeader('Set-Cookie',
    SESSION_COOKIE+'='+value+
    '; Max-Age='+SESSION_TTL_SECONDS+
    '; Path=/; HttpOnly; Secure; SameSite=Strict'
  );
  return{expires_at:exp};
}

export function clearControlSession(res){
  res.setHeader('Set-Cookie',SESSION_COOKIE+'=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict');
}

export function authorize(req, res) {
  if (!controlToken) {
    res.status(500).json({ ok: false, error: 'APP_CONTROL_TOKEN não configurado no servidor.' });
    return false;
  }
  if (!bearerMatches(req) && !validSession(req)) {
    res.status(401).json({ ok: false, error: 'Não autorizado.' });
    return false;
  }
  return true;
}

export function ensureCloudConfig(res) {
  if (!accessKey || !secretKey) {
    res.status(500).json({ ok: false, error: 'TUYA_ACCESS_ID/TUYA_ACCESS_SECRET não configurados no servidor.' });
    return false;
  }
  return true;
}

export function ensureConfig(res) {
  if (!ensureCloudConfig(res)) return false;
  if (!deviceId) {
    res.status(500).json({ ok: false, error: 'TUYA_DEVICE_ID do EKAZA não configurado no servidor.' });
    return false;
  }
  return true;
}

function context() {
  return new TuyaContext({
    baseUrl,
    accessKey,
    secretKey,
  });
}

export async function tuyaRequest(method, path, body = {}) {
  if(Date.now()<quotaBlockedUntil){
    throw new Error(quotaMessage);
  }

  const ctx = context();
  const response = await ctx.request({ method, path, body });
  const data = response?.data ?? response;

  if (!data || data.success === false) {
    const code = data?.code ? ` [${data.code}]` : '';
    const msg = data?.msg || data?.message || 'Falha na Tuya';
    const full=msg+code;
    if(quotaErrorMessage(full)){
      quotaMessage=full;
      quotaBlockedUntil=Date.now()+TUYA_QUOTA_BACKOFF_MS;
    }
    throw new Error(full);
  }

  quotaBlockedUntil=0;
  return data.result;
}

export function tuyaQuotaState(){
  return{
    blocked:Date.now()<quotaBlockedUntil,
    until:quotaBlockedUntil||null,
    message:Date.now()<quotaBlockedUntil?quotaMessage:null
  };
}

export function getDeviceId() {
  return deviceId;
}
