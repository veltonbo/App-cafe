import fsp from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';

const DATA_DIR=process.env.FAZENDA2E_DATA_DIR||'/data';
const BACKUP_DIR=path.join(DATA_DIR,'backups');
const INTERVAL_MS=Math.max(15*60*1000,Number(process.env.LOCAL_BACKUP_INTERVAL_MS||6*60*60*1000));
const RETAIN=Math.max(3,Number(process.env.LOCAL_BACKUP_RETAIN||14));
const FILES=['irrigation-history.ndjson','viveiro-seconds.json'];
const MEMORY_SAMPLE_MS=Math.max(15000,Number(process.env.MEMORY_SAMPLE_MS||30000));
const MEMORY_SAMPLE_LIMIT=Math.max(20,Math.min(240,Number(process.env.MEMORY_SAMPLE_LIMIT||120)));

let timer=null;
let memoryTimer=null;
let running=false;
let lastBackup=null;
let lastError=null;
const memorySamples=[];

function stamp(){
  return new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
}

function readMemorySample(){
  const mem=process.memoryUsage();
  return{
    at:Date.now(),
    rss_mb:Math.round(mem.rss/1024/1024),
    heap_used_mb:Math.round(mem.heapUsed/1024/1024),
    heap_total_mb:Math.round(mem.heapTotal/1024/1024),
    external_mb:Math.round(mem.external/1024/1024),
    array_buffers_mb:Math.round(mem.arrayBuffers/1024/1024)
  };
}

function pushMemorySample(){
  memorySamples.push(readMemorySample());
  while(memorySamples.length>MEMORY_SAMPLE_LIMIT)memorySamples.shift();
}

function memoryTrend(){
  if(memorySamples.length<2)return{samples:memorySamples.length,window_minutes:0,rss_change_mb:0,rss_per_minute:0};
  const first=memorySamples[0];
  const last=memorySamples[memorySamples.length-1];
  const elapsedMinutes=Math.max((last.at-first.at)/60000,1/60);
  const change=last.rss_mb-first.rss_mb;
  return{
    samples:memorySamples.length,
    window_minutes:Number(elapsedMinutes.toFixed(1)),
    rss_change_mb:change,
    rss_per_minute:Number((change/elapsedMinutes).toFixed(1)),
    min_rss_mb:Math.min(...memorySamples.map(x=>x.rss_mb)),
    max_rss_mb:Math.max(...memorySamples.map(x=>x.rss_mb)),
    first_at:first.at,
    last_at:last.at
  };
}

async function gzipFile(source,dest){
  await pipeline(fs.createReadStream(source),zlib.createGzip({level:6}),fs.createWriteStream(dest));
}

async function prune(){
  const names=(await fsp.readdir(BACKUP_DIR).catch(()=>[]))
    .filter(name=>name.endsWith('.gz'))
    .sort()
    .reverse();
  const keepPerFile=RETAIN;
  for(const base of FILES){
    const prefix=base+'.';
    const matches=names.filter(name=>name.startsWith(prefix));
    for(const name of matches.slice(keepPerFile)){
      await fsp.unlink(path.join(BACKUP_DIR,name)).catch(()=>null);
    }
  }
}

export async function createLocalBackup(reason='automatic'){
  if(running)return{ok:true,skipped:true,reason:'already_running',lastBackup};
  running=true;
  try{
    await fsp.mkdir(BACKUP_DIR,{recursive:true});
    const created=[];
    const s=stamp();
    for(const base of FILES){
      const source=path.join(DATA_DIR,base);
      try{
        const stat=await fsp.stat(source);
        if(!stat.isFile())continue;
        const dest=path.join(BACKUP_DIR,`${base}.${s}.gz`);
        await gzipFile(source,dest);
        const out=await fsp.stat(dest);
        created.push({file:path.basename(dest),bytes:out.size,source_bytes:stat.size});
      }catch(error){
        if(error?.code!=='ENOENT')throw error;
      }
    }
    await prune();
    lastBackup={ok:true,reason,at:Date.now(),files:created};
    lastError=null;
    console.log('[LocalBackup] concluído',lastBackup);
    return lastBackup;
  }catch(error){
    lastError={at:Date.now(),message:error?.message||String(error)};
    console.warn('[LocalBackup] falhou:',lastError.message);
    return{ok:false,error:lastError.message};
  }finally{
    running=false;
  }
}

export function startLocalMaintenance(){
  if(timer)return;
  pushMemorySample();
  memoryTimer=setInterval(pushMemorySample,MEMORY_SAMPLE_MS);
  memoryTimer.unref?.();
  setTimeout(()=>createLocalBackup('startup').catch(()=>null),45000).unref?.();
  timer=setInterval(()=>createLocalBackup('automatic').catch(()=>null),INTERVAL_MS);
  timer.unref?.();
}

export function stopLocalMaintenance(){
  if(timer)clearInterval(timer);
  if(memoryTimer)clearInterval(memoryTimer);
  timer=null;
  memoryTimer=null;
}

export async function localMaintenanceStatus(){
  await fsp.mkdir(BACKUP_DIR,{recursive:true}).catch(()=>null);
  const backupFiles=await fsp.readdir(BACKUP_DIR).catch(()=>[]);
  const memory=readMemorySample();
  return{
    ok:true,
    uptime_seconds:Math.round(process.uptime()),
    memory,
    memory_trend:memoryTrend(),
    backups:{
      count:backupFiles.filter(name=>name.endsWith('.gz')).length,
      retain_per_file:RETAIN,
      interval_minutes:Math.round(INTERVAL_MS/60000),
      last:lastBackup,
      last_error:lastError
    }
  };
}
