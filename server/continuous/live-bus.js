let sequence=0;
const listeners=new Set();
const lastByType=new Map();

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
  lastByType.set(event.type,event);
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
