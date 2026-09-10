import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const DIST=path.join(ROOT,'dist','painel');
const PORT=Number(process.env.PORT||8080);
const TOKEN=String(process.env.APP_CONTROL_TOKEN||'');
const VIVEIRO_URL=String(process.env.VIVEIRO_URL||'').replace(/\/$/,'');
const CAFE_URL=String(process.env.CAFE_URL||'').replace(/\/$/,'');

function json(res,status,body){
  const data=Buffer.from(JSON.stringify(body));
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':data.length,'cache-control':'no-store'});
  res.end(data);
}
function authorized(req){
  if(!TOKEN)return false;
  const raw=String(req.headers.authorization||'');
  const supplied=raw.startsWith('Bearer ')?raw.slice(7):'';
  const a=Buffer.from(supplied),b=Buffer.from(TOKEN);
  return a.length===b.length&&a.length>0&&timingSafeEqual(a,b);
}
async function remote(base,pathName){
  if(!base)return{ok:false,error:'Serviço não configurado.'};
  const ctl=new AbortController();
  const timer=setTimeout(()=>ctl.abort(),9000);
  try{
    const r=await fetch(base+pathName,{
      headers:{Authorization:'Bearer '+TOKEN,Accept:'application/json'},
      signal:ctl.signal
    });
    const body=await r.json().catch(()=>({}));
    if(!r.ok)return{ok:false,error:body?.error||('HTTP '+r.status),status:r.status};
    return body;
  }catch(error){
    return{ok:false,error:error?.name==='AbortError'?'Tempo limite excedido.':error?.message||String(error)};
  }finally{clearTimeout(timer)}
}
function rank(status){
  return status==='critical'?3:status==='warning'?2:status==='normal'||status==='ok'?1:0;
}
function normalizeStatus(status){
  const s=String(status||'').toLowerCase();
  if(['critical','error','offline','bad'].includes(s))return'critical';
  if(['warning','attention','degraded','checking'].includes(s))return'warning';
  if(['normal','ok','online','active'].includes(s))return'normal';
  return'warning';
}
function overallStatus(parts){
  let best='normal';
  for(const part of parts){
    const s=normalizeStatus(part);
    if(rank(s)>rank(best))best=s;
  }
  return best;
}
function viveiroSummary(d){
  if(!d?.ok)return{status:'critical',title:'Viveiro indisponível',detail:d?.error||'Sem resposta do serviço.',online:false};
  const reportStatus=normalizeStatus(d?.reports?.status_today||d?.intelligence?.health?.level);
  const op=d?.intelligence?.operation||{};
  const open=Number(d?.reports?.incidents?.totals?.open||0);
  return{
    status:reportStatus,
    title:op.label||'Viveiro',
    detail:op.detail||d?.intelligence?.health?.message||'Sem detalhe.',
    online:true,
    phase:d?.seconds?.phase||null,
    pulses_today:Number(d?.summary?.today?.pulses||0),
    irrigated_seconds:Number(d?.summary?.today?.irrigated_seconds||0),
    open_incidents:open,
    audit_checked_at:Number(d?.seconds?.operational_audit?.checked_at||d?.intelligence?.health?.audit?.checked_at||0)||null
  };
}
function cafeSummary(d){
  if(!d?.ok)return{status:'critical',title:'Café indisponível',detail:d?.error||'Sem resposta do serviço.',online:false};
  const reportStatus=normalizeStatus(d?.reports?.status_today||d?.audit?.status);
  const controller=d?.selected_controller||d?.controllers?.[0]||null;
  const mask=Number(d?.runtime?.active_mask||0)||Number(d?.runtime?.pending_mask||0);
  return{
    status:reportStatus,
    title:mask?'IRRIGANDO':'PRONTO',
    detail:controller?.online===false?'IIC-800 offline.':mask?'IIC-800 com irrigação em andamento.':'IIC-800 disponível.',
    online:controller?.online!==false,
    controller_name:controller?.name||'IIC-800-WIFI',
    sessions_today:Number(d?.summary?.today?.sessions||0),
    sectors_today:Number(d?.summary?.today?.sectors||0),
    completed_minutes:Number(d?.summary?.today?.completed_minutes||0),
    open_incidents:Number(d?.reports?.incidents?.totals?.open||0),
    next_schedule:d?.next_schedule||null,
    audit_checked_at:Number(d?.audit?.checked_at||0)||null
  };
}
function climateSummary(viveiro,cafe){
  const w=(viveiro?.current_weather?.linked?viveiro.current_weather:null)||
    (cafe?.weather?.linked?cafe.weather:null)||{};
  const m=w.metrics||{};
  const temp=Number(m?.temperature?.value);
  const humidity=Number(m?.humidity?.value);
  const rain=Number(m?.rainGeneric?.value??m?.rain24h?.value??m?.rainToday?.value);
  const linked=Boolean(w.linked&&w.device?.online!==false&&!w.error);
  return{
    status:linked?'normal':'critical',
    linked,
    temperature:Number.isFinite(temp)?temp:null,
    humidity:Number.isFinite(humidity)?humidity:null,
    rain_mm:Number.isFinite(rain)?rain:null,
    raining:Boolean(m?.rainDetected),
    checked_at:Number(w?.checked_at||0)||null,
    error:w?.error||null
  };
}

async function overview(){
  const [viveiro,cafe]=await Promise.all([
    remote(VIVEIRO_URL,'/api/viveiro/dashboard'),
    remote(CAFE_URL,'/api/cafe/dashboard')
  ]);
  const v=viveiroSummary(viveiro);
  const c=cafeSummary(cafe);
  const climate=climateSummary(viveiro,cafe);
  const alerts={
    total:Number(v.open_incidents||0)+Number(c.open_incidents||0),
    critical:Number(v.status==='critical'?1:0)+Number(c.status==='critical'?1:0)+Number(climate.status==='critical'?1:0)
  };
  const status=overallStatus([v.status,c.status,climate.status,alerts.critical?'critical':alerts.total?'warning':'normal']);
  return{
    ok:true,
    app:'painel-fazenda-2e',
    generated_at:Date.now(),
    status,
    viveiro:v,
    cafe:c,
    climate,
    alerts,
    sources:{
      viveiro_ok:Boolean(viveiro?.ok),
      cafe_ok:Boolean(cafe?.ok)
    }
  };
}

function mime(file){
  if(file.endsWith('.html'))return'text/html; charset=utf-8';
  if(file.endsWith('.css'))return'text/css; charset=utf-8';
  if(file.endsWith('.js'))return'text/javascript; charset=utf-8';
  if(file.endsWith('.webmanifest'))return'application/manifest+json; charset=utf-8';
  if(file.endsWith('.svg'))return'image/svg+xml';
  return'application/octet-stream';
}
async function staticFile(req,res){
  const url=new URL(req.url,'http://localhost');
  let rel=decodeURIComponent(url.pathname);
  if(rel==='/'||!path.extname(rel))rel='/index.html';
  const target=path.resolve(DIST,'.'+rel);
  if(!target.startsWith(DIST))return json(res,403,{ok:false,error:'Acesso negado.'});
  try{
    const data=await fs.readFile(target);
    res.writeHead(200,{'content-type':mime(target),'content-length':data.length,'cache-control':target.endsWith('index.html')?'no-cache':'public, max-age=300'});
    res.end(data);
  }catch{
    if(rel!=='/index.html'){
      try{
        const data=await fs.readFile(path.join(DIST,'index.html'));
        res.writeHead(200,{'content-type':'text/html; charset=utf-8','content-length':data.length,'cache-control':'no-cache'});
        res.end(data);return;
      }catch{}
    }
    json(res,404,{ok:false,error:'Não encontrado.'});
  }
}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/health')return json(res,200,{ok:true,service:'painel-fazenda-2e'});
    if(url.pathname==='/api/overview'){
      if(!authorized(req))return json(res,401,{ok:false,error:'Não autorizado.'});
      return json(res,200,await overview());
    }
    return staticFile(req,res);
  }catch(error){
    return json(res,500,{ok:false,error:error?.message||'Erro interno.'});
  }
});

server.listen(PORT,'0.0.0.0',()=>{
  console.log('Painel Fazenda 2E online na porta '+PORT);
  setTimeout(async()=>{
    try{
      const data=await overview();
      console.log('Painel startup diagnostic',{
        status:data.status,
        viveiro_ok:data.sources?.viveiro_ok===true,
        cafe_ok:data.sources?.cafe_ok===true,
        climate_linked:data.climate?.linked===true,
        alerts:Number(data.alerts?.total||0)
      });
    }catch(error){
      console.warn('Painel startup diagnostic falhou:',error?.message||error);
    }
  },2500).unref?.();
});
