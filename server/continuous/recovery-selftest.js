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
    runCase(evaluateAutonomy,'history_stale',x=>{x.history.sync.last_success_at=now-10*60000},r=>r.issues.some(i=>i.key==='history-sync'),now)
  ];
  return{ok:cases.every(x=>x.ok),checked_at:now,mode:'simulation_only',cases,physical_actions:false,note:'Falhas simuladas apenas em memória; nenhum dispositivo real é desligado.'};
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
