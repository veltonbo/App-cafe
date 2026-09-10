const TZ='America/Porto_Velho';

export function accountingDayKey(ts=Date.now()){
  return new Intl.DateTimeFormat('en-CA',{
    timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'
  }).format(new Date(Number(ts)||Date.now()));
}

export function normalizeHistoryRows(raw){
  if(!raw||typeof raw!=='object')return[];
  return Object.entries(raw)
    .map(([id,value])=>({id,...(value||{})}))
    .sort((a,b)=>Number(b.ts||Date.parse(b.at||0)||0)-Number(a.ts||Date.parse(a.at||0)||0));
}

function rowTs(row){
  return Number(row?.ts||Date.parse(row?.at||0)||0);
}

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

export function pulseAccountingForDay(rows=[],dayKey=accountingDayKey()){
  const all=Array.isArray(rows)?rows:[];
  const startDays=startDayByPulse(all);

  const starts=uniqueLatest(
    all.filter(row=>String(row?.type||'')==='viveiro_pulse_start'&&effectiveDay(row,startDays)===dayKey),
    'start'
  );

  // Um pulso só pode ter um desfecho contábil. Se por alguma falha houver
  // complete + interrupted para o mesmo pulse_id, prevalece o evento mais recente.
  const finals=uniqueLatest(
    all.filter(row=>
      ['viveiro_pulse_complete','viveiro_pulse_interrupted'].includes(String(row?.type||''))&&
      effectiveDay(row,startDays)===dayKey
    ),
    'final'
  );
  const completed=finals.filter(row=>String(row.type)==='viveiro_pulse_complete');
  const interrupted=finals.filter(row=>String(row.type)==='viveiro_pulse_interrupted');

  const irrigatedSeconds=finals.reduce((sum,row)=>{
    const actual=Number(row?.actual_duration_seconds);
    const fallback=Number(row?.duration_seconds||row?.planned_duration_seconds||0);
    const value=Number.isFinite(actual)?actual:fallback;
    return sum+Math.max(0,Number.isFinite(value)?value:0);
  },0);

  return{
    day_key:dayKey,
    starts,
    finals,
    completed,
    interrupted,
    // Para o histórico visível, "pulso" significa irrigação com desfecho
    // confirmado. Um start órfão (por reinício/queda) não deve virar uma
    // irrigação completa no relatório.
    pulses_confirmed:finals.length,
    pulses_started:starts.length,
    pulses_completed:completed.length,
    pulses_interrupted:interrupted.length,
    orphaned_starts:Math.max(0,starts.length-finals.length),
    irrigated_seconds:irrigatedSeconds
  };
}
