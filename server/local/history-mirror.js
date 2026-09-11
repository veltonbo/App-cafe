import { readRecentHistory } from '../api/irrigation/_store.js';
import { appendLocalHistory, readLocalHistory, localHistoryStatus, markLocalHistorySynced } from './history-store.js';

const DAY=86400000;
const INITIAL_WINDOW_MS=Math.max(DAY,Number(process.env.LOCAL_HISTORY_BACKFILL_DAYS||32)*DAY);
const POLL_MS=Math.max(10000,Number(process.env.LOCAL_HISTORY_MIRROR_MS||30000));
let busy=false;
let timer=null;
let known=null;

function eventKey(row={}){
  const id=String(row.event_id||row.id||'').trim();
  if(id)return id;
  return [Number(row.ts||0),String(row.type||''),String(row.source||''),String(row.at||'')].join('|');
}

async function ensureKnown(){
  if(known)return known;
  const current=await readLocalHistory({sinceMs:0,limit:100000}).catch(()=>[]);
  known=new Set(current.map(eventKey).filter(Boolean));
  return known;
}

async function mirrorWindow(sinceMs){
  if(busy)return{ok:true,skipped:true};
  busy=true;
  try{
    const seen=await ensureKnown();
    const remote=await readRecentHistory({sinceMs,limit:60000});
    let added=0;
    const ordered=[...remote].sort((a,b)=>Number(a.ts||Date.parse(a.at||'')||0)-Number(b.ts||Date.parse(b.at||'')||0));
    for(const row of ordered){
      const key=eventKey(row);
      if(!key||seen.has(key))continue;
      await appendLocalHistory(row);
      seen.add(key);
      added++;
    }
    const sync=await markLocalHistorySynced({remote:remote.length,added});
    const status=await localHistoryStatus();
    return{ok:true,remote:remote.length,added,sync,...status};
  }finally{
    busy=false;
  }
}

export function startLocalHistoryMirror(){
  if(timer)return;
  setTimeout(()=>{
    mirrorWindow(Date.now()-INITIAL_WINDOW_MS)
      .then(result=>console.log('[LocalHistory] backfill/mirror pronto',result))
      .catch(error=>console.warn('[LocalHistory] backfill falhou:',error?.message||error));
  },3000).unref?.();

  timer=setInterval(()=>{
    mirrorWindow(Date.now()-10*60*1000)
      .catch(error=>console.warn('[LocalHistory] mirror:',error?.message||error));
  },POLL_MS);
  timer.unref?.();
}

export function stopLocalHistoryMirror(){
  if(timer)clearInterval(timer);
  timer=null;
}
