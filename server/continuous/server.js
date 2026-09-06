import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import apiRouter from '../../api/router.js';
import secondsHandler from './seconds-handler.js';
import { disableSeconds, initSecondsManager } from './seconds-manager.js';

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

const firebaseRaw=String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON||'').trim();
let firebaseDiag={present:Boolean(firebaseRaw),jsonObject:false,hasClientEmail:false,hasPrivateKey:false};
if(firebaseRaw){
  try{
    const parsed=JSON.parse(firebaseRaw);
    firebaseDiag.jsonObject=Boolean(parsed&&typeof parsed==='object'&&!Array.isArray(parsed));
    firebaseDiag.hasClientEmail=Boolean(parsed&&String(parsed.client_email||'').trim());
    firebaseDiag.hasPrivateKey=Boolean(parsed&&String(parsed.private_key||'').trim());
  }catch{}
}
console.log('Firebase credential diagnostic',firebaseDiag);

await initSecondsManager();

server.listen(PORT,'0.0.0.0',()=>{
  console.log(`Fazenda 2E online na porta ${PORT}`);
});

let shuttingDown=false;
async function shutdown(signal){
  if(shuttingDown)return;
  shuttingDown=true;
  console.log('Encerrando servidor:',signal);
  try{await disableSeconds()}catch(error){console.error('Falha ao encerrar modo rápido:',error)}
  server.close(()=>process.exit(0));
  setTimeout(()=>process.exit(1),12000).unref();
}

process.on('SIGTERM',()=>shutdown('SIGTERM'));
process.on('SIGINT',()=>shutdown('SIGINT'));
