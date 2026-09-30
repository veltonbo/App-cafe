import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { readViveiroState, sendViveiroCommands } from '../_viveiro_transport.js';
import { decodeCycle, encodeCycle } from '../_cycle.js';

const TZ='America/Porto_Velho';

const DATA_ROOT=process.env.FAZENDA2E_DATA_DIR||'/data';
const ESP_FILE=path.join(DATA_ROOT,'esp32-controller.json');
function readEsp32(){try{return JSON.parse(fs.readFileSync(ESP_FILE,'utf8'))}catch{return null}}
function saveEsp32(x){const t=ESP_FILE+'.tmp';fs.writeFileSync(t,JSON.stringify(x,null,2),{mode:0o600});fs.renameSync(t,ESP_FILE)}
function espFresh(x){return Boolean(x&&Date.now()-Number(x.last_seen||0)<15000)}
function firmwareAtLeast138(x){const m=String(x?.firmware||'').match(/(\d+)\.(\d+)\.(\d+)/);if(!m)return false;const v=m.slice(1).map(Number);return v[0]>1||(v[0]===1&&(v[1]>3||(v[1]===3&&v[2]>=8)))}
async function startEsp32NurseryPulse(durationSeconds,{attempts=30}={}){
  const duration=Math.max(1,Math.min(300,Math.round(Number(durationSeconds)||30))),started=Date.now();
  let x=readEsp32();if(!espFresh(x))throw new Error('ESP32 do viveiro está offline.');if(!firmwareAtLeast138(x))throw new Error('Pulso local do viveiro exige firmware ESP32 1.3.8 ou superior.');
  if(x.pending&&Date.now()-Number(x.pending.created_at||0)<120000)throw new Error('ESP32 ocupado com outro comando físico.');
  const id=randomUUID(),sent=Date.now();x.pending={id,type:'nursery_pulse',relay:1,duration_seconds:duration,role:'nursery_pump',source:'automatic_viveiro',created_at:sent};saveEsp32(x);
  const tries=Math.max(2,Math.min(60,Number(attempts)||30));for(let i=0;i<tries;i++){await sleep(i?350:250);x=readEsp32();if(espFresh(x)&&Array.isArray(x.relays)&&Boolean(x.relays[0])){if(x.pending?.id===id){x.pending=null;saveEsp32(x)}const confirmed=Date.now();return{ok:true,on:true,provider:'esp32',local_deadline:true,duration_seconds:duration,command_started_at:started,command_sent_at:sent,confirmed_at:confirmed,confirmation_latency_ms:confirmed-sent,confirmed_by:'esp32_status',attempts_used:i+1}}}
  x=readEsp32();if(x?.pending?.id===id){x.pending=null;saveEsp32(x)}throw new Error('ESP32 não confirmou o início do pulso local R1.');
}

async function setEsp32NurseryRelay(on,{attempts=30}={}){
  const wanted=Boolean(on), started=Date.now();
  let x=readEsp32();
  if(!espFresh(x))throw new Error('ESP32 do viveiro está offline.');
  if(Array.isArray(x.relays)&&Boolean(x.relays[0])===wanted)return{ok:true,on:wanted,provider:'esp32',command_started_at:started,command_sent_at:started,confirmed_at:Date.now(),confirmation_latency_ms:0,confirmed_by:'esp32_state',attempts_used:0};
  // Não sobrescreve outro comando físico ainda pendente. OFF pode substituir somente R1 ON.
  if(x.pending&&Date.now()-Number(x.pending.created_at||0)<120000){
    const sameR1=String(x.pending.type)==='relay'&&Number(x.pending.relay)===1;
    const sameWanted=sameR1&&Boolean(x.pending.on)===wanted;
    if(!sameWanted&&!(sameR1&&!wanted))throw new Error('ESP32 ocupado com outro comando físico.');
    if(sameWanted){
      for(let i=0;i<30;i++){await sleep(i?350:250);x=readEsp32();if(espFresh(x)&&Array.isArray(x.relays)&&Boolean(x.relays[0])===wanted)return{ok:true,on:wanted,provider:'esp32',command_started_at:started,command_sent_at:Number(x.pending?.created_at||started),confirmed_at:Date.now(),confirmation_latency_ms:Date.now()-started,confirmed_by:'esp32_status',attempts_used:i+1};}
    }
  }
  const id=randomUUID(), sent=Date.now();
  x.pending={id,type:'relay',relay:1,on:wanted,role:'nursery_pump',source:'automatic_viveiro',created_at:sent};saveEsp32(x);
  const tries=Math.max(2,Math.min(60,Number(attempts)||30));
  for(let i=0;i<tries;i++){
    await sleep(i?350:250);x=readEsp32();
    if(espFresh(x)&&Array.isArray(x.relays)&&Boolean(x.relays[0])===wanted){
      if(x.pending?.id===id){x.pending=null;saveEsp32(x)}
      const confirmed=Date.now();return{ok:true,on:wanted,provider:'esp32',command_started_at:started,command_sent_at:sent,confirmed_at:confirmed,confirmation_latency_ms:confirmed-sent,confirmed_by:'esp32_status',attempts_used:i+1};
    }
  }
  x=readEsp32();
  if(espFresh(x)&&Array.isArray(x.relays)&&Boolean(x.relays[0])===wanted){if(x.pending?.id===id){x.pending=null;saveEsp32(x)}return{ok:true,on:wanted,provider:'esp32',command_started_at:started,command_sent_at:sent,confirmed_at:Date.now(),confirmation_latency_ms:Date.now()-sent,confirmed_by:'esp32_final_state',attempts_used:tries};}
  if(x?.pending?.id===id){x.pending=null;saveEsp32(x)}
  throw new Error('ESP32 não confirmou R1 '+(wanted?'ligado':'desligado')+'.');
}


function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}

function normalizeStatus(result){
  if(Array.isArray(result))return result;
  if(Array.isArray(result?.status))return result.status;
  if(Array.isArray(result?.result))return result.result;
  return[];
}

export function localSchedule(state,nowDate=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
    timeZone:TZ,
    weekday:'short',
    hour:'2-digit',
    minute:'2-digit',
    second:'2-digit',
    hourCycle:'h23'
  }).formatToParts(nowDate).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));

  const dayMap={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  const day=dayMap[parts.weekday]??0;
  const nowSec=Number(parts.hour)*3600+Number(parts.minute)*60+Number(parts.second);
  const startSec=Number(state.start_minutes||0)*60;
  const endSec=Number(state.end_minutes||0)*60;
  const mask=Number(state.days_mask||0);
  const todayAllowed=Boolean(mask&(1<<day));

  return{
    inside:todayAllowed&&nowSec>=startSec&&nowSec<endSec,
    today_allowed:todayAllowed,
    before_start:todayAllowed&&nowSec<startSec,
    after_end:todayAllowed&&nowSec>=endSec,
    day,
    now_seconds:nowSec,
    start_seconds:startSec,
    end_seconds:endSec,
    seconds_until_start:todayAllowed&&nowSec<startSec?Math.max(0,startSec-nowSec):0,
    seconds_until_end:todayAllowed&&nowSec<endSec?Math.max(0,endSec-nowSec):0
  };
}

export function secondsUntilNextWindow(state,nowDate=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
    timeZone:TZ,
    weekday:'short',
    hour:'2-digit',
    minute:'2-digit',
    second:'2-digit',
    hourCycle:'h23'
  }).formatToParts(nowDate).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));

  const dayMap={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  const day=dayMap[parts.weekday]??0;
  const nowSec=Number(parts.hour)*3600+Number(parts.minute)*60+Number(parts.second);
  const startSec=Math.max(0,Number(state.start_minutes||0)*60);
  const mask=Number(state.days_mask||0);

  for(let add=0;add<8;add++){
    const targetDay=(day+add)%7;
    if(!(mask&(1<<targetDay)))continue;
    if(add===0){
      if(nowSec<startSec)return Math.max(1,startSec-nowSec);
      continue;
    }
    return Math.max(1,(86400-nowSec)+((add-1)*86400)+startSec);
  }
  return 86400;
}

export async function readViveiroDevice(options={}){
  const state=await readViveiroState(options);
  const sm=state?.statusMap||{};
  const cycleRaw=typeof sm.cycle_time==='string'?sm.cycle_time:'';

  // EKAZA permanece como camada de segurança/programação, mas a saída física
  // do viveiro agora é R1 do ESP32. Nunca use switch_1 do EKAZA como confirmação de R1.
  const esp=readEsp32();
  const espOnline=espFresh(esp);
  const espRelay=espOnline&&Array.isArray(esp?.relays)?Boolean(esp.relays[0]):null;
  return{
    deviceId:'fazenda2e-esp32-01',
    provider:'esp32',
    safetyDeviceId:state?.deviceId||null,
    safetyProvider:state?.provider||null,
    cycleRaw,
    cycleConfig:decodeCycle(cycleRaw),
    relay:espRelay,
    online:espOnline,
    safetyOnline:state?.online!==false
  };
}

let outputTail=Promise.resolve();
let outputAuthority={command_id:null,desired:false,source:'startup',reason:'startup',requested_at:0,completed_at:0,confirmed:null,error:null};
export function getViveiroOutputAuthority(){return{...outputAuthority}}
export async function setViveiroRelay(on,{attempts=on?4:8,source='viveiro_engine',reason='relay_command',durationSeconds=null}={}){
  const request={command_id:randomUUID(),desired:Boolean(on),source:String(source||'unknown').slice(0,120),reason:String(reason||'unspecified').slice(0,120),requested_at:Date.now()};
  const run=async()=>{outputAuthority={...request,completed_at:0,confirmed:null,error:null};try{const current=readEsp32();const useLocal=request.desired&&Number(durationSeconds)>0&&firmwareAtLeast138(current);const result=useLocal?await startEsp32NurseryPulse(durationSeconds,{attempts}):await setEsp32NurseryRelay(request.desired,{attempts});outputAuthority={...request,completed_at:Date.now(),confirmed:true,error:null};return result}catch(error){outputAuthority={...request,completed_at:Date.now(),confirmed:false,error:error?.message||String(error)};throw error}};
  const pending=outputTail.then(run,run);outputTail=pending.catch(()=>undefined);return pending;
}

export async function writeViveiroCycle(raw){
  const result=await sendViveiroCommands([
    {code:'cycle_time',value:raw}
  ]);

  if(String(result?.statusMap?.cycle_time||'')===String(raw||'')){
    return true;
  }

  for(let i=0;i<6;i++){
    await sleep(i===0?500:750);
    const current=await readViveiroDevice().catch(()=>null);
    if(String(current?.cycleRaw||'')===String(raw||''))return true;
  }
  throw new Error('O EKAZA não confirmou a alteração do cycle_time.');
}

function disabledCycle(currentRaw,cfg){
  return encodeCycle({
    enabled:false,
    daysMask:cfg.daysMask,
    startMinutes:cfg.startMinutes,
    endMinutes:cfg.endMinutes,
    onMinutes:cfg.onMinutes,
    offMinutes:cfg.offMinutes
  },currentRaw).raw;
}

export async function pulseStillActive(state={},options={}){
  if(!state?.enabled)return false;
  // A posse operacional agora é do ESP32/R1. O EKAZA continua como intertravamento
  // de segurança, mas uma falha de leitura da nuvem não pode desarmar o ciclo do ESP32.
  const esp=readEsp32();
  return espFresh(esp);
}

export async function prepareServerPulse({onSeconds=30,offSeconds=120,resumeDelayMinutes=30,startMinutes=null,endMinutes=null,daysMask=null}={}){
  const current=await readViveiroDevice({force:true,maxAgeMs:0});
  const cycle=current.cycleConfig;
  if(!cycle)throw new Error('Atualize a programação do EKAZA antes de ativar o modo em segundos.');

  const on=Math.max(1,Math.min(300,Math.round(Number(onSeconds)||30)));
  const off=Math.max(1,Math.min(900,Math.round(Number(offSeconds)||120)));
  if(on+off>1200)throw new Error('Ligado + desligado deve totalizar no máximo 1200 segundos.');

  const nativeCycleRaw=current.cycleRaw;
  const disabledRaw=disabledCycle(current.cycleRaw,cycle);

  const start=Number.isFinite(Number(startMinutes))?Math.round(Number(startMinutes)):Number(cycle.startMinutes);
  const end=Number.isFinite(Number(endMinutes))?Math.round(Number(endMinutes)):Number(cycle.endMinutes);
  const mask=Number.isFinite(Number(daysMask))?Math.round(Number(daysMask)):Number(cycle.daysMask);
  if(start<0||start>1439||end<1||end>1440||end<=start)throw new Error('Confira o horário inicial e final do ciclo rápido.');
  if(mask<1||mask>127)throw new Error('Selecione pelo menos um dia para o ciclo rápido.');

  if(cycle.enabled){
    await writeViveiroCycle(disabledRaw);
  }else if(String(current.cycleRaw||'')!==String(disabledRaw||'')){
    await writeViveiroCycle(disabledRaw);
  }

  await setViveiroRelay(false).catch(()=>null);

  return{
    enabled:true,
    engine:'railway_continuous',
    generation:randomUUID(),
    on_seconds:on,
    off_seconds:off,
    resume_delay_minutes:Math.max(0,Math.min(1440,Math.round(Number(resumeDelayMinutes)||0))),
    start_minutes:start,
    end_minutes:end,
    days_mask:mask,
    native_cycle_raw:nativeCycleRaw,
    native_cycle_was_enabled:Boolean(cycle.enabled),
    disabled_cycle_raw:disabledRaw,
    relay_expected:false,
    phase:'queued',
    rain_last_at:0,
    paused_by_weather:false,
    pulse_count:0,
    configured_at:Date.now()
  };
}

export async function rollbackPreparedPulse(state={},detail=''){
  await setViveiroRelay(false).catch(()=>null);
  const current=await readViveiroDevice().catch(()=>null);
  const ownsCycle=current&&state?.disabled_cycle_raw&&String(current.cycleRaw||'')===String(state.disabled_cycle_raw);
  if(ownsCycle&&state?.native_cycle_raw){
    await writeViveiroCycle(state.native_cycle_raw).catch(()=>null);
  }
  return{
    ...state,
    enabled:false,
    relay_expected:false,
    phase:'rollback',
    last_error:detail||'Falha ao iniciar o controlador em segundos.',
    rollback_at:Date.now()
  };
}

export async function stopServerPulse({restoreNative=false,nativeCycleRaw='',disabledCycleRaw=''}={}){
  await setViveiroRelay(false).catch(()=>null);

  const current=await readViveiroDevice({force:true,maxAgeMs:0}).catch(()=>null);
  const canRestore=!disabledCycleRaw||(
    current&&String(current.cycleRaw||'')===String(disabledCycleRaw||'')
  );

  if(restoreNative&&nativeCycleRaw&&canRestore){
    await writeViveiroCycle(nativeCycleRaw);
  }

  return{
    enabled:false,
    engine:'railway_continuous',
    generation:randomUUID(),
    relay_expected:false,
    phase:'stopped',
    disabled_at:Date.now()
  };
}

export async function probeServerPulse(state={}){
  if(!state?.enabled||!state?.disabled_cycle_raw){
    return{...state,enabled:false,phase:'stopped',relay_expected:false};
  }

  const current=await readViveiroDevice({force:true,maxAgeMs:0});
  const active=String(current.cycleRaw||'')===String(state.disabled_cycle_raw||'');
  if(!active){
    return{
      ...state,
      enabled:false,
      relay_expected:false,
      phase:'stopped',
      stopped_at:Date.now()
    };
  }

  const schedule=localSchedule(state);
  return{
    ...state,
    enabled:true,
    relay_expected:current.relay===true,
    phase:schedule.inside?'running':(schedule.before_start?'waiting_window':'finishing'),
    device_relay:current.relay,
    checked_at:Date.now()
  };
}

// Compatibilidade com telas antigas. O servidor contínuo mantém o estado
// persistido no Firebase e valida a posse do cycle_time diretamente no EKAZA.
export async function getSecondsState(){
  return null;
}
