import { createSign } from 'node:crypto';

const DB_URL = (process.env.FIREBASE_DATABASE_URL || 'https://manej-cafe-default-rtdb.firebaseio.com').replace(/\/$/,'');

let cachedAccessToken='';
let cachedAccessTokenUntil=0;

function cleanPath(path) {
  return String(path || '').replace(/^\/+|\/+$/g,'').replace(/[.#$\[\]]/g,'_');
}

function base64Url(value) {
  const buffer=Buffer.isBuffer(value)?value:Buffer.from(String(value));
  return buffer.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

function firebaseCredentials() {
  const raw=(process.env.FIREBASE_CREDENTIALS_JSON||process.env.FIREBASE_SERVICE_ACCOUNT_JSON||'').trim();
  if(raw){
    try{
      const parsed=JSON.parse(raw);
      const clientEmail=String(parsed.client_email||'').trim();
      const privateKey=String(parsed.private_key||'').replace(/\\n/g,'\n').trim();
      if(clientEmail&&privateKey)return{clientEmail,privateKey};
    }catch{
      // Cai para as variáveis separadas abaixo.
    }
  }

  const clientEmail=String(
    process.env.FIREBASE_CLIENT_EMAIL||
    process.env.GOOGLE_CLIENT_EMAIL||
    ''
  ).trim();
  const privateKey=String(
    process.env.FIREBASE_PRIVATE_KEY||
    process.env.GOOGLE_PRIVATE_KEY||
    ''
  ).replace(/\\n/g,'\n').trim();

  return clientEmail&&privateKey?{clientEmail,privateKey}:null;
}

async function firebaseAccessToken() {
  const credentials=firebaseCredentials();
  if(!credentials)return'';

  const nowMs=Date.now();
  if(cachedAccessToken&&nowMs<cachedAccessTokenUntil-60000)return cachedAccessToken;

  const now=Math.floor(nowMs/1000);
  const header=base64Url(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const payload=base64Url(JSON.stringify({
    iss:credentials.clientEmail,
    scope:'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
    aud:'https://oauth2.googleapis.com/token',
    iat:now,
    exp:now+3600
  }));
  const unsigned=header+'.'+payload;
  const signer=createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const assertion=unsigned+'.'+base64Url(signer.sign(credentials.privateKey));

  const r=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({
      grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });
  const body=await r.json().catch(()=>({}));
  if(!r.ok||!body?.access_token){
    throw new Error(
      'Falha ao autenticar o servidor no Firebase. '+
      (body?.error_description||body?.error||('HTTP '+r.status))
    );
  }

  cachedAccessToken=String(body.access_token);
  cachedAccessTokenUntil=nowMs+Math.max(300,Number(body.expires_in||3600))*1000;
  return cachedAccessToken;
}

async function request(path, options = {}) {
  const url = DB_URL + '/' + cleanPath(path) + '.json';
  const token=await firebaseAccessToken();
  const r = await fetch(url, {
    ...options,
    headers: {
      'Content-Type':'application/json',
      ...(token?{'Authorization':'Bearer '+token}:{}),
      ...(options.headers || {})
    }
  });
  const text = await r.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }

  if (!r.ok) {
    const detail=String(body?.error||('Firebase HTTP '+r.status));
    if(/permission denied/i.test(detail)&&!firebaseCredentials()){
      throw new Error(
        'Firebase recusou a gravação do servidor. Configure a conta de serviço do Firebase na Vercel.'
      );
    }
    throw new Error(detail);
  }
  return body;
}

export async function storeGet(path) {
  return request(path);
}

export async function storeSet(path, value) {
  return request(path, { method:'PUT', body:JSON.stringify(value) });
}

export async function storePatch(path, value) {
  return request(path, { method:'PATCH', body:JSON.stringify(value) });
}

export async function storePush(path, value) {
  return request(path, { method:'POST', body:JSON.stringify(value) });
}

export async function appendHistory(entry) {
  const payload = {
    ...entry,
    at: entry?.at || new Date().toISOString(),
    ts: entry?.ts || Date.now()
  };
  try {
    return await storePush('IrrigacaoFazenda2E/history', payload);
  } catch (error) {
    return { error:error.message || String(error) };
  }
}

export async function getAutomationConfig() {
  return (await storeGet('IrrigacaoFazenda2E/config')) || {};
}

export async function patchAutomationConfig(value) {
  return storePatch('IrrigacaoFazenda2E/config', value || {});
}
