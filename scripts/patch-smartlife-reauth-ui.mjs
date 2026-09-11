import fs from 'node:fs';
import path from 'node:path';

const htmlFile=path.resolve('dist/irrigacao/index.html');
const appFile=path.resolve('dist/irrigacao/app.js');
const cssFile=path.resolve('dist/irrigacao/app.css');

let html=fs.readFileSync(htmlFile,'utf8');
let app=fs.readFileSync(appFile,'utf8');
let css=fs.readFileSync(cssFile,'utf8');

if(!html.includes('id="smartLifeReconnectPanel"')){
  const marker='<div class="auditFoot"><span>Último diagnóstico</span><strong id="diagCheckedAt">—</strong></div>\n      </article>';
  if(!html.includes(marker))throw new Error('Painel de diagnóstico não encontrado para inserir reconexão Smart Life.');
  html=html.replace(marker,marker+`\n      <article id="smartLifeReconnectPanel" class="panel smartLifeReconnectPanel">\n        <div class="panelHead"><div><small>SMART LIFE • CONEXÃO</small><h3>Reconectar dispositivos</h3></div><span id="smartLifeReconnectBadge" class="badge">VERIFICANDO</span></div>\n        <p id="smartLifeReconnectText" class="panelNote">Verificando a conexão atual de EKAZA e Weather2-2.</p>\n        <button id="smartLifeReconnectBtn" class="primary full" type="button">Reconectar Smart Life</button>\n        <div id="smartLifeQrArea" class="smartLifeQrArea" hidden>\n          <img id="smartLifeQrImage" alt="QR Code Smart Life">\n          <strong>Autorize no aplicativo Smart Life</strong>\n          <p>Abra o Smart Life, use o leitor de QR Code e confirme a autorização. Depois volte aqui.</p>\n          <button id="smartLifeConfirmBtn" class="primary full" type="button">Já autorizei</button>\n          <button id="smartLifeCancelBtn" class="secondary full" type="button">Cancelar</button>\n        </div>\n      </article>`);
}
fs.writeFileSync(htmlFile,html);

if(!css.includes('/* smartlife-reauth-ui-v1 */')){
  css+=`\n/* smartlife-reauth-ui-v1 */\n.smartLifeReconnectPanel{margin-top:12px}.smartLifeQrArea{margin-top:12px;padding:14px;border:1px solid var(--line);border-radius:14px;background:#f8fbf9;text-align:center}.smartLifeQrArea img{display:block;width:min(260px,82vw);height:auto;margin:0 auto 12px;border-radius:12px;background:#fff;padding:8px}.smartLifeQrArea strong{display:block;font-size:.72rem}.smartLifeQrArea p{margin:7px 0 12px;color:var(--muted);font-size:.52rem;line-height:1.4}.smartLifeQrArea .full{width:100%;margin-top:7px}\n`;
  fs.writeFileSync(cssFile,css);
}

// Sincroniza o cartão de reconexão com o estado real dos dois dispositivos.
if(!app.includes("setBadge(reconnectBadge,smartLifeOk?'CONECTADO':'ATENÇÃO'")){
  const oldRender=`function renderSystem(){\n  const d=app.dashboard||{},s=seconds(),w=weather(),health=d.intelligence?.health||{};\n  const deviceOk=app.status?.online===true;\n  const weatherOk=Boolean(w.linked&&!w.error&&w.device?.online!==false);`;
  const newRender=`function renderSystem(){\n  const d=app.dashboard||{},s=seconds(),w=weather(),health=d.intelligence?.health||{};\n  const deviceOk=app.status?.online===true;\n  const weatherOk=Boolean(w.linked&&!w.error&&w.device?.online!==false);\n  const reconnectBadge=$('smartLifeReconnectBadge'),reconnectText=$('smartLifeReconnectText');\n  if(reconnectBadge&&!app.smartLifeReauthToken){\n    const smartLifeOk=deviceOk&&weatherOk;\n    setBadge(reconnectBadge,smartLifeOk?'CONECTADO':'ATENÇÃO',smartLifeOk?'':'warn');\n    if(reconnectText)reconnectText.textContent=smartLifeOk\n      ?'EKAZA e Weather2-2 estão conectados. Use a reconexão somente se ambos perderem comunicação.'\n      :'Uma das leituras Smart Life não está confirmada. Reconecte apenas se EKAZA e Weather2-2 estiverem sem comunicação.';\n  }`;
  if(!app.includes(oldRender))throw new Error('renderSystem não encontrado para sincronizar o estado Smart Life.');
  app=app.replace(oldRender,newRender);
}

if(!app.includes('async function startSmartLifeReconnect(){')){
  const insert=`\nasync function startSmartLifeReconnect(){\n  const btn=$('smartLifeReconnectBtn'),area=$('smartLifeQrArea'),img=$('smartLifeQrImage'),text=$('smartLifeReconnectText'),badge=$('smartLifeReconnectBadge');\n  if(!btn||!area||!img)return;\n  btn.disabled=true;btn.textContent='Gerando QR Code...';\n  try{\n    const result=await api('/api/smartlife/reauth',{method:'POST',body:JSON.stringify({action:'start'})});\n    if(!result?.token||!result?.qr_image)throw new Error('Smart Life não retornou o QR Code.');\n    app.smartLifeReauthToken=String(result.token);\n    img.src=result.qr_image;area.hidden=false;btn.hidden=true;\n    if(text)text.textContent='QR Code gerado. Autorize no Smart Life e depois toque em “Já autorizei”.';\n    if(badge)setBadge(badge,'AGUARDANDO','warn');\n  }catch(error){\n    toast(error?.message||'Falha ao gerar QR Code do Smart Life.');\n    if(text)text.textContent=error?.message||'Falha ao iniciar a reconexão.';\n    btn.disabled=false;btn.textContent='Tentar novamente';\n  }\n}\n\nasync function finishSmartLifeReconnect(){\n  const token=String(app.smartLifeReauthToken||'');\n  const confirmBtn=$('smartLifeConfirmBtn'),text=$('smartLifeReconnectText'),badge=$('smartLifeReconnectBadge');\n  if(!token){toast('Gere um novo QR Code primeiro.');return;}\n  if(confirmBtn){confirmBtn.disabled=true;confirmBtn.textContent='Confirmando...';}\n  try{\n    const result=await api('/api/smartlife/reauth',{method:'POST',body:JSON.stringify({action:'finish',token})});\n    if(!result?.authorized){\n      if(text)text.textContent=result?.error||'A autorização ainda não foi confirmada. Tente novamente em alguns segundos.';\n      if(confirmBtn){confirmBtn.disabled=false;confirmBtn.textContent='Já autorizei';}\n      return;\n    }\n    app.smartLifeReauthToken='';\n    const area=$('smartLifeQrArea'),startBtn=$('smartLifeReconnectBtn');\n    if(area)area.hidden=true;\n    if(startBtn){startBtn.hidden=false;startBtn.disabled=false;startBtn.textContent='Reconectar Smart Life';}\n    if(text)text.textContent='Smart Life reconectada. Atualizando EKAZA e Weather2-2...';\n    if(badge)setBadge(badge,'CONECTADO','');\n    toast('Smart Life reconectada com sucesso.');\n    setTimeout(()=>{refreshAll?.();refreshServerDiagnostics?.();},1200);\n  }catch(error){\n    if(text)text.textContent=error?.message||'Falha ao confirmar a autorização.';\n    toast(error?.message||'Falha ao reconectar Smart Life.');\n    if(confirmBtn){confirmBtn.disabled=false;confirmBtn.textContent='Já autorizei';}\n  }\n}\n\nfunction cancelSmartLifeReconnect(){\n  app.smartLifeReauthToken='';\n  const area=$('smartLifeQrArea'),btn=$('smartLifeReconnectBtn');\n  if(area)area.hidden=true;\n  if(btn){btn.hidden=false;btn.disabled=false;btn.textContent='Reconectar Smart Life';}\n  renderSystem?.();\n}\n\ndocument.addEventListener('click',event=>{\n  const id=event.target?.id;\n  if(id==='smartLifeReconnectBtn')startSmartLifeReconnect();\n  else if(id==='smartLifeConfirmBtn')finishSmartLifeReconnect();\n  else if(id==='smartLifeCancelBtn')cancelSmartLifeReconnect();\n});\n`;
  const end='\n})();';
  if(!app.includes(end))throw new Error('Final do app.js não encontrado.');
  app=app.replace(end,insert+end);
}

fs.writeFileSync(appFile,app);
console.log('[Fazenda 2E] UI de reconexão Smart Life adicionada ao Sistema e sincronizada ao estado real.');
