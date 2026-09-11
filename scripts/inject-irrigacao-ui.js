import fs from 'node:fs';
import path from 'node:path';

const htmlFile=path.resolve('dist/irrigacao/index.html');
const appFile=path.resolve('dist/irrigacao/app.js');
const authFile=path.resolve('dist/irrigacao/firebase-auth.js');
if(!fs.existsSync(htmlFile)||!fs.existsSync(appFile)||!fs.existsSync(authFile))throw new Error('Build do Viveiro incompleto.');
let html=fs.readFileSync(htmlFile,'utf8');
html=html.replace(/\/irrigacao\/app\.js\?v=[^\"]+/,'/irrigacao/app.js?v=20260911-5');
if(!html.includes('/irrigacao/firebase-auth.js'))html=html.replace(/<script src="\/irrigacao\/app\.js[^>]*><\/script>/,m=>m+'\n  <script src="/irrigacao/firebase-auth.js?v=20260910-1" defer></script>');
if(!html.includes('id="auto3ShadowBox"')){
 const marker='<p id="autoReason">O sistema ainda não enviou a avaliação climática.</p>';
 if(!html.includes(marker))throw new Error('Bloco Automático 2.0 não encontrado.');
 html=html.replace(marker,marker+`\n<div id="auto3ShadowBox" style="margin-top:18px;padding-top:16px;border-top:1px solid rgba(90,105,95,.18)"><div class="autoTop"><div><small>AUTOMÁTICO 3.0 • MODO SOMBRA</small><h3 id="auto3Title">Observando sem controlar</h3></div><span id="auto3Badge" class="badge">SOMBRA</span></div><p id="auto3Reason">O 3.0 calcula em paralelo, mas não envia comandos para a bomba.</p><div class="cycleRow"><div><small>Ciclo atual</small><strong id="auto3Current">—</strong></div><span>→</span><div><small>3.0 faria</small><strong id="auto3Target">—</strong></div><div class="intensity"><small>Confiança</small><strong id="auto3Confidence">—</strong></div></div></div>`);
}
const systemTitle='      <div class="pageTitle"><small>SEGURANÇA</small><h2>Sistema</h2><p>Conectividade, proteção, manutenção e diagnóstico.</p></div>';
if(!html.includes('id="serverDiagnosticsPanel"')&&html.includes(systemTitle))html=html.replace(systemTitle,systemTitle+`<article id="serverDiagnosticsPanel" class="panel"><div class="panelHead"><div><small>ORACLE • DIAGNÓSTICO</small><h3>Saúde do servidor</h3></div><span id="diagOverallBadge" class="badge">VERIFICANDO</span></div><div class="statusRows"><div><span>Memória do servidor</span><strong id="diagServerRam">—</strong></div><div><span>Memória do Fazenda 2E</span><strong id="diagProcessRam">—</strong></div><div><span>Histórico local</span><strong id="diagHistory">—</strong></div><div><span>Sincronização local</span><strong id="diagSync">—</strong></div><div><span>Backups locais</span><strong id="diagBackup">—</strong></div><div><span>Firebase</span><strong id="diagFirebase">—</strong></div></div><p id="diagAlerts" class="panelNote">Verificando componentes do servidor.</p><div class="auditFoot"><span>Último diagnóstico</span><strong id="diagCheckedAt">—</strong></div></article>`);
fs.writeFileSync(htmlFile,html);

let app=fs.readFileSync(appFile,'utf8');
const sessionMarker='async function ensureSecureSession(){\n';
if(app.includes(sessionMarker)&&!app.includes("startsWith('f2e.')"))app=app.replace(sessionMarker,sessionMarker+"  if(String(store.settings.token||'').startsWith('f2e.')){app.sessionReady=false;app.authChecked=true;return true;}\n");

const oldClimate="  const v=cs.last_vpd??cs.vpd;\n  const r=m.rainGeneric?.value??m.rain24h?.value;";
const newClimate="  const currentClimate=d.climate?.current||{};\n  const v=currentClimate.fresh?currentClimate.vpd:null;\n  const r=m.rainGeneric?.value??m.rain24h?.value;";
if(app.includes(oldClimate))app=app.replace(oldClimate,newClimate);
const oldHint="  $('vpd').textContent=Number.isFinite(Number(v))?Number(v).toFixed(2)+' kPa':'—';\n  $('rain').textContent=";
const newHint="  $('vpd').textContent=Number.isFinite(Number(v))?Number(v).toFixed(2)+' kPa':'—';\n  if($('vpdHint'))$('vpdHint').textContent=currentClimate.fresh?'Calculado da leitura atual':currentClimate.observed_at?'Leitura climática antiga':'Aguardando leitura sincronizada';\n  $('rain').textContent=";
if(app.includes(oldHint))app=app.replace(oldHint,newHint);
const oldLevel="  const level=String(cs.drying_level_label||cs.drying_level||cs.last_level||cs.level||'').replaceAll('_',' ');";
const newLevel="  const level=currentClimate.fresh?String(currentClimate.level_label||currentClimate.level||'').replaceAll('_',' '):'';";
if(app.includes(oldLevel))app=app.replace(oldLevel,newLevel);

if(!app.includes("const shadow3=d.climate?.shadow3||{};")){
 const marker="  $('autoReason').textContent=intel.cycle_reason?.detail||cs.last_reason||'Aguardando avaliação climática.';";
 if(!app.includes(marker))throw new Error('Renderização Automático 2.0 não encontrada.');
 app=app.replace(marker,marker+`\n  const shadow3=d.climate?.shadow3||{};if($('auto3ShadowBox')){const st=String(shadow3.status||'observing');const lb=st==='shadow_recommendation'?'SIMULARIA':st==='stable'?'ESTÁVEL':st==='outside_schedule'?'FORA DO HORÁRIO':st==='blocked'?'CHUVA':'OBSERVANDO';setBadge($('auto3Badge'),lb,shadow3.would_act?'warn':'');$('auto3Title').textContent=shadow3.level_label?shadow3.level_label+' • sem controlar':'Observando sem controlar';$('auto3Reason').textContent=shadow3.reason||'O 3.0 calcula em paralelo, mas não envia comandos para a bomba.';const a=num(shadow3.current_on_seconds),b=num(shadow3.current_off_seconds),c=num(shadow3.target_on_seconds),e=num(shadow3.target_off_seconds);$('auto3Current').textContent=a&&b?a+' s / '+b+' s':'—';$('auto3Target').textContent=c&&e?c+' s / '+e+' s':'—';$('auto3Confidence').textContent=shadow3.confidence_label||'—';}`);
}

if(!app.includes('function renderServerDiagnostics(')){
 const end=app.lastIndexOf('})();');if(end<0)throw new Error('Final do app não encontrado.');
 const code=`\nfunction renderServerDiagnostics(d){const badge=$('diagOverallBadge');if(!badge)return;const alerts=Array.isArray(d?.alerts)?d.alerts:[];const critical=alerts.some(x=>x?.level==='critical');setBadge(badge,critical?'CRÍTICO':alerts.length?'ATENÇÃO':'SAUDÁVEL',critical?'bad':alerts.length?'warn':'');const total=num(d?.server?.memory?.total_mb),free=num(d?.server?.memory?.free_mb);$('diagServerRam').textContent=total?Math.round(free)+' MB livres / '+Math.round(total)+' MB':'—';$('diagProcessRam').textContent=d?.checks?.maintenance?.ok?Math.round(num(d.checks.maintenance.value?.memory?.rss_mb))+' MB RAM':'Indisponível';const hist=d?.checks?.local_history;$('diagHistory').textContent=hist?.ok?num(hist.value?.rows).toLocaleString('pt-BR')+' registros':'Indisponível';const syncAt=num(hist?.value?.sync?.last_success_at);$('diagSync').textContent=syncAt?'Atualizado há '+fmtAge(syncAt):'Aguardando';const maint=d?.checks?.maintenance,backups=maint?.value?.backups||{},backupAt=num(backups?.last?.at);$('diagBackup').textContent=maint?.ok?String(num(backups.count))+' arquivos'+(backupAt?' • há '+fmtAge(backupAt):''):'Indisponível';const fb=d?.checks?.firebase;$('diagFirebase').textContent=fb?.ok?'Online • '+Math.round(num(fb.ms))+' ms':'Indisponível';$('diagCheckedAt').textContent=d?.checked_at?localDateTime(d.checked_at):'—';$('diagAlerts').textContent=alerts.length?alerts.map(x=>x?.message).filter(Boolean).join(' • '):'Servidor, histórico, sincronização, backups e Firebase funcionando normalmente.';}\nasync function refreshServerDiagnostics(){if(!hasAuth()||!$('serverDiagnosticsPanel'))return;try{renderServerDiagnostics(await api('/api/irrigation/diagnostics'))}catch(error){const b=$('diagOverallBadge');if(b)setBadge(b,'INDISPONÍVEL','bad');if($('diagAlerts'))$('diagAlerts').textContent='Não foi possível atualizar o diagnóstico: '+(error?.message||'erro de comunicação')}}\nqsa('[data-view="system"]').forEach(el=>el.addEventListener('click',()=>setTimeout(refreshServerDiagnostics,200)));setTimeout(refreshServerDiagnostics,1500);setInterval(refreshServerDiagnostics,30000);\n`;
 app=app.slice(0,end)+code+app.slice(end);
}
fs.writeFileSync(appFile,app);
console.log('Irrigação: VPD sincronizado, cache atualizado, Automático 3.0 sombra e diagnóstico visual aplicados.');
