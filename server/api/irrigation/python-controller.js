import { spawn } from 'node:child_process';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { authorize, applyCors } from '../_tuya.js';
import { storeGet } from './_store.js';
import { fetchWeatherSnapshot } from '../weather/_weather.js';

const ROOT='IrrigacaoFazenda2E';
const PY_MARKER='__F2E_PY_CONTROLLER__';

function pythonBin(){
  const explicit=String(process.env.SMARTLIFE_PYTHON_BIN||'').trim();
  if(explicit)return explicit;
  const venv=path.join(process.cwd(),'.smartlife-venv','bin','python');
  if(existsSync(venv))return venv;
  return 'python3';
}

function runShadow(payload){
  return new Promise((resolve,reject)=>{
    const child=spawn(pythonBin(),[path.join(process.cwd(),'smartlife','controller_shadow.py')],{
      cwd:process.cwd(),
      env:{...process.env,PYTHONIOENCODING:'utf-8'},
      stdio:['pipe','pipe','pipe']
    });
    let out='',err='';
    const timer=setTimeout(()=>{
      try{child.kill('SIGKILL')}catch{}
      reject(new Error('Tempo esgotado no controlador Python.'));
    },4000);
    timer.unref?.();
    child.stdout.on('data',chunk=>{out+=chunk.toString('utf8');});
    child.stderr.on('data',chunk=>{err=(err+chunk.toString('utf8')).slice(-2000);});
    child.on('error',reject);
    child.on('close',()=>{
      clearTimeout(timer);
      const line=out.split(/\r?\n/).find(x=>x.startsWith(PY_MARKER));
      if(!line)return reject(new Error(err.trim()||'Controlador Python não respondeu.'));
      try{
        const envelope=JSON.parse(line.slice(PY_MARKER.length));
        if(!envelope?.result?.ok)return reject(new Error(envelope?.result?.error||'Falha no controlador Python.'));
        resolve(envelope.result);
      }catch(error){reject(error)}
    });
    child.stdin.end(JSON.stringify({request_id:'diag-'+Date.now(),payload})+'\n');
  });
}

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'Método não permitido.'});
  if(!authorize(req,res))return;

  try{
    const [seconds,safety,maintenance,weather]=await Promise.all([
      storeGet(ROOT+'/viveiroSecondsState').catch(()=>({})),
      storeGet(ROOT+'/viveiroSafety').catch(()=>({})),
      storeGet(ROOT+'/viveiroMaintenance').catch(()=>({})),
      fetchWeatherSnapshot({maxAgeMs:15000}).catch(error=>({linked:false,error:error?.message||String(error)}))
    ]);
    const payload={
      seconds:seconds||{},
      safety:safety||{},
      maintenance:{...(maintenance||{}),active:Boolean(maintenance?.enabled&&Number(maintenance?.until||0)>Date.now())},
      weather:{
        linked:Boolean(weather?.linked),
        online:weather?.device?.online!==false,
        checked_at:Number(weather?.checked_at||0),
        rain_detected:Boolean(weather?.metrics?.rainDetected),
        temperature:weather?.metrics?.temperature?.value??null,
        humidity:weather?.metrics?.humidity?.value??null
      }
    };
    const result=await runShadow(payload);
    return res.status(200).json({ok:true,python_controller:result,source:'shadow_diagnostic'});
  }catch(error){
    return res.status(500).json({ok:false,error:error?.message||'Falha no controlador Python.'});
  }
}
