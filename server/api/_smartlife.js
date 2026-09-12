import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { storeGet, storeSet } from './irrigation/_store.js';

const SESSION_STORE_PATH='IrrigacaoFazenda2E/smartLife/sessionEncrypted';
const PY_MARKER='__SMARTLIFE_JSON__';
const READ_CACHE_MS=2500;
const LIST_CACHE_MS=4000;

let sessionCache=null;
let sessionLoaded=false;
let savedSessionFingerprint='';
let listCache={at:0,devices:null};
let listFetchPromise=null;

function encryptionKey(){
  const secret=String(process.env.SMARTLIFE_SESSION_KEY||'').trim();
  if(!secret)throw new Error('SMARTLIFE_SESSION_KEY não configurada no servidor.');
  return createHash('sha256').update(secret).digest();
}

function encryptJson(value){
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);
  const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  const tag=cipher.getAuthTag();
  return{v:1,alg:'aes-256-gcm',iv:iv.toString('base64'),tag:tag.toString('base64'),data:data.toString('base64'),updated_at:new Date().toISOString()};
}

function decryptJson(record){
  if(!record?.iv||!record?.tag||!record?.data)return null;
  const decipher=createDecipheriv('aes-256-gcm',encryptionKey(),Buffer.from(record.iv,'base64'));
  decipher.setAuthTag(Buffer.from(record.tag,'base64'));
  const plain=Buffer.concat([decipher.update(Buffer.from(record.data,'base64')),decipher.final()]).toString('utf8');
  return JSON.parse(plain);
}

function validateSession(session){
  const required=['user_code','terminal_id','endpoint','token_info'];
  if(!session||typeof session!=='object'||required.some(k=>!session[k]))throw new Error('Sessão Smart Life inválida ou incompleta.');
  if(!session.token_info?.access_token&&!session.token_info?.refresh_token)throw new Error('Sessão Smart Life sem token utilizável.');
  return session;
}

function sessionFingerprint(session){
  return JSON.stringify({client_id:session?.client_id||'',user_code:session?.user_code||'',terminal_id:session?.terminal_id||'',endpoint:session?.endpoint||'',token_info:session?.token_info||{}});
}
function tokenIssuedAt(session){return Number(session?.token_info?.t||0)}
function tokenAbsoluteExpiry(session){const t=tokenIssuedAt(session),seconds=Number(session?.token_info?.expire_time||0);return t>0&&seconds>0?t+seconds*1000:0}

async function loadSession(){
  if(sessionLoaded)return sessionCache;
  sessionLoaded=true;
  const record=await storeGet(SESSION_STORE_PATH).catch(()=>null);
  if(!record){sessionCache=null;return null}
  sessionCache=validateSession(decryptJson(record));
  savedSessionFingerprint=sessionFingerprint(sessionCache);
  return sessionCache;
}

async function saveSession(session){
  const clean=validateSession(session);
  const currentIssued=tokenIssuedAt(sessionCache),nextIssued=tokenIssuedAt(clean);
  const currentExpiry=tokenAbsoluteExpiry(sessionCache),nextExpiry=tokenAbsoluteExpiry(clean);
  if(sessionCache){
    if(currentIssued>0&&nextIssued>0&&currentIssued>nextIssued)return;
    if(currentIssued===nextIssued&&currentExpiry>0&&nextExpiry>0&&currentExpiry>nextExpiry)return;
  }
  sessionCache=clean;sessionLoaded=true;
  const fingerprint=sessionFingerprint(clean);
  if(fingerprint===savedSessionFingerprint)return;
  await storeSet(SESSION_STORE_PATH,encryptJson(clean));
  savedSessionFingerprint=fingerprint;
}

function pythonBin(){
  const explicit=String(process.env.SMARTLIFE_PYTHON_BIN||'').trim();
  if(explicit)return explicit;
  const venv=path.join(process.cwd(),'.smartlife-venv','bin','python');
  if(existsSync(venv))return venv;
  return 'python3';
}

class PersistentBridgeWorker{
  constructor(name){this.name=name;this.child=null;this.stdoutBuffer='';this.stderrTail='';this.current=null;this.sequence=0;this.queue=Promise.resolve()}
  ensureProcess(){
    if(this.child&&!this.child.killed)return this.child;
    const child=spawn(pythonBin(),[path.join(process.cwd(),'smartlife','bridge.py'),'--daemon'],{cwd:process.cwd(),env:{...process.env,PYTHONIOENCODING:'utf-8'},stdio:['pipe','pipe','pipe']});
    this.child=child;this.stdoutBuffer='';this.stderrTail='';
    child.stdout.on('data',chunk=>this.onStdout(chunk));
    child.stderr.on('data',chunk=>{this.stderrTail=(this.stderrTail+chunk.toString('utf8')).slice(-4000)});
    child.on('error',error=>this.failCurrent(new Error('Ponte Smart Life indisponível: '+(error?.message||String(error)))));
    child.on('close',code=>{const wasCurrent=this.current;this.child=null;this.stdoutBuffer='';if(wasCurrent){const hint=this.stderrTail.trim()||('processo encerrou com código '+code);this.failCurrent(new Error('Falha na ponte Smart Life ('+hint+').'))}});
    return child;
  }
  onStdout(chunk){
    this.stdoutBuffer+=chunk.toString('utf8');
    if(this.stdoutBuffer.length>4_000_000)this.stdoutBuffer=this.stdoutBuffer.slice(-2_000_000);
    for(;;){const idx=this.stdoutBuffer.indexOf('\n');if(idx<0)break;const line=this.stdoutBuffer.slice(0,idx).trim();this.stdoutBuffer=this.stdoutBuffer.slice(idx+1);if(!line.startsWith(PY_MARKER))continue;let envelope;try{envelope=JSON.parse(line.slice(PY_MARKER.length))}catch{continue}const pending=this.current;if(!pending||String(envelope?.request_id)!==String(pending.id))continue;clearTimeout(pending.timer);this.current=null;const result=envelope?.result;if(!result?.ok)return pending.reject(new Error(result?.error||'Falha no Smart Life.'));pending.resolve(result)}
  }
  failCurrent(error){const pending=this.current;if(!pending)return;clearTimeout(pending.timer);this.current=null;pending.reject(error)}
  call(input,{timeoutMs=30000}={}){const execute=()=>this.callOnce(input,{timeoutMs});const job=this.queue.then(execute,execute);this.queue=job.catch(()=>null);return job}
  callOnce(input,{timeoutMs=30000}={}){
    return new Promise((resolve,reject)=>{const child=this.ensureProcess();const id=`${this.name}-${Date.now()}-${++this.sequence}`;const timer=setTimeout(()=>{if(this.current?.id!==id)return;this.current=null;try{child.kill('SIGKILL')}catch{}reject(new Error('Tempo esgotado ao acessar o Smart Life.'))},Math.max(5000,Number(timeoutMs)||30000));timer.unref?.();this.current={id,resolve,reject,timer};const payload=JSON.stringify({request_id:id,payload:input})+'\n';child.stdin.write(payload,error=>{if(!error)return;if(this.current?.id===id){clearTimeout(timer);this.current=null}reject(new Error('Falha ao enviar comando para a ponte Smart Life: '+(error?.message||String(error))))})});
  }
}

// Um único processo é dono da sessão Smart Life. Isso evita corrida de refresh token
// e erros intermitentes de "sign invalid" entre leituras e comandos prioritários.
const smartLifeBridge=new PersistentBridgeWorker('smartlife');
function queuedBridge(input,{timeoutMs=30000}={}){return smartLifeBridge.call(input,{timeoutMs})}

async function callWithStoredSession(payload){
  const session=await loadSession();
  if(!session)throw new Error('Smart Life ainda não conectado ao servidor.');
  const result=await queuedBridge({...payload,session});
  if(result.session)await saveSession(result.session);
  return result;
}

function matchDevice(devices,{deviceId=null,deviceName=null}={}){
  if(deviceId){const found=devices.find(d=>String(d?.id||'')===String(deviceId));if(found)return found}
  const target=String(deviceName||'').trim().toLowerCase();
  if(target){const exact=devices.find(d=>String(d?.name||'').trim().toLowerCase()===target);if(exact)return exact;const partial=devices.find(d=>String(d?.name||'').trim().toLowerCase().includes(target));if(partial)return partial}
  return null;
}
function mergeDeviceIntoCache(device){if(!device||!Array.isArray(listCache.devices))return;const id=String(device.id||'');const index=listCache.devices.findIndex(d=>String(d?.id||'')===id);if(index>=0){listCache.devices[index]={...listCache.devices[index],...device};listCache.at=Date.now()}}

export async function smartLifeConfigured(){try{return Boolean(await loadSession())}catch{return false}}

export async function smartLifeReauthStart(){
  const session=await loadSession();
  if(!session)throw new Error('Não há uma sessão Smart Life anterior para recuperar o User Code.');
  const result=await queuedBridge({action:'reauth_start',client_id:session.client_id||'HA_3y9q4ak7g4ephrvke',user_code:session.user_code});
  return{ok:true,token:result.token,qr_data:result.qr_data,qr_image:result.qr_image};
}

export async function smartLifeReauthFinish(token){
  const current=await loadSession();
  if(!current)throw new Error('Sessão Smart Life anterior não encontrada.');
  const result=await queuedBridge({action:'reauth_finish',client_id:current.client_id||'HA_3y9q4ak7g4ephrvke',user_code:current.user_code,token:String(token||'').trim()});
  if(!result?.authorized)return{ok:true,authorized:false,error:result?.error||'Autorização ainda não confirmada no Smart Life.'};
  const verified=await importSmartLifeSession(result.session);
  return{ok:true,authorized:true,devices:verified.devices||[]};
}

export async function importSmartLifeSession(session){
  validateSession(session);
  const result=await queuedBridge({action:'list',session});
  if(result.session)session=result.session;
  await saveSession(session);
  listCache={at:Date.now(),devices:result.devices||[]};
  return{ok:true,devices:(result.devices||[]).map(d=>({id:d.id,name:d.name,online:d.online,category:d.category,support_local:d.support_local}))};
}

export async function smartLifeListDevices({maxAgeMs=LIST_CACHE_MS,force=false}={}){
  const age=Date.now()-Number(listCache.at||0);
  if(!force&&Array.isArray(listCache.devices)&&age>=0&&age<=Math.max(0,Number(maxAgeMs)||0))return listCache.devices;
  if(!force&&listFetchPromise)return listFetchPromise;
  const task=(async()=>{const result=await callWithStoredSession({action:'list'});listCache={at:Date.now(),devices:result.devices||[]};return listCache.devices})();
  if(!force)listFetchPromise=task;
  try{return await task}finally{if(listFetchPromise===task)listFetchPromise=null}
}

export async function smartLifeReadDevice({deviceId=null,deviceName=null,maxAgeMs=READ_CACHE_MS,force=false}={}){
  const devices=await smartLifeListDevices({maxAgeMs,force});
  const device=matchDevice(devices,{deviceId,deviceName});
  if(!device){const names=devices.map(d=>String(d?.name||'')).filter(Boolean);throw new Error('Dispositivo não encontrado. Disponíveis: '+names.join(', '))}
  return device;
}

export async function smartLifeSendCommands({deviceId=null,deviceName=null,commands=[],priority=false}={}){
  const session=await loadSession();
  if(!session)throw new Error('Smart Life ainda não conectado ao servidor.');
  const input={action:'command',session,device_id:deviceId||undefined,device_name:deviceName||undefined,commands,confirm_delay:priority?0.15:0.35};
  const result=await queuedBridge(input,{timeoutMs:priority?12000:30000});
  if(result.session)await saveSession(result.session);
  if(result.device)mergeDeviceIntoCache(result.device);else listCache={at:0,devices:null};
  return result.device;
}
