import { applyCors, authorize } from '../_tuya.js';
import { storeGet, storeSet } from '../irrigation/_store.js';

const ROOT='IrrigacaoFazenda2E';

function historyRows(raw){
  if(!raw||typeof raw!=='object')return[];
  return Object.entries(raw).map(([id,v])=>({id,...(v||{})}))
    .sort((a,b)=>Number(b.ts||0)-Number(a.ts||0));
}
function localDateKey(ts){
  return new Intl.DateTimeFormat('en-CA',{
    timeZone:'America/Porto_Velho',year:'numeric',month:'2-digit',day:'2-digit'
  }).format(new Date(Number(ts)||Date.now()));
}
function dayLabel(key){
  const [y,m,d]=String(key).split('-').map(Number);
  const dt=new Date(Date.UTC(y,m-1,d,12));
  return new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',weekday:'short',day:'2-digit'}).format(dt);
}
function summarize(history){
  const todayKey=localDateKey(Date.now());
  const today=history.filter(x=>localDateKey(x.ts||Date.parse(x.at||0))===todayKey);
  const pulseRows=today.filter(x=>x.type==='viveiro_pulse_complete');
  const irrigatedSeconds=pulseRows.reduce((s,x)=>s+Math.max(0,Number(x.duration_seconds||0)),0);
  const pauses=today.filter(x=>x.type==='viveiro_weather_pause').length;
  const errors=today.filter(x=>String(x.type||'').includes('error')).length;
  const lastPulse=history.find(x=>x.type==='viveiro_pulse_complete')||null;

  const days=[];
  for(let i=6;i>=0;i--){
    const dt=new Date(Date.now()-i*86400000);
    const key=localDateKey(dt.getTime());
    const rows=history.filter(x=>localDateKey(x.ts||Date.parse(x.at||0))===key);
    const pulses=rows.filter(x=>x.type==='viveiro_pulse_complete');
    days.push({
      key,label:dayLabel(key),
      pulses:pulses.length,
      irrigated_seconds:pulses.reduce((s,x)=>s+Math.max(0,Number(x.duration_seconds||0)),0),
      rain_pauses:rows.filter(x=>x.type==='viveiro_weather_pause').length,
      errors:rows.filter(x=>String(x.type||'').includes('error')).length
    });
  }
  return{
    today:{pulses:pulseRows.length,irrigated_seconds:irrigatedSeconds,rain_pauses:pauses,errors,last_pulse_at:lastPulse?.ts||null},
    week:days
  };
}

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(!authorize(req,res))return;

  try{
    if(req.method==='GET'){
      const [seconds,weatherState,weatherConfig,maintenance,historyRaw,config]=await Promise.all([
        storeGet(ROOT+'/viveiroSecondsState').catch(()=>null),
        storeGet(ROOT+'/viveiroWeather/state').catch(()=>null),
        storeGet(ROOT+'/viveiroWeather/config').catch(()=>null),
        storeGet(ROOT+'/viveiroMaintenance').catch(()=>null),
        storeGet(ROOT+'/history').catch(()=>null),
        storeGet(ROOT+'/config').catch(()=>null)
      ]);
      const history=historyRows(historyRaw).filter(x=>String(x.source||'').includes('viveiro')||String(x.type||'').startsWith('viveiro_')).slice(0,160);
      const now=Date.now();
      const todayKey=localDateKey(now);
      const auditToday=history.filter(x=>localDateKey(x.ts||Date.parse(x.at||0))===todayKey).slice(0,100);
      const maintenanceActive=Boolean(maintenance?.enabled&&Number(maintenance?.until||0)>now);
      return res.status(200).json({
        ok:true,
        server:{online:true,at:now},
        firebase:{online:true},
        seconds:seconds||{},
        weather:{state:weatherState||{},config:weatherConfig||{}},
        maintenance:{...(maintenance||{}),active:maintenanceActive},
        summary:summarize(history),
        history:history.slice(0,60),
        audit_today:auditToday,
        presets:config?.profiles?.viveiroPresets||{},
        fast_config:config?.profiles?.viveiroFast||null
      });
    }

    if(req.method==='POST'){
      const action=String(req.body?.action||'');
      if(action==='maintenance'){
        const minutes=Math.max(0,Math.min(1440,Math.round(Number(req.body?.minutes)||0)));
        const enabled=minutes>0;
        const payload={
          enabled,
          until:enabled?Date.now()+minutes*60000:0,
          minutes,
          reason:String(req.body?.reason||'Modo manutenção'),
          updated_at:Date.now()
        };
        await storeSet(ROOT+'/viveiroMaintenance',payload);
        return res.status(200).json({ok:true,maintenance:{...payload,active:enabled}});
      }
      return res.status(400).json({ok:false,error:'Ação inválida.'});
    }

    return res.status(405).json({ok:false,error:'Método não permitido.'});
  }catch(error){
    return res.status(502).json({ok:false,error:error?.message||'Falha no painel do viveiro.'});
  }
}
