import fs from 'node:fs';

const H='dist/irrigacao/index.html';
const J='dist/irrigacao/app.js';
const C='dist/irrigacao/app.css';
const MARK='FAZENDA2E_OPERATIONS_CENTER_V8';

let h=fs.readFileSync(H,'utf8');
let j=fs.readFileSync(J,'utf8');
let c=fs.readFileSync(C,'utf8');

if(!h.includes(MARK)){
  const ui=`
<div id="opsCenterRoot" data-feature="${MARK}">
  <button id="opsBellBtn" class="opsBell" type="button" aria-label="Central de notificações" title="Central de notificações">
    <span class="opsBellIcon">🔔</span><span id="opsBellCount" class="opsBellCount" hidden>0</span>
  </button>

  <div id="opsShade" class="opsShade" hidden></div>

  <aside id="opsNotifications" class="opsDrawer" hidden aria-label="Central de notificações">
    <div class="opsDrawerHead"><div><small>CENTRAL</small><h3>Notificações</h3></div><button id="opsNotifClose" class="opsIconBtn" type="button">×</button></div>
    <div class="opsToolbar"><button id="opsNotifRefresh" class="secondaryBtn" type="button">Atualizar</button><button id="opsNotifRead" class="secondaryBtn" type="button">Marcar como lidas</button></div>
    <div id="opsNotifSummary" class="opsSummary">Carregando alertas…</div>
    <div id="opsNotifList" class="opsNotifList"></div>
    <button id="opsOpenSupport" class="primaryBtn opsFullBtn" type="button">Abrir logs e relatório técnico</button>
  </aside>

  <section id="opsSupport" class="opsSupport" hidden aria-label="Logs e relatório técnico">
    <div class="opsDrawerHead"><div><small>SUPORTE</small><h3>Logs e relatório técnico</h3></div><button id="opsSupportClose" class="opsIconBtn" type="button">×</button></div>
    <p class="opsHelp">Gera um retrato completo do sistema para diagnóstico: estado atual, automático, clima, EKAZA, servidor, histórico recente, incidentes, sincronização e navegador. Dados sensíveis são mascarados automaticamente.</p>
    <div class="opsToolbar opsSupportActions">
      <button id="opsGenerateReport" class="primaryBtn" type="button">Gerar relatório completo</button>
      <button id="opsCopyReport" class="secondaryBtn" type="button">Copiar tudo</button>
      <button id="opsDownloadReport" class="secondaryBtn" type="button">Baixar .txt</button>
    </div>
    <div id="opsReportMeta" class="opsSummary">Nenhum relatório gerado nesta sessão.</div>
    <textarea id="opsReportText" class="opsReportText" readonly spellcheck="false" placeholder="O relatório completo aparecerá aqui."></textarea>
  </section>
</div>
`;
  if(!h.includes('</body>'))throw new Error('body final não encontrado.');
  h=h.replace('</body>',ui+'\n</body>');
}

if(!j.includes(MARK)){
  const end='\n})();';
  if(!j.includes(end))throw new Error('Final de app.js não encontrado.');
  const code=`

// ${MARK}
const OPS_READ_KEY='fazenda2e.notifications.lastRead.v1';
const opsEl=id=>document.getElementById(id);
const opsSafeText=value=>String(value??'').replace(/[<>]/g,'');
const opsTs=value=>{const n=Number(value||0);if(n>0)return n;const p=Date.parse(String(value||''));return Number.isFinite(p)?p:0};
const opsFmt=value=>{const ts=opsTs(value);return ts?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'medium',timeZone:'America/Porto_Velho'}).format(new Date(ts)):'—'};
function opsRedact(value,depth=0){
  if(depth>12)return'[limite]';
  if(Array.isArray(value))return value.map(v=>opsRedact(v,depth+1));
  if(!value||typeof value!=='object'){
    const s=typeof value==='string'?value:'';
    if(/^f2e\./i.test(s)||/^eyJ[A-Za-z0-9_-]+\./.test(s))return'[REDACTED]';
    return value;
  }
  const out={};
  for(const [k,v] of Object.entries(value)){
    if(/token|secret|password|authorization|cookie|private.?key|refresh|credential|subscription|endpoint/i.test(k)){out[k]='[REDACTED]';continue}
    out[k]=opsRedact(v,depth+1);
  }
  return out;
}
async function opsGet(url){try{return await api(url)}catch(error){return{_error:error?.message||String(error)}}}
function opsCollectNotifications(payload){
  const out=[];
  const now=Date.now();
  const push=(level,title,message,ts,key)=>out.push({level:level||'info',title:title||'Sistema',message:message||'',ts:opsTs(ts)||now,key:key||title||message});
  for(const a of payload?.diagnostics?.alerts||[])push(a.level,'Sistema',a.message,payload?.diagnostics?.checked_at,a.key);
  for(const i of payload?.dashboard?.reports?.incidents?.open||payload?.dashboard?.incidents?.open||[])push(i.level||'warning',i.title||'Incidente ativo',i.message||i.detail||i.reason,i.opened_at||i.ts,i.id);
  const rows=payload?.history?.history||[];
  for(const row of rows){
    const type=String(row?.type||'');
    if(!/(error|failure|emergency|watchdog|rain_pause|weather_pause|offline|reconnect|recovered|interrupted|delay)/i.test(type))continue;
    let level=/(error|failure|emergency|watchdog|offline)/i.test(type)?'critical':/(pause|interrupted|delay)/i.test(type)?'warning':'info';
    push(level,type.replaceAll('_',' '),row.message||row.reason||row.detail||'Evento registrado pelo controlador.',row.ts||row.at,row.event_id||row.id||type+String(row.ts||row.at||''));
  }
  const seen=new Set();
  return out.sort((a,b)=>b.ts-a.ts).filter(item=>{const k=String(item.key)+'|'+item.ts;if(seen.has(k))return false;seen.add(k);return true}).slice(0,80);
}
function opsRenderNotifications(items){
  const list=opsEl('opsNotifList'),sum=opsEl('opsNotifSummary'),count=opsEl('opsBellCount');if(!list)return;
  const lastRead=Number(localStorage.getItem(OPS_READ_KEY)||0);
  const unread=items.filter(x=>x.ts>lastRead).length;
  if(count){count.hidden=!unread;count.textContent=unread>99?'99+':String(unread)}
  const critical=items.filter(x=>x.level==='critical').length,warning=items.filter(x=>x.level==='warning').length;
  sum.textContent=items.length?items.length+' eventos • '+critical+' críticos • '+warning+' atenção':'Nenhum alerta recente encontrado.';
  list.innerHTML=items.length?items.map(item=>'<article class="opsNotif '+opsSafeText(item.level)+'"><div class="opsNotifTop"><b>'+opsSafeText(item.title)+'</b><span>'+opsSafeText(opsFmt(item.ts))+'</span></div><p>'+opsSafeText(item.message)+'</p></article>').join(''):'<div class="opsEmpty">Tudo tranquilo por aqui.</div>';
}
async function opsRefreshNotifications(){
  const [diagnostics,dashboard,history]=await Promise.all([opsGet('/api/irrigation/diagnostics'),opsGet('/api/viveiro/dashboard'),opsGet('/api/irrigation/local-history?limit=120')]);
  const items=opsCollectNotifications({diagnostics,dashboard,history});
  window.__fazenda2eNotifications=items;opsRenderNotifications(items);return items;
}
function opsShow(id){['opsNotifications','opsSupport'].forEach(x=>{const e=opsEl(x);if(e)e.hidden=x!==id});const shade=opsEl('opsShade');if(shade)shade.hidden=false}
function opsHide(){['opsNotifications','opsSupport'].forEach(x=>{const e=opsEl(x);if(e)e.hidden=true});const shade=opsEl('opsShade');if(shade)shade.hidden=true}
async function opsGenerateSupportReport(){
  const btn=opsEl('opsGenerateReport'),meta=opsEl('opsReportMeta'),box=opsEl('opsReportText');
  if(btn)btn.disabled=true;if(meta)meta.textContent='Coletando dados do sistema…';
  const urls={
    dashboard:'/api/viveiro/dashboard',seconds:'/api/viveiro/seconds',weather:'/api/viveiro/weather',diagnostics:'/api/irrigation/diagnostics',
    history:'/api/irrigation/local-history?limit=500',monitor:'/api/irrigation/monitor',python:'/api/irrigation/python-controller',config:'/api/irrigation/config',device:'/api/viveiro/device',forecast:'/api/weather/forecast'
  };
  const entries=await Promise.all(Object.entries(urls).map(async([k,u])=>[k,await opsGet(u)]));
  const data=Object.fromEntries(entries);
  const notifications=opsCollectNotifications({diagnostics:data.diagnostics,dashboard:data.dashboard,history:data.history});
  const report={
    report:'Fazenda 2E - Relatório técnico de suporte',
    version:'operations-center-v8',
    generated_at:new Date().toISOString(),
    generated_local:opsFmt(Date.now()),
    browser:{userAgent:navigator.userAgent,language:navigator.language,online:navigator.onLine,visibility:document.visibilityState,url:location.pathname,serviceWorker:Boolean(navigator.serviceWorker?.controller)},
    notifications,
    ...data
  };
  const safe=opsRedact(report);
  const text='FAZENDA 2E — RELATÓRIO TÉCNICO COMPLETO\nGerado: '+opsFmt(Date.now())+'\nObservação: credenciais e dados sensíveis são mascarados.\n\n'+JSON.stringify(safe,null,2);
  window.__fazenda2eSupportText=text;if(box)box.value=text;
  if(meta){const failures=Object.values(data).filter(v=>v&&v._error).length;meta.textContent='Relatório gerado • '+Object.keys(data).length+' fontes • '+notifications.length+' eventos • '+failures+' fonte(s) com erro'}
  if(btn)btn.disabled=false;return text;
}
async function opsCopyReport(){
  let text=window.__fazenda2eSupportText||opsEl('opsReportText')?.value||'';if(!text)text=await opsGenerateSupportReport();
  try{await navigator.clipboard.writeText(text);toast('Relatório copiado. Agora é só colar e me enviar.')}catch{const box=opsEl('opsReportText');box?.focus();box?.select();document.execCommand('copy');toast('Relatório copiado.')}
}
async function opsDownloadReport(){
  let text=window.__fazenda2eSupportText||opsEl('opsReportText')?.value||'';if(!text)text=await opsGenerateSupportReport();
  const blob=new Blob([text],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='fazenda2e-relatorio-'+new Date().toISOString().replace(/[:.]/g,'-')+'.txt';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
setTimeout(()=>{
  opsEl('opsBellBtn')?.addEventListener('click',()=>{opsShow('opsNotifications');opsRefreshNotifications().catch(()=>null)});
  opsEl('opsNotifClose')?.addEventListener('click',opsHide);opsEl('opsSupportClose')?.addEventListener('click',opsHide);opsEl('opsShade')?.addEventListener('click',opsHide);
  opsEl('opsNotifRefresh')?.addEventListener('click',()=>opsRefreshNotifications().catch(e=>toast(e.message||'Falha ao atualizar')));
  opsEl('opsNotifRead')?.addEventListener('click',()=>{localStorage.setItem(OPS_READ_KEY,String(Date.now()));opsRenderNotifications(window.__fazenda2eNotifications||[]);toast('Notificações marcadas como lidas.')});
  opsEl('opsOpenSupport')?.addEventListener('click',()=>{opsShow('opsSupport');opsGenerateSupportReport().catch(e=>toast(e.message||'Falha ao gerar relatório'))});
  opsEl('opsGenerateReport')?.addEventListener('click',()=>opsGenerateSupportReport().catch(e=>{const m=opsEl('opsReportMeta');if(m)m.textContent='Falha: '+(e.message||e)}));
  opsEl('opsCopyReport')?.addEventListener('click',()=>opsCopyReport());opsEl('opsDownloadReport')?.addEventListener('click',()=>opsDownloadReport());
  opsRefreshNotifications().catch(()=>null);setInterval(()=>opsRefreshNotifications().catch(()=>null),60000);
},1200);
`;
  j=j.replace(end,code+end);
}

if(!c.includes(MARK))c+=`
/* ${MARK} */
.opsBell{position:fixed;right:18px;top:max(18px,env(safe-area-inset-top));z-index:86;width:48px;height:48px;border:1px solid #d9e5df;border-radius:16px;background:#fff;box-shadow:0 8px 26px rgba(20,55,38,.16);display:grid;place-items:center;font-size:21px}.opsBell:active{transform:scale(.97)}.opsBellCount{position:absolute;right:-5px;top:-5px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#b42318;color:#fff;border:2px solid #fff;font-size:10px;font-weight:800;line-height:16px;text-align:center}.opsShade{position:fixed;inset:0;z-index:90;background:rgba(7,22,15,.42);backdrop-filter:blur(2px)}.opsDrawer,.opsSupport{position:fixed;z-index:91;background:#fff;box-shadow:0 0 36px rgba(9,33,21,.22);overflow:auto}.opsDrawer{right:0;top:0;bottom:0;width:min(92vw,430px);padding:max(20px,env(safe-area-inset-top)) 18px max(22px,env(safe-area-inset-bottom))}.opsSupport{left:50%;top:50%;transform:translate(-50%,-50%);width:min(94vw,900px);max-height:90vh;border-radius:22px;padding:20px}.opsDrawerHead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.opsDrawerHead small{font-size:10px;font-weight:800;letter-spacing:.14em;color:#2b7652}.opsDrawerHead h3{margin:3px 0 0;font-size:21px}.opsIconBtn{border:0;background:#eef4f1;border-radius:12px;width:38px;height:38px;font-size:24px;line-height:1}.opsToolbar{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.opsToolbar button{min-height:38px}.opsSummary{font-size:11px;color:#63746b;background:#f4f7f5;border:1px solid #e3eae6;border-radius:12px;padding:9px 10px;margin:10px 0}.opsNotifList{display:grid;gap:8px;margin:12px 0 16px}.opsNotif{border:1px solid #e5ebe8;border-left:4px solid #789184;border-radius:12px;padding:10px;background:#fff}.opsNotif.critical{border-left-color:#b42318;background:#fff7f6}.opsNotif.warning{border-left-color:#b7791f;background:#fffaf0}.opsNotif.info{border-left-color:#2f6f9f}.opsNotifTop{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.opsNotifTop b{font-size:12px}.opsNotifTop span{font-size:9px;color:#7b8982;white-space:nowrap}.opsNotif p{margin:5px 0 0;font-size:11px;line-height:1.4;color:#4d5f56}.opsFullBtn{width:100%;min-height:44px}.opsHelp{font-size:12px;line-height:1.5;color:#5f6f67}.opsSupportActions{position:sticky;top:-20px;background:#fff;padding:10px 0;z-index:2}.opsReportText{width:100%;height:min(56vh,620px);resize:vertical;border:1px solid #dce5e0;border-radius:14px;padding:12px;background:#0f1713;color:#d9efe3;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;box-sizing:border-box}.opsEmpty{text-align:center;color:#74827b;padding:28px 10px;font-size:12px}@media(max-width:640px){.opsBell{right:12px;top:max(12px,env(safe-area-inset-top));width:44px;height:44px;border-radius:14px}.opsSupport{width:100vw;height:100dvh;max-height:none;border-radius:0;padding:max(16px,env(safe-area-inset-top)) 14px max(16px,env(safe-area-inset-bottom));box-sizing:border-box}.opsSupportActions button{flex:1 1 100%}.opsReportText{height:58vh}}
`;

h=h.replace(/\/irrigacao\/app\.js\?v=[^\"]+/,'/irrigacao/app.js?v=20260912-ops8');
h=h.replace(/\/irrigacao\/app\.css\?v=[^\"]+/,'/irrigacao/app.css?v=20260912-ops8');
fs.writeFileSync(H,h);fs.writeFileSync(J,j);fs.writeFileSync(C,c);
console.log('[Fazenda 2E] Central de notificações e suporte v8 instalada.');
