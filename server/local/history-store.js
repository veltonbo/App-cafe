import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR=process.env.FAZENDA2E_DATA_DIR||'/data';
const HISTORY_FILE=path.join(DATA_DIR,'irrigation-history.ndjson');
const MAX_ROWS=Math.max(1000,Number(process.env.LOCAL_HISTORY_MAX_ROWS||100000));

let readyPromise=null;
let writeChain=Promise.resolve();
let rows=[];

function tsOf(row={}){
  const direct=Number(row.ts||0);
  if(Number.isFinite(direct)&&direct>0)return direct;
  const parsed=Date.parse(row.at||'');
  return Number.isFinite(parsed)?parsed:Date.now();
}

async function ensureReady(){
  if(readyPromise)return readyPromise;
  readyPromise=(async()=>{
    await fsp.mkdir(DATA_DIR,{recursive:true});
    try{
      const text=await fsp.readFile(HISTORY_FILE,'utf8');
      rows=text.split('\n').filter(Boolean).map(line=>{
        try{return JSON.parse(line)}catch{return null}
      }).filter(Boolean).slice(-MAX_ROWS);
    }catch(error){
      if(error?.code!=='ENOENT')console.warn('[LocalHistory] read:',error?.message||error);
    }
  })();
  return readyPromise;
}

export async function appendLocalHistory(row={}){
  await ensureReady();
  const payload={...row,ts:tsOf(row),at:row.at||new Date().toISOString()};
  rows.push(payload);
  if(rows.length>MAX_ROWS)rows=rows.slice(-MAX_ROWS);
  writeChain=writeChain.then(()=>fsp.appendFile(HISTORY_FILE,JSON.stringify(payload)+'\n','utf8'));
  await writeChain;
  return payload;
}

export async function readLocalHistory({sinceMs=0,limit=60000}={}){
  await ensureReady();
  const since=Math.max(0,Number(sinceMs)||0);
  const safeLimit=Math.max(1,Math.min(MAX_ROWS,Number(limit)||60000));
  return rows.filter(row=>tsOf(row)>=since).slice(-safeLimit).sort((a,b)=>tsOf(b)-tsOf(a));
}

export async function localHistoryStatus(){
  await ensureReady();
  let bytes=0;
  try{bytes=(await fsp.stat(HISTORY_FILE)).size}catch{}
  let firstTs=null;
  let lastTs=null;
  for(const row of rows){
    const ts=tsOf(row);
    if(!Number.isFinite(ts)||ts<=0)continue;
    if(firstTs===null||ts<firstTs)firstTs=ts;
    if(lastTs===null||ts>lastTs)lastTs=ts;
  }
  return{ok:true,file:HISTORY_FILE,rows:rows.length,bytes,first_ts:firstTs,last_ts:lastTs};
}

export async function localHistoryCanServe({sinceMs=0,limit=60000,maxLagMs=120000}={}){
  const status=await localHistoryStatus();
  if(!status.rows||!status.last_ts)return false;
  const now=Date.now();
  if(now-Number(status.last_ts)>Math.max(30000,Number(maxLagMs)||120000))return false;
  const safeLimit=Math.max(1,Math.min(MAX_ROWS,Number(limit)||60000));
  if(Number(sinceMs||0)<=0)return status.rows>=safeLimit;
  const toleranceMs=10*60*1000;
  return Number(status.first_ts||Infinity)<=Number(sinceMs)+toleranceMs;
}

export function localHistoryPath(){return HISTORY_FILE;}
