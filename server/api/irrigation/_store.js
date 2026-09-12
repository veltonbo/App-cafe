import { createSign, randomUUID } from 'node:crypto';

const DB_URL = (process.env.FIREBASE_DATABASE_URL || 'https://manej-cafe-default-rtdb.firebaseio.com').replace(/\/$/,'');
const HISTORY_PATH='IrrigacaoFazenda2E/history';
const HISTORY_TIME_PATH='IrrigacaoFazenda2E/historyByTime';
const HISTORY_INDEX_META_PATH='IrrigacaoFazenda2E/historyByTimeMeta';
const HISTORY_BACKFILL_PAGE_SIZE=250;
const HISTORY_CACHE_FRESH_MS=10000;
const HISTORY_CACHE_STALE_MS=5*60*1000;
const HISTORY_CACHE_BUCKET_MS=60*1000;

let cachedAccessToken='';
let cachedAccessTokenUntil=0;
let historyBackfillPromise=null;
const recentHistoryCache=new Map();
const HISTORY_CACHE_MAX_ENTRIES=12;
function cacheRecentHistory(key,value){
  recentHistoryCache.delete(key);
  recentHistoryCache.set(key,value);
  while(recentHistoryCache.size>HISTORY_CACHE_MAX_ENTRIES){
    recentHistoryCache.delete(recentHistoryCache.keys().next().value);
  }
}

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

async function request(path, options = {}, query = null) {
  let url = DB_URL + '/' + cleanPath(path) + '.json';
  if(query&&typeof query==='object'){
    const params=new URLSearchParams();
    for(const [key,value] of Object.entries(query)){
      if(value===undefined||value===null)continue;
      params.set(key,JSON.stringify(value));
    }
    const qs=params.toString();
    if(qs)url+='?'+qs;
  }
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
        'Firebase recusou a gravação do servidor. Configure a conta de serviço do Firebase no Railway.'
      );
    }
    throw new Error(detail);
  }
  return body;
}

export async function storeGet(path) {
  return request(path);
}

export async function storeGetQuery(path, {
  orderBy=null,
  startAt=null,
  endAt=null,
  equalTo=null,
  limitToFirst=null,
  limitToLast=null
} = {}) {
  const query={};
  if(orderBy!==null)query.orderBy=String(orderBy);
  if(startAt!==null)query.startAt=startAt;
  if(endAt!==null)query.endAt=endAt;
  if(equalTo!==null)query.equalTo=equalTo;
  if(limitToFirst!==null)query.limitToFirst=Math.max(1,Math.floor(Number(limitToFirst)||1));
  if(limitToLast!==null)query.limitToLast=Math.max(1,Math.floor(Number(limitToLast)||1));
  return request(path,{},query);
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

function historyTimestamp(entry={}){
  const direct=Number(entry?.ts||0);
  if(Number.isFinite(direct)&&direct>0)return Math.round(direct);
  const parsed=Date.parse(entry?.at||'');
  return Number.isFinite(parsed)&&parsed>0?parsed:Date.now();
}

function historyTimeKey(eventId,entry={}){
  const ts=String(historyTimestamp(entry)).padStart(13,'0');
  const safeId=String(eventId||'event').replace(/[^A-Za-z0-9_-]/g,'_').slice(0,180);
  return ts+'-'+safeId;
}

function historyRows(raw){
  if(!raw||typeof raw!=='object')return[];
  return Object.entries(raw).map(([id,value])=>({id,...(value||{})}));
}

async function fetchRecentHistory(start,safeLimit){
  const raw=await storeGetQuery(HISTORY_TIME_PATH,{
    orderBy:'$key',
    startAt:String(start).padStart(13,'0')+'-',
    limitToLast:safeLimit
  });
  return historyRows(raw)
    .filter(row=>historyTimestamp(row)>=start)
    .sort((a,b)=>historyTimestamp(b)-historyTimestamp(a));
}

function refreshRecentHistory(key,start,safeLimit,entry={}){
  if(entry.promise)return entry.promise;
  const promise=fetchRecentHistory(start,safeLimit)
    .then(rows=>{
      const now=Date.now();
      cacheRecentHistory(key,{
        rows,
        freshUntil:now+HISTORY_CACHE_FRESH_MS,
        staleUntil:now+HISTORY_CACHE_STALE_MS,
        promise:null
      });
      return rows;
    })
    .catch(error=>{
      const current=recentHistoryCache.get(key);
      if(current)current.promise=null;
      throw error;
    });
  cacheRecentHistory(key,{...entry,promise});
  return promise;
}

function markRecentHistoryStale(){
  for(const entry of recentHistoryCache.values())entry.freshUntil=0;
}

export async function readRecentHistory({sinceMs=0,limit=60000}={}){
  const requestedStart=Math.max(0,Math.round(Number(sinceMs)||0));
  const safeLimit=Math.max(1,Math.min(60000,Math.round(Number(limit)||60000)));
  const cacheStart=Math.floor(requestedStart/HISTORY_CACHE_BUCKET_MS)*HISTORY_CACHE_BUCKET_MS;
  const key=cacheStart+':'+safeLimit;
  const now=Date.now();
  const cached=recentHistoryCache.get(key);
  const trim=rows=>(rows||[]).filter(row=>historyTimestamp(row)>=requestedStart);

  if(cached?.rows&&now<Number(cached.freshUntil||0))return trim(cached.rows);

  if(cached?.rows&&now<Number(cached.staleUntil||0)){
    refreshRecentHistory(key,cacheStart,safeLimit,cached).catch(()=>null);
    return trim(cached.rows);
  }

  return trim(await refreshRecentHistory(key,cacheStart,safeLimit,cached||{}));
}

export async function historyIndexStatus(){
  return(await storeGet(HISTORY_INDEX_META_PATH).catch(()=>null))||{};
}

export async function backfillHistoryTimeIndex({force=false}={}){
  if(historyBackfillPromise)return historyBackfillPromise;
  historyBackfillPromise=(async()=>{
    const meta=await historyIndexStatus();
    if(!force&&meta?.legacy_backfill_complete)return meta;

    let cursor=null;
    let scanned=0;
    let indexed=0;
    while(true){
      const raw=await storeGetQuery(HISTORY_PATH,{
        orderBy:'$key',
        ...(cursor?{startAt:cursor}:{}),
        limitToFirst:HISTORY_BACKFILL_PAGE_SIZE+(cursor?1:0)
      });
      let rows=historyRows(raw).sort((a,b)=>String(a.id)<String(b.id)?-1:String(a.id)>String(b.id)?1:0);
      if(cursor)rows=rows.filter(row=>String(row.id)!==String(cursor));
      if(!rows.length)break;

      const updates={};
      for(const row of rows){
        const {id,...entry}=row;
        updates[historyTimeKey(id,entry)]={...entry,event_id:entry.event_id||id};
      }
      if(Object.keys(updates).length){
        await storePatch(HISTORY_TIME_PATH,updates);
        indexed+=Object.keys(updates).length;
      }
      scanned+=rows.length;
      cursor=String(rows.at(-1)?.id||'');
      if(rows.length<HISTORY_BACKFILL_PAGE_SIZE||!cursor)break;
    }

    const result={
      legacy_backfill_complete:true,
      completed_at:Date.now(),
      scanned,
      indexed
    };
    await storeSet(HISTORY_INDEX_META_PATH,result);
    return result;
  })();
  try{return await historyBackfillPromise}
  finally{historyBackfillPromise=null}
}

function historyEventId(entry={}){
  const supplied=String(entry?.event_id||'').trim();
  if(supplied)return supplied.replace(/[^A-Za-z0-9_-]/g,'_');
  const type=String(entry?.type||'event').replace(/[^A-Za-z0-9_-]/g,'_').slice(0,48);
  return type+'-'+Date.now()+'-'+randomUUID().slice(0,12);
}

export async function appendHistory(entry) {
  const eventId=historyEventId(entry||{});
  const payload = {
    ...entry,
    event_id:eventId,
    at: entry?.at || new Date().toISOString(),
    ts: entry?.ts || Date.now()
  };
  const timeKey=historyTimeKey(eventId,payload);

  let lastError=null;
  for(let attempt=1;attempt<=3;attempt++){
    try{
      // Mantém o histórico original e um índice temporal independente das regras
      // de .indexOn do Firebase. Ambos usam chaves determinísticas e são idempotentes.
      await storeSet(HISTORY_PATH+'/'+eventId,payload);
      await storeSet(HISTORY_TIME_PATH+'/'+timeKey,payload);
      markRecentHistoryStale();
      return{ok:true,id:eventId,event_id:eventId,entry:payload,attempt};
    }catch(error){
      lastError=error;
      if(attempt<3)await new Promise(resolve=>setTimeout(resolve,attempt===1?150:500));
    }
  }

  const error=new Error('Falha ao gravar histórico após 3 tentativas: '+String(lastError?.message||lastError||'erro desconhecido'));
  error.cause=lastError;
  error.event_id=eventId;
  throw error;
}

export async function getAutomationConfig() {
  return (await storeGet('IrrigacaoFazenda2E/config')) || {};
}

export async function patchAutomationConfig(value) {
  return storePatch('IrrigacaoFazenda2E/config', value || {});
}
