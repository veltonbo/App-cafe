import os from 'node:os';
import { applyCors, authorize } from '../_tuya.js';
import { localHistoryStatus } from '../../local/history-store.js';
import { localMaintenanceStatus } from '../../local/maintenance.js';
import { storeGet } from './_store.js';
import { smartLifeListDevices } from '../_smartlife.js';
import { fetchWeatherSnapshot } from '../weather/_weather.js';
import { telegramNotificationStatus } from './_telegram.js';
import { getSecondsManagerState } from '../../continuous/seconds-manager.js';

async function timed(name,fn){
  const started=Date.now();
  try{return{name,ok:true,ms:Date.now()-started,value:await fn()};}
  catch(error){return{name,ok:false,ms:Date.now()-started,error:error?.message||String(error)};}
}
function state(ok,label,detail,ms=null){return{ok:Boolean(ok),label,detail,ms};}

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(!authorize(req,res))return;
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'Método não permitido.'});

  const [history,maintenance,firebase,smartlife,weather,telegram,seconds]=await Promise.all([
    timed('local_history',()=>localHistoryStatus()),
    timed('maintenance',()=>localMaintenanceStatus()),
    timed('firebase',()=>storeGet('IrrigacaoFazenda2E/alertMonitor')),
    timed('smartlife',()=>smartLifeListDevices({maxAgeMs:0})),
    timed('weather',()=>fetchWeatherSnapshot({maxAgeMs:0})),
    timed('telegram',()=>telegramNotificationStatus()),
    timed('controller',()=>getSecondsManagerState())
  ]);

  const devices=smartlife.ok&&Array.isArray(smartlife.value)?smartlife.value:[];
  const ekaza=devices.find(d=>/viveiro 2e/i.test(String(d?.name||'')))||devices.find(d=>/viveiro/i.test(String(d?.name||'')));
  const wd=seconds.value?.watchdog||{};
  const backup=maintenance.value?.backups?.validation||{};
  const guidedChecks={
    oracle:state(true,'Oracle Cloud','Servidor respondendo e processo ativo.'),
    firebase:state(firebase.ok,'Firebase',firebase.ok?'Leitura autenticada concluída.':firebase.error||'Sem resposta.',firebase.ms),
    history:state(history.ok&&Number(history.value?.rows||0)>0,'Histórico',history.ok?`${Number(history.value?.rows||0)} registros locais; sincronização ${history.value?.sync?.status||'desconhecida'}.`:history.error||'Indisponível.',history.ms),
    ekaza:state(Boolean(ekaza&&ekaza.online!==false),'EKAZA',ekaza?`${ekaza.name||'Viveiro'} ${ekaza.online===false?'offline':'online'}.`:'Dispositivo do viveiro não encontrado.',smartlife.ms),
    weather:state(Boolean(weather.ok&&weather.value?.linked&&weather.value?.device?.online!==false),'Weather2-2',weather.ok?(weather.value?.error||`Leitura confirmada há ${Math.round((Date.now()-Number(weather.value?.checked_at||Date.now()))/1000)} s.`):weather.error||'Indisponível.',weather.ms),
    smartlife:state(Boolean(smartlife.ok&&devices.length),'Smart Life',smartlife.ok?`${devices.length} dispositivo(s) acessível(is).`:smartlife.error||'Indisponível.',smartlife.ms),
    telegram:state(Boolean(telegram.ok&&telegram.value?.configured!==false),'Telegram',telegram.ok?(telegram.value?.configured===false?'Não configurado.':'Integração disponível.'):telegram.error||'Indisponível.',telegram.ms),
    watchdog:state(Boolean(seconds.ok&&!['critical','failed','error'].includes(String(wd.status||'').toLowerCase())),'Watchdog',seconds.ok?`Estado: ${wd.status||seconds.value?.watchdog_status||'sem alerta'}.`:seconds.error||'Indisponível.',seconds.ms),
    backup:state(Boolean(backup.ok&&backup.restorable),'Backup',backup.ok&&backup.restorable?'Último backup validado e restaurável.':backup.error||'Backup precisa atenção.',maintenance.ms)
  };

  const alerts=[];
  for(const [key,item] of Object.entries(guidedChecks))if(!item.ok)alerts.push({level:['firebase','history','backup','telegram'].includes(key)?'warning':'critical',key,message:item.detail});
  const mem=maintenance.value?.memory||{};
  const trend=maintenance.value?.memory_trend||{};
  const rss=Number(mem.rss_mb||0);
  const windowMinutes=Number(trend.window_minutes||0);
  const rate=Number(trend.rss_per_minute||0);
  if(rss>1536)alerts.push({level:'warning',key:'memory',message:`Memória do processo em ${rss} MB; heap ${Number(mem.heap_used_mb||0)} MB.`});
  if(windowMinutes>=3&&rate>=20)alerts.push({level:'warning',key:'memory-growth',message:`Memória crescendo ${rate.toFixed(1)} MB/min.`});
  const critical=alerts.some(x=>x.level==='critical');
  return res.status(critical?503:200).json({
    ok:!critical,service:'fazenda-2e-irrigacao',checked_at:Date.now(),
    server:{hostname:os.hostname(),node:process.version,platform:process.platform,arch:process.arch,process_uptime_seconds:Math.round(process.uptime()),system_uptime_seconds:Math.round(os.uptime()),load_average:os.loadavg().map(v=>Number(v.toFixed(2))),memory:{total_mb:Math.round(os.totalmem()/1024/1024),free_mb:Math.round(os.freemem()/1024/1024),process_rss_mb:Number(mem.rss_mb||0)}},
    checks:{local_history:history,maintenance,firebase},
    guided_checks:guidedChecks,alerts,
    raw:{local_history:history,maintenance,firebase,smartlife,weather,telegram,controller:seconds}
  });
}
