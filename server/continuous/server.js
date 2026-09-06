import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import apiRouter from '../../api/router.js';
import secondsHandler from './seconds-handler.js';
import { initSecondsManager, suspendSecondsForRestart } from './seconds-manager.js';
import { listInkbirdDevices } from '../api/inkbird/_device.js';
import { tuyaRequest } from '../api/_tuya.js';
import { fetchWeatherSnapshot } from '../api/weather/_weather.js';
import { runViveiroWeatherCheck, getViveiroWeatherConfig } from '../api/viveiro/_weather_logic.js';

const PORT=Math.max(1,Number(process.env.PORT||3000));
const ROOT=process.cwd();
const DIST=path.join(ROOT,'dist');

const MIME={
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.webp':'image/webp',
  '.ico':'image/x-icon',
  '.webmanifest':'application/manifest+json',
  '.txt':'text/plain; charset=utf-8'
};

function decorateResponse(res){
  res.status=function(code){res.statusCode=code;return res};
  res.json=function(value){
    if(!res.headersSent)res.setHeader('Content-Type','application/json; charset=utf-8');
    res.end(JSON.stringify(value));
    return res;
  };
  res.send=function(value){
    if(value&&typeof value==='object')return res.json(value);
    res.end(value==null?'':String(value));
    return res;
  };
  return res;
}

async function parseBody(req){
  if(!['POST','PUT','PATCH','DELETE'].includes(req.method||''))return{};
  let total=0;
  const chunks=[];
  for await(const chunk of req){
    total+=chunk.length;
    if(total>1024*1024)throw new Error('Corpo da requisição muito grande.');
    chunks.push(chunk);
  }
  if(!chunks.length)return{};
  const text=Buffer.concat(chunks).toString('utf8');
  const type=String(req.headers['content-type']||'');
  if(type.includes('application/json')){
    try{return JSON.parse(text)}catch{throw new Error('JSON inválido.')}
  }
  return text;
}

function safeStaticPath(urlPath){
  let decoded='/';
  try{decoded=decodeURIComponent(urlPath||'/')}catch{}
  const clean=decoded.replace(/\\/g,'/').replace(/\.\.(\/|$)/g,'');
  let relative=clean.replace(/^\/+/,'');

  if(!relative)relative='index.html';
  if(relative.endsWith('/'))relative+='index.html';

  const candidate=path.resolve(DIST,relative);
  if(!candidate.startsWith(path.resolve(DIST)+path.sep)&&candidate!==path.resolve(DIST))return null;
  return candidate;
}

async function serveStatic(req,res,url){
  let file=safeStaticPath(url.pathname);
  if(!file)return false;

  try{
    let stat=await fsp.stat(file);
    if(stat.isDirectory()){
      file=path.join(file,'index.html');
      stat=await fsp.stat(file);
    }
    if(!stat.isFile())return false;
  }catch{
    // Para rotas da SPA principal, tenta index.html.
    if(!path.extname(url.pathname)){
      file=path.join(DIST,'index.html');
      try{
        const stat=await fsp.stat(file);
        if(!stat.isFile())return false;
      }catch{return false}
    }else return false;
  }

  const ext=path.extname(file).toLowerCase();
  res.statusCode=200;
  res.setHeader('Content-Type',MIME[ext]||'application/octet-stream');
  res.setHeader('Cache-Control',ext==='.html'?'no-cache':'public, max-age=3600');
  fs.createReadStream(file)
    .on('error',()=>{if(!res.headersSent)res.statusCode=500;res.end('Erro ao ler arquivo.')})
    .pipe(res);
  return true;
}

async function handleApi(req,res,url){
  const route=url.pathname.replace(/^\/api\/?/,'').replace(/^\/+|\/+$/g,'');

  req.query=Object.fromEntries(url.searchParams.entries());
  req.query.route=route;
  req.body=await parseBody(req);

  if(route==='viveiro/seconds'){
    return secondsHandler(req,res);
  }

  if(route==='viveiro/pulse'){
    return res.status(410).json({
      ok:false,
      error:'Esta rota não é usada no servidor contínuo.'
    });
  }

  return apiRouter(req,res);
}

const server=http.createServer(async(req,nativeRes)=>{
  const res=decorateResponse(nativeRes);
  try{
    const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);

    if(url.pathname==='/health'){
      return res.status(200).json({ok:true,service:'fazenda-2e-irrigacao',continuous:true});
    }

    if(url.pathname.startsWith('/api/')){
      return await handleApi(req,res,url);
    }

    if(await serveStatic(req,res,url))return;

    res.statusCode=404;
    res.end('Não encontrado.');
  }catch(error){
    console.error(error);
    if(!res.headersSent)res.statusCode=500;
    if(!res.writableEnded){
      res.setHeader('Content-Type','application/json; charset=utf-8');
      res.end(JSON.stringify({ok:false,error:error?.message||'Erro interno.'}));
    }
  }
});

const splitFirebaseDiag={
  hasClientEmail:Boolean(String(process.env.FIREBASE_CLIENT_EMAIL||process.env.GOOGLE_CLIENT_EMAIL||'').trim()),
  hasPrivateKey:Boolean(String(process.env.FIREBASE_PRIVATE_KEY||process.env.GOOGLE_PRIVATE_KEY||'').trim())
};
console.log('Firebase credential diagnostic',{
  mode:splitFirebaseDiag.hasClientEmail&&splitFirebaseDiag.hasPrivateKey?'split_variables':'json_or_unavailable',
  ...splitFirebaseDiag
});

async function runReadOnlyBootDiagnostics(){
  try{
    const controllers=await listInkbirdDevices();
    const rows=[];
    for(const ctrl of controllers.slice(0,4)){
      try{
        const status=await tuyaRequest('GET',`/v1.0/iot-03/devices/${ctrl.id}/status`);
        const map=Object.fromEntries((Array.isArray(status)?status:[]).map(x=>[x.code,x.value]));
        rows.push({
          name:ctrl.name,
          online:ctrl.online!==false,
          activeMask:Number(map.zonerun_state||0),
          pendingMask:Number(map.pendingzone_state||0),
          operationMode:map.operation_mode??null,
          irrigationMode:map.irrigation_mode??null,
          hasSchedule:typeof map.normal_time==='string'||map.normal_time!=null
        });
      }catch(error){
        rows.push({name:ctrl.name,online:ctrl.online!==false,error:error?.message||String(error)});
      }
    }
    const weather=await fetchWeatherSnapshot().catch(()=>null);
    console.log('INKBIRD read-only diagnostic',{
      controllerCount:controllers.length,
      controllers:rows,
      weatherLinked:Boolean(weather?.linked),
      weatherOnline:weather?.device?.online??null,
      rainDetected:Boolean(weather?.metrics?.rainDetected)
    });
  }catch(error){
    console.warn('INKBIRD read-only diagnostic unavailable:',error?.message||error);
  }
}

await initSecondsManager();
await runReadOnlyBootDiagnostics();

let weatherWatchTimer=null;
let weatherWatchBusy=false;
async function startViveiroWeatherWatch(){
  const tick=async()=>{
    if(weatherWatchBusy||shuttingDown)return;
    weatherWatchBusy=true;
    try{
      const cfg=await getViveiroWeatherConfig();
      if(cfg.enabled!==false)await runViveiroWeatherCheck();
    }catch(error){
      console.warn('viveiro weather watch:',error?.message||error);
    }finally{
      weatherWatchBusy=false;
    }
  };
  const cfg=await getViveiroWeatherConfig().catch(()=>({checkMinutes:5}));
  const intervalMs=Math.max(60000,Math.min(3600000,Number(cfg.checkMinutes||5)*60000));
  weatherWatchTimer=setInterval(tick,intervalMs);
  weatherWatchTimer.unref();
  setTimeout(tick,5000).unref();
}

await startViveiroWeatherWatch();

server.listen(PORT,'0.0.0.0',()=>{
  console.log(`Fazenda 2E online na porta ${PORT}`);
});

let shuttingDown=false;
async function shutdown(signal){
  if(shuttingDown)return;
  shuttingDown=true;
  if(weatherWatchTimer)clearInterval(weatherWatchTimer);
  console.log('Encerrando servidor:',signal);
  try{await suspendSecondsForRestart()}catch(error){console.error('Falha ao suspender modo rápido para reinício:',error)}
  server.close(()=>process.exit(0));
  setTimeout(()=>process.exit(1),12000).unref();
}

process.on('SIGTERM',()=>shutdown('SIGTERM'));
process.on('SIGINT',()=>shutdown('SIGINT'));
