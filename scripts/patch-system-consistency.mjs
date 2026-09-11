import fs from 'node:fs';

function replaceOnce(text,from,to,label){
  if(text.includes(to))return text;
  if(!text.includes(from))throw new Error('Não foi possível aplicar: '+label);
  return text.replace(from,to);
}

// 1) Incidentes: um incidente ativo também precisa ser encerrado quando a condição
// desaparece, mesmo se a lista `previous.issues` já tiver sido limpa por reinício
// ou por uma auditoria anterior. Isso elimina incidentes fantasmas no Histórico.
{
  const file='server/continuous/seconds-manager.js';
  let text=fs.readFileSync(file,'utf8');
  const oldBlock=`  const previousCodes=new Set((previous.issues||[]).map(x=>String(x.code)));\n  const notifiedCodes=new Set((previous.notified_codes||[]).map(String));\n  const activeIncidents={...(previous.active_incidents||{})};\n  const currentCodes=new Set(issues.map(x=>String(x.code)));\n  const newIssues=issues.filter(x=>!notifiedCodes.has(String(x.code)));\n  const cleared=[...previousCodes].filter(code=>!currentCodes.has(code));`;
  const newBlock=`  const previousCodes=new Set((previous.issues||[]).map(x=>String(x.code)));\n  const notifiedCodes=new Set((previous.notified_codes||[]).map(String));\n  const activeIncidents={...(previous.active_incidents||{})};\n  const currentCodes=new Set(issues.map(x=>String(x.code)));\n  const newIssues=issues.filter(x=>!notifiedCodes.has(String(x.code)));\n  // Inclui incidentes persistidos/ativos na reconciliação. Sem isso, após um\n  // reinício era possível a auditoria ficar NORMAL enquanto o relatório ainda\n  // mantinha um incidente antigo como aberto.\n  const knownActiveCodes=new Set([...previousCodes,...Object.keys(activeIncidents)]);\n  const cleared=[...knownActiveCodes].filter(code=>!currentCodes.has(code));`;
  text=replaceOnce(text,oldBlock,newBlock,'encerramento de incidentes ativos persistidos');
  fs.writeFileSync(file,text);
}

// 2) Saúde: Automático 2.0 não deve ser considerado atrasado enquanto a irrigação
// está legitimamente bloqueada por chuva/espera pós-chuva/clima indisponível.
{
  const file='server/api/viveiro/dashboard.js';
  let text=fs.readFileSync(file,'utf8');
  const oldCond=`  if(op.inside_schedule&&String(climateState?.last_mode||'')==='automatic'){\n    const evalAt=Number(climateState?.last_evaluated_at||0);`;
  const newCond=`  const climatePausedPhases=new Set(['weather_blocked','waiting_after_rain','weather_unavailable','maintenance','emergency_stopped']);\n  if(op.inside_schedule&&String(climateState?.last_mode||'')==='automatic'&&!climatePausedPhases.has(String(op.phase||''))){\n    const evalAt=Number(climateState?.last_evaluated_at||0);`;
  text=replaceOnce(text,oldCond,newCond,'saúde do Automático 2.0 durante bloqueios legítimos');
  fs.writeFileSync(file,text);
}

console.log('[Fazenda 2E] Consistência: incidentes fantasmas são encerrados e alertas climáticos respeitam pausas legítimas.');
