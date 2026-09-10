import { applyCors, authorize } from '../_tuya.js';
import { storeGet, storeSet } from '../irrigation/_store.js';
import { approveClimateSuggestion, getClimateConfig, getClimateState, patchClimateState, rejectClimateSuggestion, setClimateConfig } from './_climate.js';
import { whatsappNotificationStatus } from '../irrigation/_notify.js';
import { createConfigBackup } from '../irrigation/_backup.js';
import { getViveiroSafety, getViveiroMaintenance, setMaintenanceInterlock } from './_interlock.js';
import { pulseAccountingForDay } from '../../continuous/accounting.js';

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
function cycleExplanation(seconds={},climateState={}){
  const baseOn=Math.max(1,Number(seconds.base_on_seconds||seconds.on_seconds||30));
  const baseOff=Math.max(1,Number(seconds.base_off_seconds||seconds.off_seconds||120));
  const on=Math.max(1,Number(seconds.on_seconds||baseOn));
  const off=Math.max(1,Number(seconds.off_seconds||baseOff));
  const outside=String(climateState?.last_decision||'')==='outside_schedule';
  if(outside)return{
    title:'Ciclo-base preservado fora do horário',
    detail:'Base '+baseOn+'/'+baseOff+' s. O Automático 2.0 só poderá alterar o ciclo quando a janela de irrigação começar.',
    changed:false
  };
  if(on===baseOn&&off===baseOff)return{
    title:'Usando o ciclo-base',
    detail:'O clima não exige alteração confirmada neste momento.',
    changed:false
  };
  if(off<baseOff)return{
    title:'Irrigação aumentada pelo clima',
    detail:'Intervalo reduzido de '+baseOff+' s para '+off+' s. '+String(climateState?.last_reason||'Automático 2.0 ajustou o ciclo.'),
    changed:true
  };
  if(off>baseOff)return{
    title:'Irrigação reduzida pelo clima',
    detail:'Intervalo ampliado de '+baseOff+' s para '+off+' s. '+String(climateState?.last_reason||'Automático 2.0 ajustou o ciclo.'),
    changed:true
  };
  return{
    title:'Ciclo ajustado',
    detail:'Ciclo-base '+baseOn+'/'+baseOff+' s → atual '+on+'/'+off+' s.',
    changed:true
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

function scheduleRuntime(seconds={},now=Date.now()){
  const local=localNowParts(now);
  const start=Math.max(0,Math.min(1439,Number(seconds.start_minutes||0)))*60;
  const end=Math.max(1,Math.min(1440,Number(seconds.end_minutes||1440)))*60;
  const mask=Math.max(0,Number(seconds.days_mask??127));
  const selected=Boolean(mask&(1<<local.weekday));
  return{
    selected,
    inside:selected&&local.seconds>=start&&local.seconds<end,
    before:selected&&local.seconds<start,
    after:selected&&local.seconds>=end,
    start_seconds:start,
    end_seconds:end,
    now_seconds:local.seconds
  };
}
function operationalState({seconds={},weatherSnapshot={},climateState={},maintenance={},safety={},now=Date.now()}={}){
  const schedule=scheduleRuntime(seconds,now);
  const phase=String(seconds.phase||'');
  const emergency=Boolean(safety?.emergency_latched||safety?.latched||phase.includes('emergency'));
  const raining=Boolean(weatherSnapshot?.metrics?.rainDetected);
  const enabled=Boolean(seconds?.enabled);
  let code='stopped',label='PARADO',detail='Programação desativada.',tone='neutral';
  let nextAt=null,nextLabel='';

  if(emergency){
    code='emergency';label='EMERGÊNCIA';detail='Irrigação bloqueada até liberação manual.';tone='critical';
  }else if(maintenance?.active){
    code='maintenance';label='MANUTENÇÃO';detail='Automação temporariamente suspensa.';tone='warning';
    nextAt=Number(maintenance.until||0)||null;nextLabel=nextAt?'Fim da manutenção':'';
  }else if(!enabled){
    code='stopped';label='PARADO';detail='A programação não está armada.';tone='neutral';
  }else if(!weatherSnapshot?.linked||weatherSnapshot?.error||phase==='weather_unavailable'){
    code='weather_unavailable';label='PROTEGIDO';detail='Weather2-2 sem dados. Irrigação mantida desligada.';tone='warning';
  }else if(raining||phase==='weather_blocked'){
    code='rain';label='PAUSADO PELA CHUVA';detail='A proteção climática está impedindo a irrigação.';tone='weather';
  }else if(phase==='waiting_after_rain'){
    code='post_rain';label='AGUARDANDO APÓS CHUVA';detail='O sistema espera o tempo de segurança antes de retomar.';tone='weather';
    const last=Number(seconds.rain_last_at||0),delay=Number(seconds.resume_delay_minutes||0)*60000;
    nextAt=last&&delay?last+delay:null;nextLabel=nextAt?'Pode retomar':'';
  }else if(!schedule.inside||phase==='waiting_window'){
    code='waiting_schedule';label='AGUARDANDO HORÁRIO';detail='Automático 2.0 não altera o ciclo fora da janela.';tone='neutral';
    nextAt=Number(seconds.next_window_at||climateState?.next_schedule_window_at||0)||null;
    nextLabel=nextAt?'Próximo início':'';
  }else if(phase==='on'){
    code='irrigating';label='IRRIGANDO';detail='Saída do viveiro ligada.';tone='active';
    nextAt=Number(seconds.expected_off_at||0)||null;nextLabel=nextAt?'Desliga':'';
  }else if(phase==='off'){
    code='interval';label='INTERVALO';detail='Aguardando o próximo pulso.';tone='active';
    nextAt=Number(seconds.expected_next_on_at||0)||null;nextLabel=nextAt?'Liga novamente':'';
  }else{
    code='starting';label='PREPARANDO';detail='Automação dentro da janela e preparando o próximo pulso.';tone='active';
  }

  return{
    code,label,detail,tone,phase,
    inside_schedule:schedule.inside,
    next_event_at:nextAt,
    next_event_label:nextLabel
  };
}
function detectAnomalies({seconds={},climateState={},weatherSnapshot={},maintenance={},safety={},history=[],now=Date.now()}={}){
  const issues=[];
  const op=operationalState({seconds,climateState,weatherSnapshot,maintenance,safety,now});
  const phase=String(seconds.phase||'');
  if(op.code==='irrigating'){
    const due=Number(seconds.expected_off_at||0);
    if(due&&now>due+20000)issues.push({
      level:'critical',code:'pulse_overdue',
      message:'Pulso ligado além do horário esperado.'
    });
  }
  if(op.code==='interval'){
    const due=Number(seconds.expected_next_on_at||0);
    if(due&&now>due+20000)issues.push({
      level:'critical',code:'next_pulse_overdue',
      message:'Próximo pulso não iniciou no tempo esperado.'
    });
  }

  const protectedPhase=['weather_blocked','weather_unavailable','waiting_after_rain','maintenance','waiting_window'];
  if(seconds?.enabled&&op.inside_schedule&&!protectedPhase.includes(phase)){
    const cycleSeconds=Math.max(2,Number(seconds.on_seconds||30)+Number(seconds.off_seconds||120));
    const lastPulse=history.find(x=>String(x.type||'')==='viveiro_pulse_complete');
    const firstWindow=Number(seconds.first_pulse_window_at||0);
    const reference=Math.max(Number(lastPulse?.ts||0),firstWindow);
    if(reference&&now-reference>(cycleSeconds*2+45)*1000){
      issues.push({
        level:'warning',code:'long_pulse_gap',
        message:'Tempo sem pulso maior que o esperado para o ciclo atual.'
      });
    }
  }

  const recentFailures=history.filter(row=>{
    const type=String(row.type||'');
    return now-Number(row.ts||0)<30*60000&&
      ['viveiro_error','viveiro_start_failure','viveiro_start_delay'].includes(type);
  });
  if(recentFailures.length>=2)issues.push({
    level:'critical',code:'repeated_failures',
    message:'Falhas repetidas de irrigação nos últimos 30 minutos.'
  });

  if(op.inside_schedule&&String(climateState?.last_mode||'')==='automatic'){
    const evalAt=Number(climateState?.last_evaluated_at||0);
    if(evalAt&&now-evalAt>20*60000)issues.push({
      level:'warning',code:'climate_evaluation_stale',
      message:'Automático 2.0 está há mais de 20 min sem nova avaliação.'
    });
  }
  return issues;
}
function buildHealth({seconds={},weatherSnapshot={},climateState={},maintenance={},safety={},history=[],now=Date.now()}={}){
  const issues=[
    ...detectAnomalies({seconds,climateState,weatherSnapshot,maintenance,safety,history,now})
  ];
  const emergency=Boolean(safety?.emergency_latched||safety?.latched||String(seconds?.phase||'').includes('emergency'));
  if(emergency)issues.push({level:'critical',code:'emergency',message:'Parada de emergência ativa.'});
  if(maintenance?.active)issues.push({level:'warning',code:'maintenance',message:'Modo manutenção ativo.'});

  if(String(seconds?.history_sync?.status||'')==='degraded'){
    issues.push({
      level:'warning',
      code:'history_sync_degraded',
      message:Number(seconds?.history_sync?.pending||0)>1
        ?Number(seconds.history_sync.pending)+' eventos aguardam confirmação no Firebase.'
        :'Um evento aguarda confirmação no Firebase.'
    });
  }
  if(String(seconds?.accounting_reconciliation?.status||'')==='degraded'){
    issues.push({
      level:'warning',
      code:'accounting_reconciliation_degraded',
      message:'A conferência automática dos pulsos está temporariamente indisponível.'
    });
  }

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
  const local=localNowParts(now);
  const startSec=Math.max(0,Math.min(1439,Number(seconds.start_minutes||0)))*60;
  const endSec=Math.max(1,Math.min(1440,Number(seconds.end_minutes||1440)))*60;
  const mask=Math.max(0,Number(seconds.days_mask??127));
  const insideSchedule=Boolean(mask&(1<<local.weekday))&&local.seconds>=startSec&&local.seconds<endSec;
  const baseOn=Math.max(1,Number(seconds.base_on_seconds||seconds.on_seconds||30));
  const baseOff=Math.max(1,Number(seconds.base_off_seconds||seconds.off_seconds||120));
  const currentOn=Math.max(1,Number(seconds.on_seconds||baseOn));
  const currentOff=Math.max(1,Number(seconds.off_seconds||baseOff));
  const baseDuty=baseOn/(baseOn+baseOff);
  const currentDuty=currentOn/(currentOn+currentOff);
  const extreme=String(climateState?.extreme_level||'');
  const freshClimate=now-Number(climateState?.last_evaluated_at||0)<12*60000;
  if(
    insideSchedule&&freshClimate&&
    ['critico'].includes(extreme)&&
    String(climateState?.last_mode||'')==='automatic'&&
    currentDuty<baseDuty*1.05
  ){
    issues.push({
      level:'critical',code:'extreme_without_response',
      message:'Clima crítico sem aumento confirmado da irrigação automática.'
    });
  }

  for(const auditIssue of (seconds?.operational_audit?.issues||[])){
    if(!auditIssue?.code)continue;
    if(!issues.some(issue=>String(issue.code)===String(auditIssue.code))){
      issues.push({
        level:auditIssue.level==='critical'?'critical':'warning',
        code:String(auditIssue.code),
        message:String(auditIssue.message||'Auditoria operacional encontrou uma anomalia.')
      });
    }
  }

  const uniqueIssues=[];
  const seenCodes=new Set();
  for(const issue of issues){
    const code=String(issue?.code||issue?.message||'issue');
    if(seenCodes.has(code))continue;
    seenCodes.add(code);
    uniqueIssues.push(issue);
  }

  const critical=uniqueIssues.some(x=>x.level==='critical');
  return{
    level:critical?'critical':uniqueIssues.length?'warning':'ok',
    message:critical
      ?uniqueIssues.find(x=>x.level==='critical')?.message
      :uniqueIssues.length
        ?uniqueIssues[0].message
        :'Tudo funcionando normalmente.',
    issues:uniqueIssues,
    audit:seconds?.operational_audit||null,
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
  const todayAccounting=pulseAccountingForDay(history,todayKey);
  const completedIrrigatedSeconds=Number(todayAccounting.irrigated_seconds||0);
  const ongoingSeconds=
    String(seconds?.phase||'')==='on'&&
    Number(seconds?.pulse_started_at||0)>0&&
    localDateKey(Number(seconds.pulse_started_at))===todayKey
      ?Math.max(0,Math.min(
          Number(seconds.on_seconds||seconds.base_on_seconds||30),
          (now-Number(seconds.pulse_started_at||now))/1000
        ))
      :0;
  const irrigatedSeconds=completedIrrigatedSeconds+ongoingSeconds;
  const pauses=today.filter(x=>['viveiro_weather_pause','viveiro_rain_pause'].includes(String(x.type||''))).length;
  const errors=today.filter(x=>String(x.type||'').includes('error')).length;
  const lastPulse=todayAccounting.finals[0]||null;

  const days=[];
  for(let i=6;i>=0;i--){
    const dt=new Date(now-i*86400000);
    const key=localDateKey(dt.getTime());
    const rows=history.filter(x=>localDateKey(x.ts||Date.parse(x.at||0))===key);
    const accounting=pulseAccountingForDay(history,key);
    days.push({
      key,label:dayLabel(key),
      pulses:Number(accounting.pulses_started||0),
      completed_pulses:Number(accounting.pulses_completed||0),
      interrupted_pulses:Number(accounting.pulses_interrupted||0),
      irrigated_seconds:Number(accounting.irrigated_seconds||0),
      rain_pauses:rows.filter(x=>['viveiro_weather_pause','viveiro_rain_pause'].includes(String(x.type||''))).length,
      errors:rows.filter(x=>String(x.type||'').includes('error')).length
    });
  }

  const firstPulseAt=(todayAccounting.starts.find(x=>x.first_of_window)||todayAccounting.starts.at(-1))?.ts||null;
  const startDelays=today.filter(x=>x.type==='viveiro_start_delay').length;
  const baseline=baseExpectedToday(seconds,now);
  const baselineSeconds=Number(baseline.expected_irrigated_seconds||0);
  const configuredStartSeconds=Math.max(0,Math.min(1439,Number(seconds.start_minutes||0)))*60;
  const firstPulseSeconds=firstPulseAt?localNowParts(firstPulseAt).seconds:null;
  const comparisonComplete=Boolean(
    firstPulseAt&&
    firstPulseSeconds!=null&&
    firstPulseSeconds<=configuredStartSeconds+15*60&&
    startDelays===0&&
    errors===0
  );
  const versusBasePct=comparisonComplete&&baselineSeconds>0
    ?((irrigatedSeconds/baselineSeconds)-1)*100
    :null;

  return{
    today:{
      pulses:Number(todayAccounting.pulses_started||0),
      completed_pulses:Number(todayAccounting.pulses_completed||0),
      interrupted_pulses:Number(todayAccounting.pulses_interrupted||0),
      irrigated_seconds:irrigatedSeconds,
      rain_pauses:pauses,
      errors,
      last_pulse_at:lastPulse?.ts||null,
      first_pulse_at:firstPulseAt,
      start_delays:startDelays,
      base_expected_irrigated_seconds:comparisonComplete?baselineSeconds:null,
      elapsed_window_seconds:Number(baseline.elapsed_window_seconds||0),
      versus_base_percent:versusBasePct==null?null:Number(versusBasePct.toFixed(1)),
      comparison_status:comparisonComplete?'complete':'partial',
      comparison_note:comparisonComplete
        ?'Comparação válida para a janela acompanhada desde o início.'
        :'Dados parciais: a comparação com o ciclo-base fica oculta para não induzir erro.'
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
      const stateTemp=Number(weatherState?.lastTemperature);
      const stateHum=Number(weatherState?.lastHumidity);
      const climateTemp=Number(climateState?.last_temperature);
      const climateHum=Number(climateState?.last_humidity);
      const lastTemp=Number.isFinite(stateTemp)?stateTemp:climateTemp;
      const lastHum=Number.isFinite(stateHum)?stateHum:climateHum;
      const weatherSnapshot={
        ok:!weatherError,
        linked:!weatherError&&weatherState?.weatherOnline!==false,
        cached:true,
        provider:weatherState?.weatherProvider||null,
        checked_at:Number(weatherState?.lastWeatherAt||weatherState?.lastCheckedAt||climateState?.last_evaluated_at||0)||null,
        error:weatherError||null,
        metrics:{
          rainDetected:Boolean(weatherState?.rainDetected),
          rainGeneric:Number.isFinite(Number(weatherState?.rainAmountMm))?{value:Number(weatherState.rainAmountMm),unit:'mm'}:null,
          temperature:Number.isFinite(lastTemp)?{value:lastTemp,unit:'°C'}:null,
          humidity:Number.isFinite(lastHum)?{value:lastHum,unit:'%'}:null
        }
      };
      // O cálculo diário/semanal precisa considerar TODOS os eventos do período.
      // O limite fica somente na lista devolvida para a interface.
      const historyFull=historyRows(historyRaw).filter(
        x=>String(x.source||'').includes('viveiro')||String(x.type||'').startsWith('viveiro_')
      );
      const history=historyFull.slice(0,160);
      const now=Date.now();
      const todayKey=localDateKey(now);
      const auditToday=historyFull.filter(
        x=>localDateKey(x.ts||Date.parse(x.at||0))===todayKey
      ).slice(0,100);
      const maintenanceActive=Boolean(maintenance?.active||(
        maintenance?.enabled&&Number(maintenance?.until||0)>now
      ));
      const activeSeconds=seconds?.enabled?seconds:(config?.profiles?.viveiroFast||{});
      const summary=summarize(historyFull,activeSeconds,now);
      const decisions=decisionTimeline(historyFull);
      const rawIntensity=irrigationIntensity(activeSeconds);
      const outsideAutomatic=String(climateState?.last_decision||'')==='outside_schedule';
      const intensity=outsideAutomatic
        ?{
          ...rawIntensity,
          level:'normal',
          label:'Normal',
          change_percent:0,
          current_duty:rawIntensity.base_duty,
          suspended_outside_schedule:true
        }
        :rawIntensity;
      const cycle_reason=cycleExplanation(activeSeconds,climateState||{});
      const nextEvaluationAt=String(climateState?.last_decision||'')==='outside_schedule'
        ?Number(climateState?.next_schedule_window_at||now)
        :Number(climateState?.last_evaluated_at||0)
          +Math.max(5,Number(climateConfig?.evaluation_minutes||5))*60000;
      const activeMaintenance={...(maintenance||{}),active:maintenanceActive};
      const health=buildHealth({
        seconds:activeSeconds,
        weatherSnapshot,
        climateState:climateState||{},
        maintenance:activeMaintenance,
        safety:safety||{},
        history:historyFull,
        now
      });
      const operation=operationalState({
        seconds:activeSeconds,
        weatherSnapshot,
        climateState:climateState||{},
        maintenance:activeMaintenance,
        safety:safety||{},
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
          cycle_reason,
          operation,
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
