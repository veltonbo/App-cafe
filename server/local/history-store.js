import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR=process.env.FAZENDA2E_DATA_DIR||'/data';
const HISTORY_FILE=path.join(DATA_DIR,'irrigation-history.ndjson');
const SYNC_META_FILE=path.join(DATA_DIR,'local-history-meta.json');
const MAX_ROWS=Math.max(1000,Number(process.env.LOCAL_HISTORY_MAX_ROWS||2500));

let readyPromise=null;
let writeChain=Promise.resolve();
let rows=[];
let syncMeta={last_success_at:0,last_remote_rows:0,last_added:0};

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
      const stat=await fsp.stat(HISTORY_FILE);
      const maxBytes=Math.max(2*1024*1024,Number(process.env.LOCAL_HISTORY_LOAD_BYTES||3*1024*1024));
      const start=Math.max(0,stat.size-maxBytes);
      const fh=await fsp.open(HISTORY_FILE,'r');
      try{
        const size=stat.size-start,buffer=Buffer.alloc(size);
        await fh.read(buffer,0,size,start);
        let text=buffer.toString('utf8');
        if(start>0){const nl=text.indexOf('\n');text=nl>=0?text.slice(nl+1):'';}
        rows=text.split('\n').filter(Boolean).map(line=>{
          try{return JSON.parse(line)}catch{return null}
        }).filter(Boolean).slice(-MAX_ROWS);
      }finally{await fh.close();}
    }catch(error){
      if(error?.code!=='ENOENT')console.warn('[LocalHistory] read:',error?.message||error);
    }
    try{
      const meta=JSON.parse(await fsp.readFile(SYNC_META_FILE,'utf8'));
      if(meta&&typeof meta==='object')syncMeta={...syncMeta,...meta};
    }catch(error){
      if(error?.code!=='ENOENT')console.warn('[LocalHistory] meta read:',error?.message||error);
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

export async function markLocalHistorySynced({remote=0,added=0}={}){
  await ensureReady();
  syncMeta={
    last_success_at:Date.now(),
    last_remote_rows:Math.max(0,Number(remote)||0),
    last_added:Math.max(0,Number(added)||0)
  };
  const tmp=SYNC_META_FILE+'.tmp';
  await fsp.writeFile(tmp,JSON.stringify(syncMeta,null,2),'utf8');
  await fsp.rename(tmp,SYNC_META_FILE);
  return{...syncMeta};
}

export async function readLocalHistory({sinceMs=0,limit=60000}={}){
  await ensureReady();
  const since=Math.max(0,Number(sinceMs)||0);
  const safeLimit=Math.max(1,Math.min(MAX_ROWS,Number(limit)||60000));
  return rows.filter(row=>tsOf(row)>=since).slice(-safeLimit).sort((a,b)=>tsOf(b)-tsOf(a));
}

export async function readLocalHistoryFileRange({sinceMs=0,limit=10000}={}){
  await ensureReady();
  const since=Math.max(0,Number(sinceMs)||0);
  const safeLimit=Math.max(1,Math.min(20000,Number(limit)||10000));
  const out=[];
  try{
    const stream=fs.createReadStream(HISTORY_FILE,{encoding:'utf8'});
    let pending='';
    for await(const chunk of stream){
      pending+=chunk;
      const lines=pending.split('\n');pending=lines.pop()||'';
      for(const line of lines){if(!line)continue;try{const row=JSON.parse(line);if(tsOf(row)>=since)out.push(row)}catch{}}
    }
    if(pending){try{const row=JSON.parse(pending);if(tsOf(row)>=since)out.push(row)}catch{}}
    return out.slice(-safeLimit).sort((a,b)=>tsOf(b)-tsOf(a));
  }catch(error){if(error?.code==='ENOENT')return[];throw error}
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
  return{
    ok:true,
    file:HISTORY_FILE,
    rows:rows.length,
    bytes,
    first_ts:firstTs,
    last_ts:lastTs,
    sync:{...syncMeta}
  };
}

export async function localHistoryCanServe({sinceMs=0,limit=60000,maxLagMs=120000}={}){
  const status=await localHistoryStatus();
  if(!status.rows)return false;
  const now=Date.now();
  const lastSync=Number(status.sync?.last_success_at||0);
  if(!lastSync||now-lastSync>Math.max(30000,Number(maxLagMs)||120000))return false;
  const safeLimit=Math.max(1,Math.min(MAX_ROWS,Number(limit)||60000));
  if(Number(sinceMs||0)<=0)return status.rows>=safeLimit;
  const toleranceMs=10*60*1000;
  return Number(status.first_ts||Infinity)<=Number(sinceMs)+toleranceMs;
}

export function localHistoryPath(){return HISTORY_FILE;}
