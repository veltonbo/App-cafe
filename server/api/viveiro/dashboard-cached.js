import dashboardHandler from './dashboard.js';
import { authorize } from '../_tuya.js';

const FRESH_MS=Math.max(1000,Number(process.env.VIVEIRO_DASHBOARD_CACHE_MS||5000));
const STALE_MS=Math.max(FRESH_MS,Number(process.env.VIVEIRO_DASHBOARD_STALE_MS||120000));

let cachedBody=null;
let cachedAt=0;
let refreshPromise=null;
let lastRefreshErrorAt=0;

function captureResponse(onDone){
  let statusCode=200;
  const headers={};
  return{
    setHeader(name,value){headers[String(name).toLowerCase()]=value;},
    getHeader(name){return headers[String(name).toLowerCase()];},
    status(code){statusCode=Number(code)||200;return this;},
    json(body){onDone(statusCode,body);return body;},
    end(body){onDone(statusCode,body);return body;}
  };
}

function makeShadowRequest(req){
  return{
    method:'GET',
    headers:{...(req?.headers||{})},
    query:{...(req?.query||{})},
    body:{},
    url:req?.url||'/api/viveiro/dashboard',
    socket:req?.socket||null,
    connection:req?.connection||null
  };
}

function refreshInBackground(req){
  if(refreshPromise)return refreshPromise;
  refreshPromise=new Promise((resolve,reject)=>{
    const shadowReq=makeShadowRequest(req);
    const shadowRes=captureResponse((status,body)=>{
      if(status>=200&&status<300&&body&&typeof body==='object'){
        cachedBody=body;
        cachedAt=Date.now();
        resolve(body);
      }else{
        reject(new Error('dashboard refresh HTTP '+status));
      }
    });
    Promise.resolve(dashboardHandler(shadowReq,shadowRes)).catch(reject);
  }).catch(error=>{
    // Evita spam de log e tempestade de refresh quando uma dependência está lenta.
    const now=Date.now();
    if(now-lastRefreshErrorAt>30000){
      lastRefreshErrorAt=now;
      console.warn('dashboard background refresh:',error?.message||error);
    }
    throw error;
  }).finally(()=>{refreshPromise=null;});
  return refreshPromise;
}

function responseAdapter(res){
  let statusCode=200;
  return{
    setHeader(name,value){res.setHeader?.(name,value);},
    getHeader(name){return res.getHeader?.(name);},
    status(code){statusCode=Number(code)||200;return this;},
    json(body){
      if(statusCode>=200&&statusCode<300&&body&&typeof body==='object'){
        cachedBody=body;
        cachedAt=Date.now();
      }
      return res.status(statusCode).json(body);
    },
    end(body){return res.status(statusCode).end(body);}
  };
}

export function invalidateDashboardCache(){cachedAt=0;}

export default async function cachedDashboard(req,res){
  if(!authorize(req,res))return;

  if(req.method!=='GET'){
    invalidateDashboardCache();
    return dashboardHandler(req,res);
  }

  const age=Date.now()-cachedAt;
  if(cachedBody&&age<FRESH_MS){
    res.setHeader?.('X-Fazenda2E-Cache','HIT');
    return res.status(200).json(cachedBody);
  }

  if(cachedBody&&age<STALE_MS){
    res.setHeader?.('X-Fazenda2E-Cache','STALE');
    refreshInBackground(req).catch(()=>null);
    return res.status(200).json(cachedBody);
  }

  res.setHeader?.('X-Fazenda2E-Cache','MISS');
  return dashboardHandler(req,responseAdapter(res));
}
