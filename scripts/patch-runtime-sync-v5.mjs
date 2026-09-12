import fs from 'node:fs';

function patchManager(){
  const file='server/continuous/seconds-manager.js';
  let src=fs.readFileSync(file,'utf8');
  if(src.includes('FAZENDA2E_RUNTIME_SYNC_V5'))return;
  const old=`function publicSecondsState(value=state){\n  const {\n    native_cycle_raw,\n    disabled_cycle_raw,\n    ...safe\n  }=value||{};\n  return{...safe,server_read_at:Date.now()};\n}`;
  const neu=`function publicSecondsState(value=state){\n  const {\n    native_cycle_raw,\n    disabled_cycle_raw,\n    ...safe\n  }=value||{};\n  // FAZENDA2E_RUNTIME_SYNC_V5\n  const now=Date.now();\n  const phase=String(safe.phase||'idle');\n  let targetAt=0;\n  if(phase==='on'||phase==='starting_on')targetAt=Number(safe.expected_off_at||0);\n  else if(phase==='off'||phase==='starting_off')targetAt=Number(safe.expected_next_on_at||0);\n  else if(phase==='waiting_window')targetAt=Number(safe.next_window_at||0);\n  const remainingMs=targetAt?Math.max(0,targetAt-now):0;\n  return{\n    ...safe,\n    server_read_at:now,\n    runtime_sync:{\n      version:5,\n      phase,\n      server_now:now,\n      target_at:targetAt||null,\n      remaining_ms:remainingMs,\n      remaining_seconds:Math.ceil(remainingMs/1000)\n    }\n  };\n}`;
  if(!src.includes(old))throw new Error('publicSecondsState marker not found');
  src=src.replace(old,neu);
  fs.writeFileSync(file,src);
}

function patchUi(){
  const file='dist/irrigacao/app.js';
  let src=fs.readFileSync(file,'utf8');
  if(src.includes('FAZENDA2E_UI_SYNC_V5'))return;

  const appMarker=`activeView:'summary',autoMode:'automatic',automationDirty:false,loading:false,sseAbort:null,dashboardPollTimer:null,statusPollTimer:null,sessionReady:false,authChecked:false`;
  if(!src.includes(appMarker))throw new Error('app state marker not found');
  src=src.replace(appMarker,appMarker+`,serverClockOffset:0,lastSecondsServerReadAt:0/*FAZENDA2E_UI_SYNC_V5*/`);

  const helperMarker=`function seconds(){`;
  if(!src.includes(helperMarker))throw new Error('seconds helper marker not found');
  src=src.replace(helperMarker,`function acceptSeconds(next){\n  if(!next||typeof next!=='object')return false;\n  const readAt=num(next.server_read_at||next.runtime_sync?.server_now);\n  const currentAt=num(app.seconds?.server_read_at||app.seconds?.runtime_sync?.server_now);\n  if(readAt&&currentAt&&readAt+250<currentAt)return false;\n  app.seconds=next;\n  if(readAt){app.lastSecondsServerReadAt=readAt;app.serverClockOffset=readAt-Date.now();}\n  return true;\n}\nfunction syncedNow(){return Date.now()+num(app.serverClockOffset)}\n`+helperMarker);

  const dashOld=`app.dashboard=d;app.seconds=d.seconds||app.seconds;app.lastDashboardAt=Date.now();`;
  const dashNew=`app.dashboard=d;if(d.seconds)acceptSeconds(d.seconds);if(app.seconds)app.dashboard.seconds=app.seconds;app.lastDashboardAt=Date.now();`;
  if(!src.includes(dashOld))throw new Error('dashboard overwrite marker not found');
  src=src.replace(dashOld,dashNew);

  const liveOld=`app.seconds=event.payload.state;\n            if(app.dashboard)app.dashboard.seconds=event.payload.state;`;
  const liveNew=`acceptSeconds(event.payload.state);\n            if(app.dashboard)app.dashboard.seconds=app.seconds;`;
  if(!src.includes(liveOld))throw new Error('live seconds marker not found');
  src=src.replace(liveOld,liveNew);

  const confirmOld=`app.seconds={...seconds(),\n              last_confirmation_at:num(p.confirmed_at)||seconds().last_confirmation_at,`;
  const confirmNew=`acceptSeconds({...seconds(),server_read_at:Date.now()+num(app.serverClockOffset),\n              last_confirmation_at:num(p.confirmed_at)||seconds().last_confirmation_at,`;
  if(src.includes(confirmOld)){
    src=src.replace(confirmOld,confirmNew);
    src=src.replace(`device_relay:p.command==='on'?true:p.command==='off'?false:seconds().device_relay\n            };\n            if(app.dashboard)app.dashboard.seconds=app.seconds;`,`device_relay:p.command==='on'?true:p.command==='off'?false:seconds().device_relay\n            });\n            if(app.dashboard)app.dashboard.seconds=app.seconds;`);
  }

  const watchdogOld=`app.seconds={...seconds(),watchdog:{status:event.payload?.status||'warning',checked_at:event.payload?.at||Date.now(),reason:event.payload?.reason||'',error:event.payload?.error||null}};`;
  if(src.includes(watchdogOld))src=src.replace(watchdogOld,`acceptSeconds({...seconds(),server_read_at:Date.now()+num(app.serverClockOffset),watchdog:{status:event.payload?.status||'warning',checked_at:event.payload?.at||Date.now(),reason:event.payload?.reason||'',error:event.payload?.error||null}});`);

  const clockOld=`const remain=Math.max(0,(at-Date.now())/1000);`;
  if(!src.includes(clockOld))throw new Error('countdown clock marker not found');
  src=src.replace(clockOld,`const remain=Math.max(0,(at-syncedNow())/1000);`);

  fs.writeFileSync(file,src);
}

patchManager();
if(fs.existsSync('dist/irrigacao/app.js'))patchUi();
console.log('[Fazenda 2E] Runtime Sync V5 aplicado.');
