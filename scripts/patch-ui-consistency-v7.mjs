import fs from 'node:fs';
const H='dist/irrigacao/index.html',J='dist/irrigacao/app.js',C='dist/irrigacao/app.css';
let h=fs.readFileSync(H,'utf8'),j=fs.readFileSync(J,'utf8'),c=fs.readFileSync(C,'utf8');
const MARK='FAZENDA2E_UI_CONSISTENCY_V7';
if(j.includes(MARK)){console.log('[Fazenda 2E] UI consistency v7 já aplicada.');process.exit(0)}

// O painel antigo do 4.0 ficou redundante e, em algumas respostas, aparecia vazio.
// Mantemos o cartão executivo e o cartão resumo do 4.0, ambos alimentados pela mesma fonte.
c+=`\n/* ${MARK} */\n#auto4DecisionCenter{display:none!important}\n`;

// O cabeçalho executivo deve refletir o estado em tempo real recebido pelo SSE,
// e não uma fotografia mais antiga do dashboard.
const oldExec=` set('execHeadline',(d.intelligence?.operation?.label||'Sistema analisando').replaceAll('_',' '));set('execSubline',a.reason||d.intelligence?.operation?.detail||'Operação monitorada em tempo real.');`;
const newExec=` const live=seconds(),phase=String(live.phase||'');\n const phaseLabel=phase==='on'?'IRRIGANDO':phase==='off'?'INTERVALO':phase==='starting_on'?'LIGANDO':phase==='stopping_off'?'DESLIGANDO':phase==='weather_blocked'?'PAUSADO PELA CHUVA':phase==='waiting_after_rain'?'AGUARDANDO APÓS CHUVA':phase==='waiting_window'?'AGUARDANDO HORÁRIO':phase==='maintenance'?'MANUTENÇÃO':phase.includes('emergency')?'EMERGÊNCIA':(d.intelligence?.operation?.label||'Sistema analisando');\n set('execHeadline',String(phaseLabel).replaceAll('_',' '));set('execSubline',a.reason||d.intelligence?.operation?.detail||'Operação monitorada em tempo real.');`;
if(j.includes(oldExec))j=j.replace(oldExec,newExec);

// O sistema já possui uma confirmação recente usada no Resumo. Reutiliza a mesma
// referência para não mostrar traço no Sistema enquanto o dispositivo está online.
const oldSystem=`  $('watchdogState').textContent=s.watchdog?.status||s.watchdog_status||'—';\n  $('confirmationState').textContent=s.last_confirmation_at?fmtAge(s.last_confirmation_at)+' atrás':'—';`;
const newSystem=`  const systemHealthOk=String(health?.level||'ok')==='ok';\n  $('watchdogState').textContent=s.watchdog?.status||s.watchdog_status||(systemHealthOk?'Sem alerta':'Aguardando');\n  const confirmationAt=num(s.last_confirmation_at||s.state_updated_at||app.lastStatusAt);\n  $('confirmationState').textContent=confirmationAt?fmtAge(confirmationAt)+' atrás':'Aguardando';`;
if(j.includes(oldSystem))j=j.replace(oldSystem,newSystem);

const oldLatency=`  $('confirmationLatencyState').textContent=Number.isFinite(latencyAvg)&&num(s.confirmation_latency?.samples)>0\n    ?Math.round(latencyAvg)+' ms méd.'\n    :Number.isFinite(latencyLast)&&latencyLast>=0?Math.round(latencyLast)+' ms':'—';`;
const newLatency=`  $('confirmationLatencyState').textContent=Number.isFinite(latencyAvg)&&num(s.confirmation_latency?.samples)>0\n    ?Math.round(latencyAvg)+' ms méd.'\n    :Number.isFinite(latencyLast)&&latencyLast>0?Math.round(latencyLast)+' ms':'Aguardando amostra';`;
if(j.includes(oldLatency))j=j.replace(oldLatency,newLatency);

// Torna a demanda explícita em relação ao ciclo-base para evitar a leitura de que
// "demanda +24%" e "reduzir" sejam contraditórios quando o Auto 2.0 já está acima do base.
const oldDemand=`set('sum4Demand',Number.isFinite(Number(a.demand_percent))?((Number(a.demand_percent)>0?'+':'')+a.demand_percent+'%'):'—');`;
const newDemand=`set('sum4Demand',Number.isFinite(Number(a.demand_percent))?((Number(a.demand_percent)>0?'+':'')+a.demand_percent+'% vs base'):'—');`;
if(j.includes(oldDemand))j=j.replace(oldDemand,newDemand);

j+='\n// '+MARK+'\n';
h=h.replace(/\/irrigacao\/app\.js\?v=[^\"]+/,'/irrigacao/app.js?v=20260912-consistency7');
h=h.replace(/\/irrigacao\/app\.css\?v=[^\"]+/,'/irrigacao/app.css?v=20260912-consistency7');
fs.writeFileSync(H,h);fs.writeFileSync(J,j);fs.writeFileSync(C,c);
console.log('[Fazenda 2E] Consistência visual e dados ao vivo v7 aplicada.');
