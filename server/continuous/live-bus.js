let sequence=0;
const listeners=new Set();
const lastByType=new Map();
const MAX_REPLAY_TYPES=16;
const MAX_REPLAY_PAYLOAD_BYTES=128*1024;

function safePayload(value){
  if(value==null)return null;
  try{return JSON.parse(JSON.stringify(value))}catch{return null}
}

export function publishLive(type,payload={}){
  const event={
    id:++sequence,
    type:String(type||'message'),
    at:Date.now(),
    payload:safePayload(payload)
  };
  let replayEvent=event;
  try{if(Buffer.byteLength(JSON.stringify(event.payload))>MAX_REPLAY_PAYLOAD_BYTES)replayEvent={...event,payload:{truncated:true,reason:'payload_too_large'}}}catch{replayEvent={...event,payload:null}}
  lastByType.set(event.type,replayEvent);
  while(lastByType.size>MAX_REPLAY_TYPES)lastByType.delete(lastByType.keys().next().value);
  for(const listener of [...listeners]){
    try{listener(event)}catch{}
  }
  return event;
}

export function subscribeLive(listener,{replay=true}={}){
  if(typeof listener!=='function')throw new Error('Listener inválido.');
  listeners.add(listener);
  if(replay){
    const rows=[...lastByType.values()].sort((a,b)=>Number(a.id)-Number(b.id));
    for(const event of rows){
      try{listener(event)}catch{}
    }
  }
  return()=>listeners.delete(listener);
}

export function liveClientCount(){
  return listeners.size;
}
