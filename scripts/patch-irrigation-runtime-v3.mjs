import fs from 'node:fs';

function patchSecondsManager(){
  const file='server/continuous/seconds-manager.js';
  let text=fs.readFileSync(file,'utf8');
  let changed=false;

  const deadlineMarker="    let interrupted=false;\n    const onDeadline=Number(state.expected_off_at||0)||(Date.now()+maxOn*1000);\n    while(state.enabled){";
  const deadlineReplacement="    let interrupted=false;\n    const onDeadline=Number(state.expected_off_at||0)||(Date.now()+maxOn*1000);\n    let deadlineOffCancelled=false;\n    const deadlineOffPromise=(async()=>{\n      const waitMs=Math.max(0,onDeadline-Date.now());\n      if(waitMs>0)await sleep(waitMs);\n      if(deadlineOffCancelled)return false;\n      return safeOff('pulse_deadline');\n    })();\n    while(state.enabled){";
  if(text.includes(deadlineMarker)){
    text=text.replace(deadlineMarker,deadlineReplacement);
    changed=true;
  }else if(!text.includes('const deadlineOffPromise=(async()=>')){
    throw new Error('Ponto do temporizador independente do pulso não encontrado.');
  }

  const activeMarker="      if(!(await active())){interrupted=true;break}\n      if(!localSchedule(state).inside){interrupted=true;break}\n\n      const nowWeather=await weather();";
  const activeReplacement="      if(!(await active())){interrupted=true;break}\n      if(Date.now()>=onDeadline)break;\n      if(!localSchedule(state).inside){interrupted=true;break}\n      if(Date.now()>=onDeadline)break;\n\n      const nowWeather=await weather();\n      if(Date.now()>=onDeadline)break;";
  if(text.includes(activeMarker)){
    text=text.replace(activeMarker,activeReplacement);
    changed=true;
  }else if(!text.includes('if(Date.now()>=onDeadline)break;\n      if(!localSchedule(state).inside)')){
    throw new Error('Ponto de verificação do prazo durante o pulso não encontrado.');
  }

  const safeOffMarker="    await safeOff(interrupted?'pulse_interrupted':'pulse_deadline');\n    if(!interrupted&&onDeadline>0){";
  const safeOffReplacement="    if(interrupted){\n      deadlineOffCancelled=true;\n      await safeOff('pulse_interrupted');\n    }else{\n      await deadlineOffPromise;\n    }\n    if(!interrupted&&onDeadline>0){";
  if(text.includes(safeOffMarker)){
    text=text.replace(safeOffMarker,safeOffReplacement);
    changed=true;
  }else if(!text.includes("deadlineOffCancelled=true;\n      await safeOff('pulse_interrupted')")){
    throw new Error('Ponto de desligamento do pulso não encontrado.');
  }

  const dailyMarker="        daily_irrigated_seconds:Number(state.daily_irrigated_seconds||0)+actualPulseSeconds,\n        daily_last_pulse_at:physicalOffAt";
  const dailyReplacement="        daily_irrigated_seconds:Number(state.daily_irrigated_seconds||0)+(interrupted?actualPulseSeconds:maxOn),\n        daily_last_pulse_at:physicalOffAt";
  if(text.includes(dailyMarker)){
    text=text.replace(dailyMarker,dailyReplacement);
    changed=true;
  }else if(!text.includes('+(interrupted?actualPulseSeconds:maxOn)')){
    throw new Error('Contabilidade ao vivo do pulso não encontrada.');
  }

  const completeMarker="        duration_seconds:maxOn,\n        actual_duration_seconds:Number(actualPulseSeconds.toFixed(3)),";
  const completeReplacement="        duration_seconds:maxOn,\n        accounted_duration_seconds:maxOn,\n        actual_duration_seconds:Number(actualPulseSeconds.toFixed(3)),";
  if(text.includes(completeMarker)){
    text=text.replace(completeMarker,completeReplacement);
    changed=true;
  }else if(!text.includes('accounted_duration_seconds:maxOn')){
    throw new Error('Evento de pulso concluído não encontrado.');
  }

  const interruptMarker="      planned_duration_seconds:plannedSeconds,\n      actual_duration_seconds:Number(actualSeconds.toFixed(3)),";
  const interruptReplacement="      planned_duration_seconds:plannedSeconds,\n      accounted_duration_seconds:Number(actualSeconds.toFixed(3)),\n      actual_duration_seconds:Number(actualSeconds.toFixed(3)),";
  if(text.includes(interruptMarker)){
    text=text.replace(interruptMarker,interruptReplacement);
    changed=true;
  }

  if(!text.includes('async function migrateDailyAccountingV3(){')){
    const marker='async function reconcileDailyAccounting({notify=false}={}){';
    if(!text.includes(marker))throw new Error('Ponto de migração contábil não encontrado.');
    const fn=`async function migrateDailyAccountingV3(){\n  ensureDailyCounters();\n  if(Number(state.accounting_model_version||0)>=3)return false;\n  try{\n    const rows=(await readRecentHistory({sinceMs:Date.now()-HISTORY_RECENT_WINDOW_MS,limit:HISTORY_RECENT_LIMIT}))\n      .filter(row=>String(row?.source||'').includes('viveiro')||String(row?.type||'').startsWith('viveiro_'));\n    const accounting=pulseAccountingForDay(rows,localDayKey());\n    state={\n      ...state,\n      daily_day_key:localDayKey(),\n      daily_pulses_started:Number(accounting.pulses_started||0),\n      daily_pulses_completed:Number(accounting.pulses_completed||0),\n      daily_pulses_interrupted:Number(accounting.pulses_interrupted||0),\n      daily_irrigated_seconds:Number(accounting.irrigated_seconds||0),\n      accounting_model_version:3,\n      accounting_model_migrated_at:Date.now()\n    };\n    await persist();\n    console.log('Contabilidade do Viveiro migrada para modelo v3',{\n      started:state.daily_pulses_started,completed:state.daily_pulses_completed,\n      interrupted:state.daily_pulses_interrupted,irrigated_seconds:state.daily_irrigated_seconds\n    });\n    return true;\n  }catch(error){\n    console.warn('Migração contábil v3 indisponível:',error?.message||error);\n    return false;\n  }\n}\n\n`;
    text=text.replace(marker,fn+marker);
    changed=true;
  }

  const initMarker="  await load();\n  await recoverDailyCountersFromReconciliation();\n\n  await reconcileDailyAccounting({notify:false})";
  const initReplacement="  await load();\n  await recoverDailyCountersFromReconciliation();\n  await migrateDailyAccountingV3();\n\n  await reconcileDailyAccounting({notify:false})";
  if(text.includes(initMarker)){
    text=text.replace(initMarker,initReplacement);
    changed=true;
  }else if(!text.includes('await migrateDailyAccountingV3();')){
    throw new Error('Inicialização da migração contábil v3 não encontrada.');
  }

  if(changed)fs.writeFileSync(file,text);
  console.log('[Fazenda 2E] Precisão de pulso e contabilidade v3 aplicadas.');
}

function patchSecondsApi(){
  const file='server/api/viveiro/_seconds.js';
  let text=fs.readFileSync(file,'utf8');
  if(text.includes("engine:'railway_continuous'")){
    text=text.replace("engine:'railway_continuous'","engine:'oracle_continuous'");
    fs.writeFileSync(file,text);
  }
  console.log('[Fazenda 2E] Engine identificado como Oracle continuous.');
}

function patchDashboardLabels(){
  const file='server/api/viveiro/dashboard.js';
  let text=fs.readFileSync(file,'utf8');
  let changed=false;
  if(text.includes("railway:'online'")){
    text=text.replace("railway:'online'","oracle:'online'");
    changed=true;
  }
  if(changed)fs.writeFileSync(file,text);
  console.log('[Fazenda 2E] Diagnóstico atualizado para Oracle.');
}

patchSecondsManager();
patchSecondsApi();
patchDashboardLabels();
