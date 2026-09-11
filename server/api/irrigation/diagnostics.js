import os from 'node:os';
import { applyCors, authorize } from '../_tuya.js';
import { localHistoryStatus } from '../../local/history-store.js';
import { localMaintenanceStatus } from '../../local/maintenance.js';
import { storeGet } from './_store.js';

async function timed(name,fn){
  const started=Date.now();
  try{
    const value=await fn();
    return{name,ok:true,ms:Date.now()-started,value};
  }catch(error){
    return{name,ok:false,ms:Date.now()-started,error:error?.message||String(error)};
  }
}

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(!authorize(req,res))return;
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'Método não permitido.'});

  const [history,maintenance,firebase]=await Promise.all([
    timed('local_history',()=>localHistoryStatus()),
    timed('maintenance',()=>localMaintenanceStatus()),
    timed('firebase',()=>storeGet('IrrigacaoFazenda2E/alertMonitor'))
  ]);

  const alerts=[];
  if(!history.ok)alerts.push({level:'critical',key:'local-history',message:'Histórico local indisponível.'});
  if(history.ok&&!history.value?.rows)alerts.push({level:'warning',key:'local-history-empty',message:'Histórico local está vazio.'});
  if(history.ok&&history.value?.rows){
    const lastSync=Number(history.value?.sync?.last_success_at||0);
    if(!lastSync)alerts.push({level:'warning',key:'local-history-sync',message:'Sincronização do histórico local ainda não foi confirmada.'});
    else if(Date.now()-lastSync>2*60*1000)alerts.push({level:'warning',key:'local-history-sync-stale',message:'Sincronização do histórico local está atrasada.'});
  }
  if(!maintenance.ok)alerts.push({level:'critical',key:'maintenance',message:'Monitoramento local indisponível.'});
  if(maintenance.ok&&maintenance.value?.backups?.last_error)alerts.push({level:'warning',key:'backup-error',message:'O último backup apresentou erro.'});
  if(maintenance.ok&&Number(maintenance.value?.memory?.rss_mb||0)>1024)alerts.push({level:'warning',key:'memory',message:'Uso de memória do processo acima de 1 GB.'});
  if(!firebase.ok)alerts.push({level:'warning',key:'firebase',message:'Firebase não respondeu ao diagnóstico.'});

  const healthy=!alerts.some(item=>item.level==='critical');
  return res.status(healthy?200:503).json({
    ok:healthy,
    service:'fazenda-2e-irrigacao',
    checked_at:Date.now(),
    server:{
      hostname:os.hostname(),
      node:process.version,
      platform:process.platform,
      arch:process.arch,
      process_uptime_seconds:Math.round(process.uptime()),
      system_uptime_seconds:Math.round(os.uptime()),
      load_average:os.loadavg().map(value=>Number(value.toFixed(2))),
      memory:{total_mb:Math.round(os.totalmem()/1024/1024),free_mb:Math.round(os.freemem()/1024/1024)}
    },
    checks:{local_history:history,maintenance,firebase},
    alerts
  });
}
