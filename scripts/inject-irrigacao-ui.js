import fs from 'node:fs';
import path from 'node:path';

const htmlFile=path.resolve('dist/irrigacao/index.html');
const appFile=path.resolve('dist/irrigacao/app.js');
const authFile=path.resolve('dist/irrigacao/firebase-auth.js');

if(!fs.existsSync(htmlFile))throw new Error('dist/irrigacao/index.html não encontrado após o build');
if(!fs.existsSync(appFile))throw new Error('dist/irrigacao/app.js não encontrado após o build');
if(!fs.existsSync(authFile))throw new Error('dist/irrigacao/firebase-auth.js não encontrado após o build');

let html=fs.readFileSync(htmlFile,'utf8');
if(!html.includes('/irrigacao/app.css')||!html.includes('/irrigacao/app.js')){
  throw new Error('A interface consolidada do Viveiro não foi encontrada no build.');
}

if(!html.includes('/irrigacao/firebase-auth.js')){
  html=html.replace(
    /<script src="\/irrigacao\/app\.js[^>]*><\/script>/,
    match=>match+'\n  <script src="/irrigacao/firebase-auth.js?v=20260910-1" defer></script>'
  );
}

const systemTitle='      <div class="pageTitle"><small>SEGURANÇA</small><h2>Sistema</h2><p>Conectividade, proteção, manutenção e diagnóstico.</p></div>';
if(!html.includes('id="serverDiagnosticsPanel"')){
  if(!html.includes(systemTitle))throw new Error('Título da tela Sistema não encontrado para inserir diagnóstico.');
  const panel=`

      <article id="serverDiagnosticsPanel" class="panel">
        <div class="panelHead"><div><small>ORACLE • DIAGNÓSTICO</small><h3>Saúde do servidor</h3></div><span id="diagOverallBadge" class="badge">VERIFICANDO</span></div>
        <div class="statusRows">
          <div><span>Memória do servidor</span><strong id="diagServerRam">—</strong></div>
          <div><span>Memória do Fazenda 2E</span><strong id="diagProcessRam">—</strong></div>
          <div><span>Histórico local</span><strong id="diagHistory">—</strong></div>
          <div><span>Sincronização local</span><strong id="diagSync">—</strong></div>
          <div><span>Backups locais</span><strong id="diagBackup">—</strong></div>
          <div><span>Firebase</span><strong id="diagFirebase">—</strong></div>
        </div>
        <p id="diagAlerts" class="panelNote">Verificando componentes do servidor.</p>
        <div class="auditFoot"><span>Último diagnóstico</span><strong id="diagCheckedAt">—</strong></div>
      </article>`;
  html=html.replace(systemTitle,systemTitle+panel);
}
fs.writeFileSync(htmlFile,html);

let app=fs.readFileSync(appFile,'utf8');
const marker='async function ensureSecureSession(){\n';
if(!app.includes(marker))throw new Error('Função ensureSecureSession não encontrada no app do Viveiro.');
if(!app.includes("startsWith('f2e.')")){
  app=app.replace(marker,marker+
    "  if(String(store.settings.token||'').startsWith('f2e.')){\n"+
    "    app.sessionReady=false;\n"+
    "    app.authChecked=true;\n"+
    "    return true;\n"+
    "  }\n"
  );
}

if(!app.includes('function renderServerDiagnostics(')){
  const end=app.lastIndexOf('})();');
  if(end<0)throw new Error('Final do app do Viveiro não encontrado para inserir diagnóstico.');
  const diagnostics=`

function renderServerDiagnostics(d){
  const badge=$('diagOverallBadge');
  if(!badge)return;
  const alerts=Array.isArray(d?.alerts)?d.alerts:[];
  const critical=alerts.some(x=>x?.level==='critical');
  setBadge(badge,critical?'CRÍTICO':alerts.length?'ATENÇÃO':'SAUDÁVEL',critical?'bad':alerts.length?'warn':'');

  const total=num(d?.server?.memory?.total_mb),free=num(d?.server?.memory?.free_mb);
  $('diagServerRam').textContent=total?Math.round(free)+' MB livres / '+Math.round(total)+' MB':'—';
  $('diagProcessRam').textContent=d?.checks?.maintenance?.ok
    ?Math.round(num(d.checks.maintenance.value?.memory?.rss_mb))+' MB RAM'
    :'Indisponível';

  const hist=d?.checks?.local_history;
  $('diagHistory').textContent=hist?.ok?num(hist.value?.rows).toLocaleString('pt-BR')+' registros':'Indisponível';
  const syncAt=num(hist?.value?.sync?.last_success_at);
  $('diagSync').textContent=syncAt?'Atualizado há '+fmtAge(syncAt):'Aguardando';

  const maint=d?.checks?.maintenance;
  const backups=maint?.value?.backups||{};
  const backupAt=num(backups?.last?.at);
  $('diagBackup').textContent=maint?.ok
    ?String(num(backups.count))+' arquivos'+(backupAt?' • há '+fmtAge(backupAt):'')
    :'Indisponível';

  const fb=d?.checks?.firebase;
  $('diagFirebase').textContent=fb?.ok?'Online • '+Math.round(num(fb.ms))+' ms':'Indisponível';
  $('diagCheckedAt').textContent=d?.checked_at?localDateTime(d.checked_at):'—';
  $('diagAlerts').textContent=alerts.length
    ?alerts.map(x=>x?.message).filter(Boolean).join(' • ')
    :'Servidor, histórico, sincronização, backups e Firebase funcionando normalmente.';
}

async function refreshServerDiagnostics(){
  if(!hasAuth()||!$('serverDiagnosticsPanel'))return;
  try{
    const d=await api('/api/irrigation/diagnostics');
    renderServerDiagnostics(d);
  }catch(error){
    const badge=$('diagOverallBadge');
    if(badge)setBadge(badge,'INDISPONÍVEL','bad');
    if($('diagAlerts'))$('diagAlerts').textContent='Não foi possível atualizar o diagnóstico: '+(error?.message||'erro de comunicação');
  }
}

qsa('[data-view="system"]').forEach(el=>el.addEventListener('click',()=>setTimeout(refreshServerDiagnostics,200)));
setTimeout(refreshServerDiagnostics,5000);
setInterval(refreshServerDiagnostics,30000);
`;
  app=app.slice(0,end)+diagnostics+app.slice(end);
}
fs.writeFileSync(appFile,app);

console.log('Irrigação: interface validada com login Firebase, diagnóstico visual e sessão bearer compatível com HTTP.');
