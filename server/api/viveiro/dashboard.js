import { applyCors, authorize } from '../_tuya.js';
import { storeGet, storeSet } from '../irrigation/_store.js';
import { fetchWeatherSnapshot } from '../weather/_weather.js';
import { approveClimateSuggestion, getClimateConfig, getClimateState, rejectClimateSuggestion, setClimateConfig } from './_climate.js';
import { whatsappNotificationStatus } from '../irrigation/_notify.js';

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
function clock(minutes){
  const m=Math.max(0,Math.min(1440,Math.round(Number(minutes)||0)));
  return String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
}
function upcomingSchedule(cfg={},now=Date.now()){
  const mask=Math.max(0,Number(cfg.days_mask||0));
  const start=Math.max(0,Math.min(1439,Number(cfg.start_minutes||0)));
  const end=Math.max(1,Math.min(1440,Number(cfg.end_minutes||0)));
  const out=[];
  const nowDate=new Date(now);
  const tzParts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
    timeZone:'America/Porto_Velho',weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
  }).formatToParts(nowDate).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  const dayMap={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  const baseDay=dayMap[tzParts.weekday]??0;
  const nowSec=Number(tzParts.hour)*3600+Number(tzParts.minute)*60+Number(tzParts.second);

  for(let add=0;add<14&&out.length<7;add++){
    const dow=(baseDay+add)%7;
    if(!(mask&(1<<dow)))continue;
    const startSec=start*60;
    if(add===0&&nowSec>=end*60)continue;
    const label=add===0?'Hoje':add===1?'Amanhã':new Intl.DateTimeFormat('pt-BR',{weekday:'short'}).format(new Date(now+add*86400000));
    out.push({
      day_offset:add,
      weekday:dow,
      label,
      start:clock(start),
      end:clock(end),
      active_now:add===0&&nowSec>=startSec&&nowSec<end*60
    });
  }
  return out;
}
function irrigationSuggestion(weather={},cfg={}){
  const t=Number(weather?.metrics?.temperature?.value);
  const h=Number(weather?.metrics?.humidity?.value);
  const currentOn=Math.max(1,Number(cfg.on_seconds||30));
  const notes=[];
  let level='normal';
  if(Number.isFinite(t)&&Number.isFinite(h)){
    if(t>=32&&h<=45){
      level='attention';
      notes.push('Temperatura alta e umidade baixa. Vale conferir se as mudas estão secando mais rápido que o normal.');
    }else if(t>=30&&h<=55){
      level='attention';
      notes.push('Condição mais quente e seca. Observe a umidade dos saquinhos antes de aumentar o ciclo.');
    }else if(h>=85){
      notes.push('Umidade do ar alta. Evite aumentar o tempo apenas pela temperatura.');
    }else{
      notes.push('Condição climática sem indicação forte para alterar o ciclo neste momento.');
    }
  }else{
    notes.push('Sem temperatura/umidade suficientes para gerar uma sugestão climática.');
  }
  return{
    level,
    temperature:Number.isFinite(t)?t:null,
    humidity:Number.isFinite(h)?h:null,
    current_on_seconds:currentOn,
    note:notes.join(' '),
    automatic_change:false
  };
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
    today:{
      pulses:pulseRows.length,
      irrigated_seconds:irrigatedSeconds,
      rain_pauses:pauses,
      errors,
      last_pulse_at:lastPulse?.ts||null,
      first_pulse_at:(today.find(x=>x.type==='viveiro_pulse_start'&&x.first_of_window)||today.find(x=>x.type==='viveiro_pulse_start'))?.ts||null,
      start_delays:today.filter(x=>x.type==='viveiro_start_delay').length
    },
    week:days,
    week_totals:{
      pulses:days.reduce((s,x)=>s+Number(x.pulses||0),0),
      irrigated_seconds:days.reduce((s,x)=>s+Number(x.irrigated_seconds||0),0),
      rain_pauses:days.reduce((s,x)=>s+Number(x.rain_pauses||0),0),
      errors:days.reduce((s,x)=>s+Number(x.errors||0),0)
    }
  };
}

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(!authorize(req,res))return;

  try{
    if(req.method==='GET'){
      const [seconds,weatherState,weatherConfig,maintenance,historyRaw,config,weatherSnapshot,climateConfig,climateState]=await Promise.all([
        storeGet(ROOT+'/viveiroSecondsState').catch(()=>null),
        storeGet(ROOT+'/viveiroWeather/state').catch(()=>null),
        storeGet(ROOT+'/viveiroWeather/config').catch(()=>null),
        storeGet(ROOT+'/viveiroMaintenance').catch(()=>null),
        storeGet(ROOT+'/history').catch(()=>null),
        storeGet(ROOT+'/config').catch(()=>null),
        fetchWeatherSnapshot().catch(()=>null),
        getClimateConfig().catch(()=>null),
        getClimateState().catch(()=>null)
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
        fast_config:config?.profiles?.viveiroFast||null,
        upcoming:upcomingSchedule(seconds?.enabled?seconds:(config?.profiles?.viveiroFast||{}),now),
        current_weather:weatherSnapshot||null,
        suggestion:irrigationSuggestion(weatherSnapshot||{},seconds?.enabled?seconds:(config?.profiles?.viveiroFast||{})),
        climate:{
          config:climateConfig||{},
          state:climateState||{}
        },
        notifications:{
          whatsapp:whatsappNotificationStatus()
        }
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
      if(action==='climate_config'){
        const cfg=await setClimateConfig({
          automatic:Boolean(req.body?.automatic),
          observation:Boolean(req.body?.observation),
          enabled:req.body?.enabled!==false,
          trend_minutes:req.body?.trend_minutes,
          evaluation_minutes:req.body?.evaluation_minutes,
          max_adjust_percent:req.body?.max_adjust_percent,
          min_change_seconds:req.body?.min_change_seconds,
          min_change_off_seconds:req.body?.min_change_off_seconds,
          cooldown_minutes:req.body?.cooldown_minutes,
          normal_confirmations:req.body?.normal_confirmations,
          post_rain_hold_minutes:req.body?.post_rain_hold_minutes
        });
        return res.status(200).json({ok:true,climate_config:cfg});
      }
      if(action==='climate_apply'){
        const state=await approveClimateSuggestion(req.body?.id||'');
        return res.status(200).json({ok:true,climate_state:state});
      }
      if(action==='climate_reject'){
        const state=await rejectClimateSuggestion(req.body?.id||'');
        return res.status(200).json({ok:true,climate_state:state});
      }
      return res.status(400).json({ok:false,error:'Ação inválida.'});
    }

    return res.status(405).json({ok:false,error:'Método não permitido.'});
  }catch(error){
    return res.status(502).json({ok:false,error:error?.message||'Falha no painel do viveiro.'});
  }
}
