import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { storeGet, storeSet } from './irrigation/_store.js';

const SESSION_STORE_PATH='IrrigacaoFazenda2E/smartLife/sessionEncrypted';
const PY_MARKER='__SMARTLIFE_JSON__';
let sessionCache=null;
let sessionLoaded=false;

function encryptionKey(){
  const secret=String(process.env.SMARTLIFE_SESSION_KEY||'').trim();
  if(!secret)throw new Error('SMARTLIFE_SESSION_KEY não configurada no Railway.');
  return createHash('sha256').update(secret).digest();
}

function encryptJson(value){
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);
  const data=Buffer.concat([
    cipher.update(JSON.stringify(value),'utf8'),
    cipher.final()
  ]);
  const tag=cipher.getAuthTag();
  return{
    v:1,
    alg:'aes-256-gcm',
    iv:iv.toString('base64'),
    tag:tag.toString('base64'),
    data:data.toString('base64'),
    updated_at:new Date().toISOString()
  };
}

function decryptJson(record){
  if(!record?.iv||!record?.tag||!record?.data)return null;
  const decipher=createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(record.iv,'base64')
  );
  decipher.setAuthTag(Buffer.from(record.tag,'base64'));
  const plain=Buffer.concat([
    decipher.update(Buffer.from(record.data,'base64')),
    decipher.final()
  ]).toString('utf8');
  return JSON.parse(plain);
}

function validateSession(session){
  const required=['user_code','terminal_id','endpoint','token_info'];
  if(!session||typeof session!=='object'||required.some(k=>!session[k])){
    throw new Error('Sessão Smart Life inválida ou incompleta.');
  }
  if(!session.token_info?.access_token&&!session.token_info?.refresh_token){
    throw new Error('Sessão Smart Life sem token utilizável.');
  }
  return session;
}

async function loadSession(){
  if(sessionLoaded)return sessionCache;
  sessionLoaded=true;
  const record=await storeGet(SESSION_STORE_PATH).catch(()=>null);
  if(!record){
    sessionCache=null;
    return null;
  }
  sessionCache=validateSession(decryptJson(record));
  return sessionCache;
}

async function saveSession(session){
  const clean=validateSession(session);
  sessionCache=clean;
  sessionLoaded=true;
  await storeSet(SESSION_STORE_PATH,encryptJson(clean));
}

function pythonBin(){
  const explicit=String(process.env.SMARTLIFE_PYTHON_BIN||'').trim();
  if(explicit)return explicit;
  const venv=path.join(process.cwd(),'.smartlife-venv','bin','python');
  if(existsSync(venv))return venv;
  return 'python3';
}

function runBridge(input){
  return new Promise((resolve,reject)=>{
    const child=spawn(pythonBin(),[path.join(process.cwd(),'smartlife','bridge.py')],{
      cwd:process.cwd(),
      env:{...process.env,PYTHONIOENCODING:'utf-8'},
      stdio:['pipe','pipe','pipe']
    });
    let stdout='';
    let stderr='';
    let finished=false;
    const timer=setTimeout(()=>{
      if(finished)return;
      finished=true;
      child.kill('SIGKILL');
      reject(new Error('Tempo esgotado ao acessar o Smart Life.'));
    },90000);

    const append=(current,chunk)=>(
      current.length>2_000_000?current:current+chunk.toString('utf8')
    );
    child.stdout.on('data',chunk=>{stdout=append(stdout,chunk)});
    child.stderr.on('data',chunk=>{stderr=append(stderr,chunk)});
    child.on('error',error=>{
      if(finished)return;
      finished=true;
      clearTimeout(timer);
      reject(new Error('Ponte Smart Life indisponível: '+(error?.message||String(error))));
    });
    child.on('close',code=>{
      if(finished)return;
      finished=true;
      clearTimeout(timer);
      const line=stdout.split(/\r?\n/).reverse().find(x=>x.startsWith(PY_MARKER));
      if(!line){
        const hint=code===0?'resposta inválida':'processo encerrou com código '+code;
        return reject(new Error('Falha na ponte Smart Life ('+hint+').'));
      }
      try{
        const result=JSON.parse(line.slice(PY_MARKER.length));
        if(!result?.ok)throw new Error(result?.error||'Falha no Smart Life.');
        resolve(result);
      }catch(error){
        reject(error);
      }
    });
    child.stdin.end(JSON.stringify(input));
  });
}

async function callWithStoredSession(payload){
  const session=await loadSession();
  if(!session)throw new Error('Smart Life ainda não conectado ao servidor.');
  const result=await runBridge({...payload,session});
  if(result.session)await saveSession(result.session);
  return result;
}

export async function smartLifeConfigured(){
  try{return Boolean(await loadSession())}catch{return false}
}

export async function importSmartLifeSession(session){
  validateSession(session);
  const result=await runBridge({action:'list',session});
  if(result.session)session=result.session;
  await saveSession(session);
  return{
    ok:true,
    devices:(result.devices||[]).map(d=>({
      id:d.id,
      name:d.name,
      online:d.online,
      category:d.category,
      support_local:d.support_local
    }))
  };
}

export async function smartLifeListDevices(){
  const result=await callWithStoredSession({action:'list'});
  return result.devices||[];
}

export async function smartLifeReadDevice({deviceId=null,deviceName=null}={}){
  const result=await callWithStoredSession({
    action:'device',
    device_id:deviceId||undefined,
    device_name:deviceName||undefined
  });
  return result.device;
}

export async function smartLifeSendCommands({deviceId=null,deviceName=null,commands=[]}={}){
  const result=await callWithStoredSession({
    action:'command',
    device_id:deviceId||undefined,
    device_name:deviceName||undefined,
    commands,
    confirm_delay:0.8
  });
  return result.device;
}
