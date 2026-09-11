import fs from 'node:fs';

function replaceOnce(text,from,to,label){
  if(text.includes(to))return text;
  if(!text.includes(from))throw new Error('Não foi possível aplicar: '+label);
  return text.replace(from,to);
}

// Expose the decrypted Smart Life session only inside the backend process so the
// Python watchdog can establish its own independent Smart Life connection.
{
  const file='server/api/_smartlife.js';
  let text=fs.readFileSync(file,'utf8');
  if(!text.includes('export async function smartLifeSafetySession')){
    text += `\n\n// Internal-only: used by the local Python safety watchdog. Never exposed by API.\nexport async function smartLifeSafetySession(){\n  const session=await loadSession();\n  if(!session)throw new Error('Smart Life ainda não conectado ao servidor.');\n  return JSON.parse(JSON.stringify(session));\n}\n`;
  }
  fs.writeFileSync(file,text);
}

{
  const file='server/continuous/server.js';
  let text=fs.readFileSync(file,'utf8');
  text=replaceOnce(text,
    "import { fileURLToPath } from 'node:url';",
    "import { fileURLToPath } from 'node:url';\nimport { spawn } from 'node:child_process';",
    'import child_process'
  );
  text=replaceOnce(text,
    "import { smartLifeConfigured, smartLifeListDevices } from '../api/_smartlife.js';",
    "import { smartLifeConfigured, smartLifeListDevices, smartLifeSafetySession } from '../api/_smartlife.js';",
    'sessão interna do watchdog'
  );

  const marker="async function runReadOnlyBootDiagnostics(){";
  if(!text.includes('async function startPythonSafetyWatchdog(){')){
    const block=`let pythonSafetyWatchdog=null;\nlet pythonSafetyRestartTimer=null;\nlet pythonSafetyStopping=false;\n\nasync function startPythonSafetyWatchdog(){\n  if(pythonSafetyStopping||pythonSafetyWatchdog)return;\n  try{\n    if(!(await smartLifeConfigured()))return;\n    const session=await smartLifeSafetySession();\n    const python=String(process.env.SMARTLIFE_PYTHON_BIN||'/opt/smartlife/bin/python').trim()||'python3';\n    const child=spawn(python,['smartlife/safety_watchdog.py'],{\n      cwd:process.cwd(),\n      env:{...process.env,PYTHONIOENCODING:'utf-8'},\n      stdio:['pipe','pipe','pipe']\n    });\n    pythonSafetyWatchdog=child;\n    let stdout='';\n    child.stdout.on('data',chunk=>{\n      stdout+=chunk.toString('utf8');\n      if(stdout.length>64000)stdout=stdout.slice(-32000);\n      for(;;){\n        const i=stdout.indexOf('\\n');\n        if(i<0)break;\n        const line=stdout.slice(0,i).trim();\n        stdout=stdout.slice(i+1);\n        if(line.startsWith('__F2E_PY_WATCHDOG__'))console.log('Python safety',line.slice('__F2E_PY_WATCHDOG__'.length));\n      }\n    });\n    child.stderr.on('data',chunk=>console.warn('Python safety stderr:',chunk.toString('utf8').trim()));\n    child.on('close',code=>{\n      if(pythonSafetyWatchdog===child)pythonSafetyWatchdog=null;\n      console.warn('Python safety watchdog encerrou:',code);\n      if(!pythonSafetyStopping){\n        clearTimeout(pythonSafetyRestartTimer);\n        pythonSafetyRestartTimer=setTimeout(()=>startPythonSafetyWatchdog().catch(()=>null),15000);\n        pythonSafetyRestartTimer.unref?.();\n      }\n    });\n    child.on('error',error=>console.warn('Python safety watchdog indisponível:',error?.message||error));\n    child.stdin.end(JSON.stringify({\n      session,\n      viveiro_name:String(process.env.SMARTLIFE_VIVEIRO_NAME||'Viveiro').trim(),\n      weather_name:String(process.env.WEATHER_DEVICE_NAME||'Weather2-2').trim(),\n      poll_seconds:5,\n      weather_stale_seconds:25,\n      deadline_grace_ms:1000\n    })+'\\n');\n    console.log('Python safety watchdog iniciado em modo OFF-only.');\n  }catch(error){\n    console.warn('Python safety watchdog não iniciou:',error?.message||error);\n    if(!pythonSafetyStopping){\n      clearTimeout(pythonSafetyRestartTimer);\n      pythonSafetyRestartTimer=setTimeout(()=>startPythonSafetyWatchdog().catch(()=>null),15000);\n      pythonSafetyRestartTimer.unref?.();\n    }\n  }\n}\n\nfunction stopPythonSafetyWatchdog(){\n  pythonSafetyStopping=true;\n  if(pythonSafetyRestartTimer)clearTimeout(pythonSafetyRestartTimer);\n  pythonSafetyRestartTimer=null;\n  const child=pythonSafetyWatchdog;\n  pythonSafetyWatchdog=null;\n  if(child){try{child.kill('SIGTERM')}catch{}}\n}\n\n`;
    if(!text.includes(marker))throw new Error('Ponto de inserção do watchdog não encontrado.');
    text=text.replace(marker,block+marker);
  }

  text=replaceOnce(text,
    "await initSecondsManager();\nawait runReadOnlyBootDiagnostics();",
    "await initSecondsManager();\nawait startPythonSafetyWatchdog();\nawait runReadOnlyBootDiagnostics();",
    'inicialização do watchdog'
  );

  text=replaceOnce(text,
    "  if(interlockTimer)clearInterval(interlockTimer);\n  console.log('Encerrando servidor:',signal);",
    "  if(interlockTimer)clearInterval(interlockTimer);\n  stopPythonSafetyWatchdog();\n  console.log('Encerrando servidor:',signal);",
    'shutdown do watchdog'
  );

  fs.writeFileSync(file,text);
}

console.log('[Fazenda 2E] Python safety watchdog: chuva e limite de pulso protegidos por processo independente.');
