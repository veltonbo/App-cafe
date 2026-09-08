import { applyCors, authorize } from '../_tuya.js';
import { storeGet, storeSet } from '../irrigation/_store.js';
import { approveClimateSuggestion, getClimateConfig, getClimateState, patchClimateState, rejectClimateSuggestion, setClimateConfig } from './_climate.js';
import { whatsappNotificationStatus } from '../irrigation/_notify.js';
import { createConfigBackup } from '../irrigation/_backup.js';
import { getViveiroSafety, getViveiroMaintenance, setMaintenanceInterlock } from './_interlock.js';

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

function localNowParts(now=Date.now()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
    timeZone:'America/Porto_Velho',weekday:'short',
    hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
  }).formatToParts(new Date(now)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  const dayMap={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  return{
    weekday:dayMap[parts.weekday]??0,
    seconds:Number(parts.hour||0)*3600+Number(parts.minute||0)*60+Number(parts.second||0)
  };
}
function irrigationIntensity(seconds={}){
  const baseOn=Math.max(1,Number(seconds.base_on_seconds||seconds.on_seconds||30));
  const baseOff=Math.max(1,Number(seconds.base_off_seconds||seconds.off_seconds||120));
  const on=Math.max(1,Number(seconds.on_seconds||baseOn));
  const off=Math.max(1,Number(seconds.off_seconds||baseOff));
  const baseDuty=baseOn/(baseOn+baseOff);
  const currentDuty=on/(on+off);
  const changePct=baseDuty>0?((currentDuty/baseDuty)-1)*100:0;
  let level='normal',label='Normal';
  if(changePct<-8){level='low';label='Baixa';}
  else if(changePct<=8){level='normal';label='Normal';}
  else if(changePct<=40){level='high';label='Alta';}
  else{level='very_high';label='Muito alta';}
  return{
    level,label,
    change_percent:Number(changePct.toFixed(1)),
    base_duty:Number((baseDuty*100).toFixed(1)),
    current_duty:Number((currentDuty*100).toFixed(1))
  };
}
function baseExpectedToday(seconds={},now=Date.now()){
  if(seconds?.enabled===false)return{elapsed_window_seconds:0,expected_irrigated_seconds:0};
  const start=Math.max(0,Math.min(1439,Number(seconds.start_minutes||0)));
  const end=Math.max(start+1,Math.min(1440,Number(seconds.end_minutes||1440)));
  const mask=Math.max(0,Number(seconds.days_mask??127));
  const local=localNowParts(now);
  if(!(mask&(1<<local.weekday)))return{elapsed_window_seconds:0,expected_irrigated_seconds:0};
  const startSec=start*60,endSec=end*60;
  const elapsed=Math.max(0,Math.min(local.seconds,endSec)-startSec);
  const baseOn=Math.max(1,Number(seconds.base_on_seconds||seconds.on_seconds||30));
  const baseOff=Math.max(1,Number(seconds.base_off_seconds||seconds.off_seconds||120));
  const duty=baseOn/(baseOn+baseOff);
  return{
    elapsed_window_seconds:elapsed,
    expected_irrigated_seconds:Math.round(elapsed*duty),
    base_duty:Number((duty*100).toFixed(1))
  };
}
function decisionTimeline(history=[]){
  const relevant=new Set([
    'viveiro_climate_auto_change','viveiro_climate_return_base','viveiro_climate_applied',
    'viveiro_climate_observation','viveiro_climate_condition',
    'viveiro_weather_pause','viveiro_weather_resume','viveiro_weather_blocked',
    'viveiro_emergency_stop','viveiro_emergency_clear',
    'viveiro_cycle_start','viveiro_cycle_stop','viveiro_start_delay'
  ]);
  return history.filter(row=>
    relevant.has(String(row.type||''))||
    String(row.type||'').includes('error')
  ).slice(0,30).map(row=>{
    const type=String(row.type||'');
    let kind='info',title='Evento';
    if(type==='viveiro_climate_auto_change'){kind='climate';title='Automático 2.0 ajustou o ciclo';}
    else if(type==='viveiro_climate_return_base'){kind='climate';title='Ciclo voltou ao padrão';}
    else if(type==='viveiro_climate_applied'){kind='climate';title='Ajuste climático aplicado';}
    else if(type==='viveiro_climate_observation'){kind='climate';title='Mudança climática observada';}
    else if(type==='viveiro_climate_condition'){kind='climate';title='Condição climática mudou';}
    else if(type.includes('weather')){kind='weather';title=type.includes('resume')?'Irrigação liberada após chuva':'Proteção por chuva atuou';}
    else if(type.includes('emergency')){kind='critical';title=type.includes('clear')?'Emergência liberada':'Parada de emergência';}
    else if(type.includes('error')){kind='critical';title='Falha detectada';}
    else if(type==='viveiro_cycle_start'){kind='cycle';title='Ciclo iniciado';}
    else if(type==='viveiro_cycle_stop'){kind='cycle';title='Ciclo parado';}
    else if(type==='viveiro_start_delay'){kind='warning';title='Início atrasado';}
    return{
      id:row.id,ts:Number(row.ts||0),type,kind,title,
      detail:String(row.detail||row.reason||''),
      from_on:Number(row.from_seconds||0)||null,
      from_off:Number(row.from_off_seconds||0)||null,
      to_on:Number(row.to_seconds||0)||null,
      to_off:Number(row.to_off_seconds||0)||null,
      temperature:Number.isFinite(Number(row.temperature))?Number(row.temperature):null,
      humidity:Number.isFinite(Number(row.humidity))?Number(row.humidity):null,
      vpd:Number.isFinite(Number(row.vpd))?Number(row.vpd):null
    };
  });
}
function buildHealth({seconds={},weatherSnapshot={},climateState={},maintenance={},safety={},history=[],now=Date.now()}={}){
  const issues=[];
  const emergency=Boolean(safety?.emergency_latched||safety?.latched||String(seconds?.phase||'').includes('emergency'));
  if(emergency)issues.push({level:'critical',code:'emergency',message:'Parada de emergência ativa.'});
  if(maintenance?.active)issues.push({level:'warning',code:'maintenance',message:'Modo manutenção ativo.'});

  const weatherAt=Number(weatherSnapshot?.checked_at||climateState?.last_evaluated_at||0);
  if(!weatherSnapshot?.linked||weatherSnapshot?.error){
    issues.push({level:'critical',code:'weather_offline',message:'Weather2-2 sem comunicação.'});
  }else if(weatherAt&&now-weatherAt>15*60000){
    issues.push({level:'warning',code:'weather_stale',message:'Weather2-2 sem atualização recente.'});
  }

  const stateAt=Number(seconds?.state_updated_at||seconds?.checked_at||0);
  if(seconds?.enabled&&stateAt&&now-stateAt>5*60000){
    issues.push({level:'warning',code:'cycle_stale',message:'Estado do ciclo sem atualização recente.'});
  }

  const recentErrors=history.filter(row=>
    String(row.type||'').includes('error')&&now-Number(row.ts||0)<30*60000
  );
  if(recentErrors.length)issues.push({
    level:'critical',code:'recent_error',
    message:recentErrors.length===1?'Uma falha foi registrada nos últimos 30 min.':recentErrors.length+' falhas foram registradas nos últimos 30 min.'
  });

  const critical=issues.some(x=>x.level==='critical');
  return{
    level:critical?'critical':issues.length?'warning':'ok',
    message:critical
      ?issues.find(x=>x.level==='critical')?.message
      :issues.length
        ?issues[0].message
        :'Tudo funcionando normalmente.',
    issues,
    services:{
      railway:'online',
      firebase:'online',
      weather:weatherSnapshot?.linked&&!weatherSnapshot?.error?'online':'offline',
      cycle:seconds?.enabled?'active':'stopped'
    }
  };
}
function summarize(history,seconds={},now=Date.now()){
  const todayKey=localDateKey(now);
  const today=history.filter(x=>localDateKey(x.ts||Date.parse(x.at||0))===todayKey);
  const pulseRows=today.filter(x=>x.type==='viveiro_pulse_complete');
  const irrigatedSeconds=pulseRows.reduce((s,x)=>s+Math.max(0,Number(x.duration_seconds||0)),0);
  const pauses=today.filter(x=>x.type==='viveiro_weather_pause').length;
  const errors=today.filter(x=>String(x.type||'').includes('error')).length;
  const lastPulse=history.find(x=>x.type==='viveiro_pulse_complete')||null;

  const days=[];
  for(let i=6;i>=0;i--){
    const dt=new Date(now-i*86400000);
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
  const baseline=baseExpectedToday(seconds,now);
  const baselineSeconds=Number(baseline.expected_irrigated_seconds||0);
  const versusBasePct=baselineSeconds>0?((irrigatedSeconds/baselineSeconds)-1)*100:null;
  return{
    today:{
      pulses:pulseRows.length,
      irrigated_seconds:irrigatedSeconds,
      rain_pauses:pauses,
      errors,
      last_pulse_at:lastPulse?.ts||null,
      first_pulse_at:(today.find(x=>x.type==='viveiro_pulse_start'&&x.first_of_window)||today.find(x=>x.type==='viveiro_pulse_start'))?.ts||null,
      start_delays:today.filter(x=>x.type==='viveiro_start_delay').length,
      base_expected_irrigated_seconds:baselineSeconds,
      elapsed_window_seconds:Number(baseline.elapsed_window_seconds||0),
      versus_base_percent:versusBasePct==null?null:Number(versusBasePct.toFixed(1))
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
      const [seconds,weatherState,weatherConfig,maintenance,historyRaw,config,climateConfig,climateState,safety]=await Promise.all([
        storeGet(ROOT+'/viveiroSecondsState').catch(()=>null),
        storeGet(ROOT+'/viveiroWeather/state').catch(()=>null),
        storeGet(ROOT+'/viveiroWeather/config').catch(()=>null),
        getViveiroMaintenance().catch(()=>null),
        storeGet(ROOT+'/history').catch(()=>null),
        storeGet(ROOT+'/config').catch(()=>null),
        getClimateConfig().catch(()=>null),
        getClimateState().catch(()=>null),
        getViveiroSafety().catch(()=>null)
      ]);
      const weatherError=String(weatherState?.lastWeatherError||'');
      const lastTemp=Number(climateState?.last_temperature);
      const lastHum=Number(climateState?.last_humidity);
      const weatherSnapshot={
        ok:!weatherError,
        linked:!weatherError,
        cached:true,
        checked_at:Number(weatherState?.lastCheckedAt||climateState?.last_evaluated_at||0)||null,
        error:weatherError||null,
        metrics:{
          rainDetected:Boolean(weatherState?.rainDetected),
          rainGeneric:Number.isFinite(Number(weatherState?.rainAmountMm))?{value:Number(weatherState.rainAmountMm),unit:'mm'}:null,
          temperature:Number.isFinite(lastTemp)?{value:lastTemp,unit:'°C'}:null,
          humidity:Number.isFinite(lastHum)?{value:lastHum,unit:'%'}:null
        }
      };
      const history=historyRows(historyRaw).filter(x=>String(x.source||'').includes('viveiro')||String(x.type||'').startsWith('viveiro_')).slice(0,160);
      const now=Date.now();
      const todayKey=localDateKey(now);
      const auditToday=history.filter(x=>localDateKey(x.ts||Date.parse(x.at||0))===todayKey).slice(0,100);
      const maintenanceActive=Boolean(maintenance?.active||(
        maintenance?.enabled&&Number(maintenance?.until||0)>now
      ));
      const activeSeconds=seconds?.enabled?seconds:(config?.profiles?.viveiroFast||{});
      const summary=summarize(history,activeSeconds,now);
      const decisions=decisionTimeline(history);
      const intensity=irrigationIntensity(activeSeconds);
      const nextEvaluationAt=Number(climateState?.last_evaluated_at||0)
        +Math.max(5,Number(climateConfig?.evaluation_minutes||5))*60000;
      const health=buildHealth({
        seconds:activeSeconds,
        weatherSnapshot,
        climateState:climateState||{},
        maintenance:{...(maintenance||{}),active:maintenanceActive},
        safety:safety||{},
        history,
        now
      });
      return res.status(200).json({
        ok:true,
        server:{online:true,at:now},
        firebase:{online:true},
        seconds:seconds||{},
        weather:{state:weatherState||{},config:weatherConfig||{}},
        maintenance:{...(maintenance||{}),active:maintenanceActive},
        safety:safety||{},
        summary,
        history:history.slice(0,60),
        audit_today:auditToday,
        presets:config?.profiles?.viveiroPresets||{},
        fast_config:config?.profiles?.viveiroFast||null,
        upcoming:upcomingSchedule(activeSeconds,now),
        intelligence:{
          intensity,
          next_evaluation_at:nextEvaluationAt>now?nextEvaluationAt:now,
          decisions,
          health
        },
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
        const payload=await setMaintenanceInterlock(
          minutes,
          String(req.body?.reason||'Modo manutenção')
        );
        return res.status(200).json({ok:true,maintenance:payload});
      }
      if(action==='climate_config'){
        await createConfigBackup('antes_de_alterar_automatico_2').catch(()=>null);
        const previous=await getClimateConfig().catch(()=>({}));
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
        const modeChanged=
          Boolean(previous?.automatic)!==Boolean(cfg.automatic)||
          Boolean(previous?.observation)!==Boolean(cfg.observation)||
          Boolean(previous?.enabled)!==Boolean(cfg.enabled);
        if(modeChanged){
          await patchClimateState({
            pending:null,
            approved_id:null,
            rejected_id:null,
            mode_changed_at:Date.now(),
            last_decision:'mode_changed',
            last_decision_at:Date.now(),
            last_reason:'Modo do Automático 2.0 alterado. Sugestões antigas foram descartadas.'
          }).catch(()=>null);
        }
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
