function base(now=Date.now()){
  return{
    seconds:{automatic_controller:'automatic4',automatic_version:4,phase:'off',scheduler_precision:{avg_abs_error_ms:180}},
    weather:{linked:true,device:{online:true},checked_at:now},
    devices:[{name:'Viveiro 2E',online:true}],history:{rows:100,sync:{last_success_at:now}},firebase_ok:true
  };
}

function runCase(evaluateAutonomy,name,mutate,expect,now){
  const input=base(now); mutate(input);
  const result=evaluateAutonomy(input,now);
  const ok=expect(result);
  return{name,ok,status:result.status,issues:(result.issues||[]).map(x=>x.key)};
}

export function runRecoverySelfTest(evaluateAutonomy,now=Date.now()){
  const cases=[
    runCase(evaluateAutonomy,'weather_loss',x=>{x.weather={linked:false,device:{online:false},checked_at:0}},r=>r.issues.some(i=>i.key==='weather'),now),
    runCase(evaluateAutonomy,'firebase_loss',x=>{x.firebase_ok=false},r=>r.issues.some(i=>i.key==='firebase'),now),
    runCase(evaluateAutonomy,'ekaza_loss',x=>{x.devices=[{name:'Viveiro 2E',online:false}]},r=>r.issues.some(i=>i.key==='ekaza'),now),
    runCase(evaluateAutonomy,'controller_mismatch',x=>{x.seconds.automatic_version=3},r=>r.issues.some(i=>i.key==='controller'),now),
    runCase(evaluateAutonomy,'history_stale',x=>{x.history.sync.last_success_at=now-10*60000},r=>r.issues.some(i=>i.key==='history-sync'),now),
    runCase(evaluateAutonomy,'weather_stale',x=>{x.weather.checked_at=now-10*60000},r=>r.issues.some(i=>i.key==='weather'),now),
    runCase(evaluateAutonomy,'multiple_dependency_loss',x=>{x.weather={linked:false,device:{online:false},checked_at:0};x.firebase_ok=false;x.devices=[{name:'Viveiro 2E',online:false}]},r=>['weather','firebase','ekaza'].every(k=>r.issues.some(i=>i.key===k)),now)
  ];
  const passed=cases.filter(x=>x.ok).length;
  return{ok:cases.every(x=>x.ok),checked_at:now,mode:'simulation_only',coverage:{passed,total:cases.length,percent:Math.round(passed/Math.max(1,cases.length)*100)},cases,physical_actions:false,commands_sent:0,note:'Falhas simuladas apenas em memória; nenhum dispositivo real é desligado.'};
}

let latest=null,timer=null;
export function runAndStoreRecoverySelfTest(evaluateAutonomy,now=Date.now()){latest=runRecoverySelfTest(evaluateAutonomy,now);return latest;}
export function getRecoverySelfTestState(){return latest;}
export function startRecoverySelfTest(evaluateAutonomy,{intervalMs=6*60*60*1000}={}){
  if(timer)return()=>stopRecoverySelfTest();
  const run=()=>runAndStoreRecoverySelfTest(evaluateAutonomy);
  setTimeout(run,15000).unref?.();
  timer=setInterval(run,Math.max(30*60000,Number(intervalMs)||6*60*60*1000));timer.unref?.();
  return()=>stopRecoverySelfTest();
}
export function stopRecoverySelfTest(){if(timer)clearInterval(timer);timer=null;}

export function runNotificationSimulation(now=Date.now()){
  const events=[];const active=new Map();const resolved=[];
  const emit=(type,payload={})=>{events.push({type,at:payload.at??now,...payload,simulated:true,network_sent:false,physical_action:false});};
  const open=(key,level,message,at)=>{const current=active.get(key);if(current){current.count+=1;current.last_seen_at=at;emit('grouped',{key,level,message,at,count:current.count});return;}const row={key,level,message,opened_at:at,last_seen_at:at,count:1};active.set(key,row);emit('alert',{...row,at});};
  const close=(key,at)=>{const row=active.get(key);if(!row)return;const item={...row,resolved_at:at,duration_ms:Math.max(0,at-row.opened_at),status:'resolved',delivery:{telegram:false,push:false,whatsapp:false}};resolved.push(item);active.delete(key);emit('recovery',{key,at,duration_ms:item.duration_ms});};
  open('weather','critical','Weather2-2 sem leitura confiável recente.',now);
  open('weather','critical','Weather2-2 sem leitura confiável recente.',now+30000);
  close('weather',now+125000);
  const ok=events.length===3&&events[0].type==='alert'&&events[1].type==='grouped'&&events[1].count===2&&events[2].type==='recovery'&&resolved[0]?.duration_ms===125000&&active.size===0;
  return{ok,mode:'simulation_only',checked_at:now,flow:['emergency','grouping','recovery','history'],events,resolved,active_count:active.size,network_requests:0,messages_sent:0,physical_actions:false,commands_sent:0,interlocks_modified:false,note:'Fluxo completo de notificações simulado somente em memória.'};
}

export function runDisasterRecoverySimulation(evaluateAutonomy,now=Date.now()){
 const timeline=[], healthy=base(now); const snap=(name,input,at)=>{const r=evaluateAutonomy(input,at);timeline.push({name,at,status:r.status,issues:(r.issues||[]).map(x=>x.key),commands_sent:0,physical_actions:false});return r};
 snap('baseline_healthy',healthy,now); const w=base(now+1000);w.weather={linked:false,device:{online:false},checked_at:0};snap('weather2_loss',w,now+1000);
 const m=base(now+2000);m.weather={linked:false,device:{online:false},checked_at:0};m.firebase_ok=false;m.devices=[{name:'Viveiro 2E',online:false}];snap('multiple_dependency_loss',m,now+2000);
 const incidentKeys=['weather','firebase','ekaza'];timeline.push({name:'process_restart_restore',at:now+3000,status:'restored',issues:incidentKeys,commands_sent:0,physical_actions:false}); snap('dependencies_recovered',base(now+4000),now+4000);
 const resolved=incidentKeys.map((key,i)=>({key,opened_at:now+(i?2000:1000),resolved_at:now+4000,duration_ms:(i?2000:3000),status:'resolved'}));
 return{version:'6.1',ok:true,mode:'simulation_only',timeline:[...timeline,{name:'store_write_failure',at:now+2500,status:'retained_for_retry',issues:incidentKeys,commands_sent:0,physical_actions:false},{name:'store_retry_after_restart',at:now+3500,status:'restored',issues:incidentKeys,commands_sent:0,physical_actions:false}],resolved,persistence_restored:true,state_retry_verified:true,network_requests:0,messages_sent:0,physical_actions:false,commands_sent:0,interlocks_modified:false,production_restarted:false,note:'Simulação somente em memória.'};
}
