import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import apiRouter from '../../api/router.js';
import secondsHandler from './seconds-handler.js';
import { initSecondsManager, suspendSecondsForRestart } from './seconds-manager.js';
import { smartLifeConfigured, smartLifeListDevices } from '../api/_smartlife.js';
import { fetchWeatherSnapshot } from '../api/weather/_weather.js';
import { readInkbirdState } from '../api/inkbird/_transport.js';
import { decodeNormalTimer } from '../api/inkbird/_iic800.js';
import { runViveiroWeatherCheck, getViveiroWeatherConfig, getViveiroWeatherState } from '../api/viveiro/_weather_logic.js';
import { enforceViveiroInterlocks } from '../api/viveiro/_interlock.js';
import { authorize } from '../api/_tuya.js';
import { liveClientCount, publishLive, subscribeLive } from './live-bus.js';

const PORT=Math.max(1,Number(process.env.PORT||3000));
// Viveiro UI v11 final cleanup
// Viveiro consolidated UI v11 rollout
// Viveiro mobile polish v10 rollout
// Viveiro operational UI v9 rollout
// Viveiro clean UI v7 rollout
// UI cycle-alert freshness rollout v1
// Automatico 2.0 extreme-heat rollout v1
// Automatico 2.0 final rollout v1
// Publish marker: climate auto v8
// Publish marker: viveiro full intelligence v7
// Publish marker: alerts audit notifications v6
// Publish marker: auto-arm fast cycle on save
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

  if(route==='viveiro/live'){
    if(req.method!=='GET')return res.status(405).json({ok:false,error:'Método não permitido.'});
    if(!authorize(req,res))return;
    res.statusCode=200;
    res.setHeader('Content-Type','text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control','no-cache, no-transform');
    res.setHeader('Connection','keep-alive');
    res.setHeader('X-Accel-Buffering','no');
    req.socket?.setTimeout?.(0);
    req.socket?.setKeepAlive?.(true,10000);
    res.flushHeaders?.();

    const send=event=>{
      if(res.writableEnded)return;
      res.write('id: '+String(event.id||'')+'\n');
      res.write('event: '+String(event.type||'message')+'\n');
      res.write('data: '+JSON.stringify(event)+'\n\n');
    };
    const unsubscribe=subscribeLive(send,{replay:true});
    send({id:'hello-'+Date.now(),type:'heartbeat',at:Date.now(),payload:{status:'connected'}});
    const heartbeat=setInterval(()=>{
      if(!res.writableEnded)send({id:'hb-'+Date.now(),type:'heartbeat',at:Date.now(),payload:{status:'alive'}});
    },8000);
    heartbeat.unref?.();
    publishLive('connection',{status:'connected',clients:liveClientCount()});
    req.on('close',()=>{
      clearInterval(heartbeat);
      unsubscribe();
    });
    return;
  }

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
      return res.status(200).json({
        ok:true,
        service:'fazenda-2e-irrigacao',
        continuous:true,
        live_clients:liveClientCount(),
        at:Date.now()
      });
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
    if(!(await smartLifeConfigured())){
      console.warn('Smart Life não configurado; automação remota indisponível.');
      return;
    }
    const devices=await smartLifeListDevices({force:true,maxAgeMs:0});
    const weather=await fetchWeatherSnapshot({force:true}).catch(error=>({
      error:error?.message||String(error)
    }));
    const rows=devices.slice(0,8).map(device=>({
      name:device?.name||'Sem nome',
      online:device?.online!==false,
      category:device?.category||null,
      supportLocal:device?.support_local===true,
      statusKeys:Object.keys(device?.status||{}).slice(0,24)
    }));
    const iicDevice=devices.find(device=>/iic[- ]?800|inkbird/i.test(String(device?.name||'')));
    let iicSummary=null;
    if(iicDevice){
      const iic=await readInkbirdState({deviceId:iicDevice.id,force:true,maxAgeMs:0}).catch(error=>({error:error?.message||String(error)}));
      if(!iic?.error){
        const schedule=decodeNormalTimer(iic.statusMap?.normal_timer);
        iicSummary={
          provider:iic.provider,
          online:iic.online!==false,
          statusKeys:Object.keys(iic.statusMap||{}),
          activeMask:Number(iic.runtime?.active_mask||0),
          pendingMask:Number(iic.runtime?.pending_mask||0),
          irrigationMode:iic.statusMap?.irrigation_mode??null,
          dp45Available:Object.prototype.hasOwnProperty.call(iic.statusMap||{},'irrigation_time_all'),
          dp38Available:Object.prototype.hasOwnProperty.call(iic.statusMap||{},'normal_timer'),
          scheduleZones:(schedule?.channels||[]).map(ch=>Number(ch.zone)).filter(Boolean)
        };
      }else{
        iicSummary={error:iic.error};
      }
    }
    console.log('Smart Life read-only diagnostic',{
      deviceCount:devices.length,
      devices:rows,
      weatherLinked:Boolean(weather?.linked),
      weatherOnline:weather?.device?.online??null,
      weatherProvider:weather?.provider||null,
      weatherError:weather?.error||null,
      iic800:iicSummary
    });
  }catch(error){
    console.warn('Read-only irrigation diagnostic unavailable:',error?.message||error);
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
      if(cfg.enabled!==false){
        // Publica a leitura da estação assim que ela chega. A lógica de proteção
        // continua rodando depois e não segura temperatura/umidade na interface.
        const rawWeather=await fetchWeatherSnapshot({maxAgeMs:4000}).catch(error=>({
          ok:false,linked:false,error:error?.message||String(error)
        }));
        const previousState=await getViveiroWeatherState().catch(()=>({}));
        publishLive('weather',{
          state:previousState,
          config:cfg||{},
          weather:{
            ok:rawWeather?.ok!==false,
            linked:Boolean(rawWeather?.linked),
            checked_at:Number(rawWeather?.checked_at||Date.now()),
            provider:rawWeather?.provider||'smartlife',
            error:rawWeather?.error||null,
            device:{
              name:rawWeather?.device?.name||'Weather2-2',
              online:rawWeather?.device?.online!==false
            },
            metrics:{
              rainDetected:Boolean(rawWeather?.metrics?.rainDetected),
              rainGeneric:rawWeather?.metrics?.rainGeneric||rawWeather?.metrics?.rain24h||null,
              rain24h:rawWeather?.metrics?.rain24h||null,
              rainRate:rawWeather?.metrics?.rainRate||null,
              temperature:rawWeather?.metrics?.temperature||null,
              humidity:rawWeather?.metrics?.humidity||null,
              windSpeed:rawWeather?.metrics?.windSpeed||null,
              pressure:rawWeather?.metrics?.pressure||null
            }
          }
        });

        const result=await runViveiroWeatherCheck();
        publishLive('protection',{
          state:result?.state||{},
          config:result?.config||cfg||{},
          action:result?.action||'none',
          at:Date.now()
        });
      }
    }catch(error){
      console.warn('viveiro weather watch:',error?.message||error);
    }finally{
      weatherWatchBusy=false;
    }
  };
  const cfg=await getViveiroWeatherConfig().catch(()=>({checkMinutes:5}));
  // Com Smart Life, uma atualização traz os dispositivos em conjunto. Mantemos
  // a proteção nativa responsiva sem depender do antigo polling de vários minutos.
  const configuredMs=Math.max(4000,Number(cfg.checkMinutes||5)*60000);
  // A estação é atualizada no servidor a cada ~4 s. O app lê esse estado
  // já consolidado e evita criar várias chamadas concorrentes ao Smart Life.
  const intervalMs=Math.min(4000,configuredMs);
  weatherWatchTimer=setInterval(tick,intervalMs);
  weatherWatchTimer.unref();
  setTimeout(tick,5000).unref();
}

await startViveiroWeatherWatch();

let interlockTimer=null;
let interlockBusy=false;
async function startViveiroInterlockWatch(){
  const tick=async()=>{
    if(interlockBusy||shuttingDown)return;
    interlockBusy=true;
    try{
      await enforceViveiroInterlocks();
    }catch(error){
      console.warn('viveiro interlock watch:',error?.message||error);
    }finally{
      interlockBusy=false;
    }
  };
  interlockTimer=setInterval(tick,5000);
  interlockTimer.unref();
  setTimeout(tick,1200).unref();
}
await startViveiroInterlockWatch();

server.listen(PORT,'0.0.0.0',()=>{
  console.log(`Fazenda 2E online na porta ${PORT}`);
  publishLive('server',{online:true,at:Date.now()});
});

let shuttingDown=false;
async function shutdown(signal){
  if(shuttingDown)return;
  shuttingDown=true;
  if(weatherWatchTimer)clearInterval(weatherWatchTimer);
  if(interlockTimer)clearInterval(interlockTimer);
  console.log('Encerrando servidor:',signal);
  try{await suspendSecondsForRestart()}catch(error){console.error('Falha ao suspender modo rápido para reinício:',error)}
  server.close(()=>process.exit(0));
  setTimeout(()=>process.exit(1),12000).unref();
}

process.on('SIGTERM',()=>shutdown('SIGTERM'));
process.on('SIGINT',()=>shutdown('SIGINT'));
