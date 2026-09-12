const TZ='America/Porto_Velho';
const localFormatter1=new Intl.DateTimeFormat('en-CA',{
    timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'
  });

export function accountingDayKey(ts=Date.now()){
  return localFormatter1.format(new Date(Number(ts)||Date.now()));
}

export function normalizeHistoryRows(raw){
  if(!raw||typeof raw!=='object')return[];
  return Object.entries(raw)
    .map(([id,value])=>({id,...(value||{})}))
    .sort((a,b)=>Number(b.ts||Date.parse(b.at||0)||0)-Number(a.ts||Date.parse(a.at||0)||0));
}

function rowTs(row){return Number(row?.ts||Date.parse(row?.at||0)||0);}
function identity(row,prefix='row'){
  const pulse=String(row?.pulse_id||'').trim();
  if(pulse)return'pulse:'+pulse;
  const event=String(row?.event_id||row?.id||'').trim();
  if(event)return'event:'+event;
  return prefix+':'+String(rowTs(row))+':'+String(row?.type||'');
}
function uniqueLatest(rows,prefix){
  const map=new Map();
  for(const row of rows){
    const key=identity(row,prefix);
    const current=map.get(key);
    if(!current||rowTs(row)>=rowTs(current))map.set(key,row);
  }
  return[...map.values()].sort((a,b)=>rowTs(b)-rowTs(a));
}
function startDayByPulse(rows){
  const map=new Map();
  for(const row of rows){
    if(String(row?.type||'')!=='viveiro_pulse_start')continue;
    const pulse=String(row?.pulse_id||'').trim();
    if(!pulse)continue;
    const current=map.get(pulse);
    if(!current||rowTs(row)<rowTs(current))map.set(pulse,row);
  }
  return new Map([...map.entries()].map(([pulse,row])=>[pulse,accountingDayKey(rowTs(row))]));
}
function effectiveDay(row,startDays){
  const pulse=String(row?.pulse_id||'').trim();
  if(pulse&&startDays.has(pulse))return startDays.get(pulse);
  return accountingDayKey(rowTs(row));
}
function canonicalSummaryForDay(rows,dayKey){
  return rows
    .filter(row=>String(row?.type||'')==='viveiro_daily_summary'&&String(row?.day_key||'')===String(dayKey))
    .sort((a,b)=>rowTs(b)-rowTs(a))[0]||null;
}

export function accountedPulseSeconds(row={}){
  const type=String(row?.type||'');
  const accounted=Number(row?.accounted_duration_seconds);
  if(Number.isFinite(accounted))return Math.max(0,accounted);

  // Uma confirmação Smart Life pode chegar vários segundos depois de o comando
  // OFF ter sido enviado. Para pulsos concluídos isso não significa que a água
  // ficou ligada durante toda a latência de confirmação. O tempo programado é
  // portanto a referência contábil mais confiável para pulsos concluídos.
  if(type==='viveiro_pulse_complete'){
    const planned=Number(row?.duration_seconds||row?.planned_duration_seconds);
    if(Number.isFinite(planned))return Math.max(0,planned);
  }

  // Em interrupções, usa o tempo observado até o desligamento/fechamento do pulso.
  const actual=Number(row?.actual_duration_seconds);
  if(Number.isFinite(actual))return Math.max(0,actual);
  const fallback=Number(row?.planned_duration_seconds||row?.duration_seconds||0);
  return Math.max(0,Number.isFinite(fallback)?fallback:0);
}

export function pulseAccountingForDay(rows=[],dayKey=accountingDayKey()){
  const all=Array.isArray(rows)?rows:[];
  const startDays=startDayByPulse(all);
  const starts=uniqueLatest(
    all.filter(row=>String(row?.type||'')==='viveiro_pulse_start'&&effectiveDay(row,startDays)===dayKey),'start'
  );
  const finals=uniqueLatest(
    all.filter(row=>['viveiro_pulse_complete','viveiro_pulse_interrupted'].includes(String(row?.type||''))&&effectiveDay(row,startDays)===dayKey),'final'
  );
  const completed=finals.filter(row=>String(row.type)==='viveiro_pulse_complete');
  const interrupted=finals.filter(row=>String(row.type)==='viveiro_pulse_interrupted');
  const irrigatedSeconds=finals.reduce((sum,row)=>sum+accountedPulseSeconds(row),0);

  const canonical=canonicalSummaryForDay(all,dayKey);
  if(canonical){
    const pulses=Math.max(0,Number(canonical?.pulses||0));
    const completedCount=Math.max(0,Number(canonical?.completed||0));
    const interruptedCount=Math.max(0,Number(canonical?.interrupted||0));
    const irrigated=Math.max(0,Number(canonical?.irrigated_seconds||0));
    const unclosed=Math.max(0,Number(canonical?.unclosed_starts||0));
    return{
      day_key:dayKey,starts,finals,completed,interrupted,
      pulses_confirmed:pulses,pulses_started:pulses,pulses_completed:completedCount,
      pulses_interrupted:interruptedCount,orphaned_starts:unclosed,
      irrigated_seconds:irrigated,raw_pulses_started:starts.length,
      raw_pulses_completed:completed.length,raw_pulses_interrupted:interrupted.length,
      history_summary:canonical,history_quality:String(canonical?.history_quality||'canonical'),
      history_confidence:String(canonical?.history_confidence||'high')
    };
  }

  return{
    day_key:dayKey,starts,finals,completed,interrupted,
    pulses_confirmed:finals.length,pulses_started:starts.length,pulses_completed:completed.length,
    pulses_interrupted:interrupted.length,orphaned_starts:Math.max(0,starts.length-finals.length),
    irrigated_seconds:irrigatedSeconds,raw_pulses_started:starts.length,
    raw_pulses_completed:completed.length,raw_pulses_interrupted:interrupted.length,
    history_summary:null,history_quality:'event_level',history_confidence:'high'
  };
}
