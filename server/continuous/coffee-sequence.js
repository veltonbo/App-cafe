import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fetchWeatherSnapshot } from '../api/weather/_weather.js';

const ROOT=process.env.FAZENDA2E_DATA_DIR||'/data';
const DEVICE=path.join(ROOT,'esp32-controller.json'),SEQ=path.join(ROOT,'coffee-sequence.json'),CFG=path.join(ROOT,'coffee-automation.json'),HIST=path.join(ROOT,'coffee-history.json');
const FIRST_SECTOR_RELAY=3,LAST_SECTOR_RELAY=13,LEGACY_LAST_SECTOR_RELAY=11;
const GUARDIAN_GRACE_MS=15000;
const read=(p,d={})=>{try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return d}};
const write=(p,x)=>{fs.mkdirSync(ROOT,{recursive:true});const t=p+'.tmp';fs.writeFileSync(t,JSON.stringify(x,null,2),{mode:0o600});fs.renameSync(t,p)};
const fresh=s=>Date.now()-Number(s.last_seen||0)<15000;
const defaults=()=>({enabled:false,handover_seconds:5,sector_defaults:Object.fromEntries(Array.from({length:11},(_,i)=>[i+3,20])),programs:[],schedules:[],weather:{enabled:true,pause_on_rain:true,rain_wait_minutes:120,max_rain_probability:70,forecast_guard:false},updated_at:Date.now()});
export function coffeeAutomation(){const x={...defaults(),...read(CFG,{})};x.sector_defaults={...defaults().sector_defaults,...(x.sector_defaults||{})};x.handover_seconds=Math.max(2,Math.min(15,Number(x.handover_seconds)||5));return x}
function scheduleMinutes(v){const [h,m]=String(v||'').split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:-1}
function validateSchedules(programs,schedules){const byId=new Map((programs||[]).map(p=>[p.id,p]));const active=(schedules||[]).filter(x=>x.enabled!==false);for(let i=0;i<active.length;i++){const a=active[i],pa=byId.get(a.program_id),sa=scheduleMinutes(a.time);if(!pa||sa<0)continue;const ea=sa+(pa.sectors||[]).reduce((n,z)=>n+Math.max(1,Number(z.duration_minutes)||20),0);for(let j=i+1;j<active.length;j++){const b=active[j],pb=byId.get(b.program_id),sb=scheduleMinutes(b.time);if(!pb||sb<0)continue;const shared=(a.days||[]).map(Number).some(d=>(b.days||[]).map(Number).includes(d));if(!shared)continue;const eb=sb+(pb.sectors||[]).reduce((n,z)=>n+Math.max(1,Number(z.duration_minutes)||20),0);if(sa<eb&&sb<ea)throw new Error('Conflito de horários entre '+(pa.name||'programa')+' e '+(pb.name||'programa'))}}}
export function saveCoffeeAutomation(input={}){const old=coffeeAutomation(),x={...old,...input,handover_seconds:Math.max(2,Math.min(15,Number(input.handover_seconds??old.handover_seconds)||5)),weather:{...old.weather,...(input.weather||{})},sector_defaults:{...old.sector_defaults,...(input.sector_defaults||{})},programs:Array.isArray(input.programs)?input.programs:old.programs,schedules:Array.isArray(input.schedules)?input.schedules:old.schedules,updated_at:Date.now()};validateSchedules(x.programs,x.schedules);write(CFG,x);return x}
export function coffeeHistory(){return read(HIST,[]).slice(-500).reverse()}
export function coffeeOperational(){
 const q=coffeeSequenceStatus(),c=coffeeAutomation(),now=Date.now(),wait=Number(c.weather?.rain_wait_minutes||120)*60000,lastRain=Number(weather.lastRainAt||q.rain_detected_at||0),resumeAt=lastRain?lastRain+wait:0;
 const blocked=Boolean(weather.raining),waiting=!blocked&&resumeAt>now,climate=!weather.usable||weather.stale?'weather_unavailable':blocked?'rain':waiting?'rain_wait':null;
 return {decision:q.running?(q.paused?'AGUARDANDO':'IRRIGANDO'):(climate?'BLOQUEADO':'VAI IRRIGAR'),reason:q.running?(q.paused?(q.pause_reason==='rain'?'Pausado por chuva':'Pausado'):'Sequência em andamento'):(climate==='rain'?'Chuva detectada':climate==='rain_wait'?'Aguardando segurança após chuva':climate==='weather_unavailable'?'Weather2-2 sem leitura válida':'Condições liberadas'),rain:{raining:weather.raining,last_rain_at:lastRain,last_good_at:weather.lastGoodAt,checked_at:weather.checkedAt,resume_eligible_at:resumeAt,wait_minutes:Number(c.weather?.rain_wait_minutes||120)},interrupted:q.paused?{relay:q.queue?.[q.index]?.relay||null,remaining_ms:Number(q.remaining_ms||0),index:q.index,total:q.queue?.length||0}:null}
}
function event(type,data={}){const h=read(HIST,[]);h.push({id:crypto.randomUUID(),type,at:Date.now(),...data});write(HIST,h.slice(-500))}
function queueCommand(s,payload){s.pending={id:crypto.randomUUID(),...payload,created_at:Date.now()};write(DEVICE,s)}
export function coffeeSequenceStatus(){return read(SEQ,{running:false,paused:false,queue:[],index:0,phase:'idle',guardian:{status:'ok',issues:[]}})}
function firmwareAtLeast137(s={}){const m=String(s.firmware||'').match(/(\d+)\.(\d+)\.(\d+)/);if(!m)return false;const v=m.slice(1).map(Number);return v[0]>1||(v[0]===1&&(v[1]>3||(v[1]===3&&v[2]>=7)))}
function assertSectorFirmware(sectors,s){if((sectors||[]).some(x=>Number(x.relay)>LEGACY_LAST_SECTOR_RELAY)&&!firmwareAtLeast137(s))throw new Error('Setores 08 e 09 exigem firmware ESP32 1.3.7 ou superior')}
function setGuardian(q,issues=[]){
 const prev=q.guardian||{},critical=issues.some(x=>x.level==='critical'),status=critical?'critical':issues.length?'warning':'ok';
 q.guardian={status,issues,checked_at:Date.now(),last_incident:issues.length?{at:Date.now(),issues}:prev.last_incident||null,last_recovery_at:!issues.length&&prev.status&&prev.status!=='ok'?Date.now():prev.last_recovery_at||null};
 return q.guardian;
}
function physicalGuardian(q,s,cfg){
 const rel=s.relays||[],pump=Boolean(rel[1]),open=[];for(let r=FIRST_SECTOR_RELAY;r<=LAST_SECTOR_RELAY;r++)if(rel[r-1])open.push(r);
 const issues=[],now=Date.now(),overlap=Math.max(2,Math.min(15,Number(cfg.handover_seconds)||5));
 if(pump&&!open.length)issues.push({code:'pump_without_valve',level:'critical',message:'Bomba R2 ligada sem válvula de setor confirmada.'});
 if(open.length&&!pump)issues.push({code:'valve_without_pump',level:'critical',message:'Válvula de café aberta sem bomba R2 confirmada.'});
 if(open.length>1&&q.phase!=='handover')issues.push({code:'multiple_valves_unexpected',level:'critical',message:'Mais de uma válvula aberta fora da troca protegida.'});
 if(open.length>2)issues.push({code:'too_many_valves',level:'critical',message:'Mais de duas válvulas abertas simultaneamente.'});
 if(q.phase==='handover'&&open.length>1&&now-Number(q.handover_started_at||now)>(overlap*1000+GUARDIAN_GRACE_MS))issues.push({code:'handover_overdue',level:'critical',message:'Sobreposição de válvulas excedeu o tempo seguro.'});
 if(q.running&&q.phase==='watering'&&q.deadline_at&&now>Number(q.deadline_at)+GUARDIAN_GRACE_MS)issues.push({code:'sector_overdue',level:'critical',message:'Setor permaneceu irrigando além do deadline.'});
 setGuardian(q,issues);return issues;
}
export function startCoffeeSequence(sectors,meta={}){const clean=(Array.isArray(sectors)?sectors:[]).map(x=>({relay:Number(x.relay),duration_minutes:Math.max(1,Math.min(720,Number(x.duration_minutes)||20))})).filter(x=>x.relay>=FIRST_SECTOR_RELAY&&x.relay<=LAST_SECTOR_RELAY);if(!clean.length)throw new Error('Selecione pelo menos um setor');if(new Set(clean.map(x=>x.relay)).size!==clean.length)throw new Error('Setor repetido');const s=read(DEVICE);assertSectorFirmware(clean,s);if(!fresh(s))throw new Error('ESP32 offline');if(s.pending)throw new Error('Aguarde o comando físico atual');if((s.relays||[]).slice(1).some(Boolean))throw new Error('Há irrigação do café em andamento');const q={id:crypto.randomUUID(),running:true,paused:false,queue:clean,index:0,phase:'starting',started_at:Date.now(),sector_started_at:0,deadline_at:0,total_minutes:clean.reduce((a,x)=>a+x.duration_minutes,0),source:meta.source||'manual',program_id:meta.program_id||null,program_name:meta.program_name||null,updated_at:Date.now()};write(SEQ,q);event('sequence_started',{sequence_id:q.id,source:q.source,program_name:q.program_name,total_minutes:q.total_minutes,sectors:clean});return q}
export function pauseCoffeeSequence(reason='manual'){let q=coffeeSequenceStatus();if(!q.running)return q;q.paused=true;q.pause_reason=reason;q.paused_at=Date.now();q.remaining_ms=q.phase==='watering'?Math.max(0,Number(q.deadline_at)-Date.now()):0;q.phase_before_pause=q.phase;q.phase='pausing';write(SEQ,q);event('sequence_paused',{sequence_id:q.id,reason});return q}
export function resumeCoffeeSequence(){let q=coffeeSequenceStatus();if(!q.running||!q.paused)return q;q.paused=false;q.pause_reason=null;q.resume_remaining_ms=Math.max(0,Number(q.remaining_ms||0));q.remaining_ms=0;q.phase='starting';q.deadline_at=0;q.updated_at=Date.now();write(SEQ,q);event('sequence_resumed',{sequence_id:q.id});return q}
export function adjustCoffeeSequence(action,payload={}){
 const q=coffeeSequenceStatus();if(!q.running)throw new Error('Não há irrigação do café em andamento');
 if(q.phase==='handover'||q.phase==='finishing'||q.phase==='pausing')throw new Error('Aguarde a troca física terminar');
 if(action==='extend'){
   const minutes=Math.max(1,Math.min(60,Number(payload.minutes)||5));if(q.phase!=='watering')throw new Error('Aguarde o setor entrar em irrigação');
   q.deadline_at=Number(q.deadline_at||Date.now())+minutes*60000;q.queue[q.index].duration_minutes=Number(q.queue[q.index].duration_minutes||0)+minutes;q.total_minutes=Number(q.total_minutes||0)+minutes;q.updated_at=Date.now();write(SEQ,q);event('sector_extended',{sequence_id:q.id,relay:q.queue[q.index].relay,minutes});return q
 }
 if(action==='skip'){
   if(q.phase!=='watering')throw new Error('Aguarde o setor entrar em irrigação');q.deadline_at=Date.now();q.updated_at=Date.now();write(SEQ,q);event('sector_skip_requested',{sequence_id:q.id,relay:q.queue[q.index].relay});return q
 }
 if(action==='append'){
   const relay=Number(payload.relay),duration=Math.max(1,Math.min(720,Number(payload.duration_minutes)||20));if(relay<FIRST_SECTOR_RELAY||relay>LAST_SECTOR_RELAY)throw new Error('Setor inválido');
   assertSectorFirmware([{relay}],read(DEVICE));if(q.queue.slice(q.index).some(x=>Number(x.relay)===relay))throw new Error('Este setor já está na fila atual');
   q.queue.push({relay,duration_minutes:duration});q.total_minutes=Number(q.total_minutes||0)+duration;q.updated_at=Date.now();write(SEQ,q);event('sector_appended',{sequence_id:q.id,relay,duration_minutes:duration});return q
 }
 throw new Error('Ajuste de sequência inválido')
}
export function stopCoffeeSequence(reason='manual'){const q=coffeeSequenceStatus(),s=read(DEVICE);q.running=false;q.paused=false;q.phase='stopping';q.stop_reason=reason;q.updated_at=Date.now();write(SEQ,q);if(!s.pending)queueCommand(s,{type:'all_off',source:'coffee_sequence_stop'});event('sequence_stopped',{sequence_id:q.id,reason,index:q.index});return q}
function localParts(ts=Date.now()){const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Porto_Velho',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(ts));return Object.fromEntries(p.map(x=>[x.type,x.value]))}
let weather={raining:false,lastRainAt:0,usable:false,checkedAt:0,lastGoodAt:0,stale:false,error:null};
async function checkWeather(){try{const w=await fetchWeatherSnapshot({maxAgeMs:60000});const raining=Boolean(w?.metrics?.rainDetected);if(raining)weather.lastRainAt=Date.now();weather={...weather,raining,usable:Boolean(w?.linked),checkedAt:Date.now(),lastGoodAt:Number(w?.last_good_at||w?.checked_at||Date.now()),stale:Boolean(w?.stale),error:w?.error||null}}catch(e){weather={...weather,usable:false,checkedAt:Date.now(),stale:true,error:e?.message||String(e)}}}
setInterval(checkWeather,15000).unref?.();checkWeather();
function maybeSchedule(){const c=coffeeAutomation();if(!c.enabled)return;const q=coffeeSequenceStatus();if(q.running)return;const p=localParts(),day={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[p.weekday],hm=p.hour+':'+p.minute,date=p.year+'-'+p.month+'-'+p.day;for(const sc of c.schedules||[]){if(!sc.enabled||String(sc.time)!==hm||!(sc.days||[]).map(Number).includes(day)||sc.last_run_date===date)continue;const prog=(c.programs||[]).find(x=>x.id===sc.program_id);if(!prog)continue;sc.last_run_date=date;saveCoffeeAutomation(c);const w=c.weather||{};if(w.enabled&&w.pause_on_rain&&(weather.raining||(weather.lastRainAt&&Date.now()-weather.lastRainAt<Number(w.rain_wait_minutes||120)*60000))){event('schedule_weather_blocked',{program_name:prog.name,date});continue}try{startCoffeeSequence(prog.sectors,{source:'schedule',program_id:prog.id,program_name:prog.name})}catch(e){event('schedule_failed',{program_name:prog.name,error:e.message})}}}
function failSequence(q,message,extra={}){q.running=false;q.phase='error';q.error=message;q.updated_at=Date.now();write(SEQ,q);event('sequence_error',{sequence_id:q.id,error:message,...extra})}
export function tickCoffeeSequence(){
 let q=coffeeSequenceStatus();if(!q.running){maybeSchedule();return}
 let s=read(DEVICE);if(!fresh(s)){failSequence(q,'ESP32 offline');return}
 const cfg=coffeeAutomation(),w=cfg.weather||{},overlap=Math.max(2,Math.min(15,Number(cfg.handover_seconds)||5));
 const guardianIssues=physicalGuardian(q,s,cfg);
 if(guardianIssues.some(x=>x.level==='critical')){
   if(!s.pending)queueCommand(s,{type:'all_off',source:'coffee_guardian_fail_safe'});
   failSequence(q,'Guardian do café interrompeu a irrigação por condição física insegura.',{guardian_issues:guardianIssues});return
 }
 if(w.enabled&&w.pause_on_rain&&weather.raining&&!q.paused){q.rain_detected_at=Date.now();write(SEQ,q);pauseCoffeeSequence('rain');event('rain_pause',{sequence_id:q.id,relay:q.queue?.[q.index]?.relay,remaining_ms:Math.max(0,Number(q.deadline_at||0)-Date.now())})}
 q=coffeeSequenceStatus();
 if(q.paused){if(!s.pending)queueCommand(s,{type:'all_off',source:'coffee_pause'});if(q.pause_reason==='rain'&&!weather.raining&&weather.usable&&!weather.stale&&(!weather.lastRainAt||Date.now()-weather.lastRainAt>=Number(w.rain_wait_minutes||120)*60000)){event('rain_resume_ready',{sequence_id:q.id,weather_checked_at:weather.checkedAt});resumeCoffeeSequence()}return}
 if(s.pending)return;
 const item=q.queue?.[q.index];
 if(!item){q.running=false;q.phase='completed';q.completed_at=Date.now();q.updated_at=Date.now();write(SEQ,q);event('sequence_completed',{sequence_id:q.id,program_name:q.program_name,total_minutes:q.total_minutes,started_at:q.started_at,completed_at:q.completed_at,duration_ms:q.completed_at-Number(q.started_at||q.completed_at),sectors:q.queue});return}
 const on=Boolean(s.relays?.[item.relay-1]),pump=Boolean(s.relays?.[1]),next=q.queue?.[q.index+1];
 if(q.phase==='starting'){if(!on&&!pump){queueCommand(s,{type:'coffee_sector',relay:item.relay,on:true,pump_relay:2,source:'coffee_sequence'});q.phase='confirming';q.updated_at=Date.now();write(SEQ,q);return}q.phase='confirming'}
 if(q.phase==='confirming'){if(on&&pump){q.phase='watering';q.sector_started_at=Date.now();q.deadline_at=Date.now()+(Number(q.resume_remaining_ms)>0?Number(q.resume_remaining_ms):item.duration_minutes*60000);q.resume_remaining_ms=0;q.updated_at=Date.now();write(SEQ,q);event('sector_started',{sequence_id:q.id,relay:item.relay,duration_minutes:item.duration_minutes,index:q.index})}return}
 if(q.phase==='watering'){
   const remaining=Number(q.deadline_at||0)-Date.now();
   if(next&&remaining<=overlap*1000){
     queueCommand(s,{type:'coffee_handover',from_relay:item.relay,to_relay:next.relay,overlap_seconds:overlap,pump_relay:2,source:'coffee_handover'});
     q.phase='handover';q.handover_started_at=Date.now();q.handover_from=item.relay;q.handover_to=next.relay;q.updated_at=Date.now();write(SEQ,q);
     event('sector_handover_started',{sequence_id:q.id,from_relay:item.relay,to_relay:next.relay,overlap_seconds:overlap,index:q.index});return
   }
   if(!next&&remaining<=0){queueCommand(s,{type:'coffee_sector',relay:item.relay,on:false,pump_relay:2,source:'coffee_sequence_final'});q.phase='finishing';q.updated_at=Date.now();write(SEQ,q);return}
 }
 if(q.phase==='handover'){
   const nextOn=Boolean(s.relays?.[Number(q.handover_to)-1]),oldOff=!Boolean(s.relays?.[Number(q.handover_from)-1]);
   if(nextOn&&oldOff&&pump){
     event('sector_completed',{sequence_id:q.id,relay:q.handover_from,duration_minutes:item.duration_minutes,index:q.index,handover:true});
     q.index++;const ni=q.queue[q.index];q.phase='watering';q.sector_started_at=Number(q.handover_started_at)||Date.now();q.deadline_at=q.sector_started_at+Number(ni.duration_minutes)*60000;q.handover_completed_at=Date.now();q.updated_at=Date.now();write(SEQ,q);
     event('sector_started',{sequence_id:q.id,relay:ni.relay,duration_minutes:ni.duration_minutes,index:q.index,handover:true,pump_continuous:true});return
   }
   if(Date.now()-Number(q.handover_started_at||0)>(overlap+15)*1000){if(!s.pending)queueCommand(s,{type:'all_off',source:'coffee_handover_fail_safe'});failSequence(q,'Troca de setor não confirmada. Guardian desligou a irrigação.',{from_relay:q.handover_from,to_relay:q.handover_to});return}
 }
 if(q.phase==='finishing'&&!on&&!pump){event('sector_completed',{sequence_id:q.id,relay:item.relay,duration_minutes:item.duration_minutes,index:q.index});q.index++;q.phase='completed';q.deadline_at=0;q.sector_started_at=0;q.running=false;q.completed_at=Date.now();q.updated_at=Date.now();event('sequence_completed',{sequence_id:q.id,program_name:q.program_name,total_minutes:q.total_minutes,started_at:q.started_at,completed_at:q.completed_at,duration_ms:q.completed_at-Number(q.started_at||q.completed_at),sectors:q.queue});write(SEQ,q)}
}
setInterval(()=>{try{tickCoffeeSequence()}catch(e){event('manager_error',{error:e.message})}},500).unref?.();
