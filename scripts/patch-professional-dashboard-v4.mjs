import fs from 'node:fs';
const htmlFile='dist/irrigacao/index.html',appFile='dist/irrigacao/app.js',cssFile='dist/irrigacao/app.css';
let html=fs.readFileSync(htmlFile,'utf8'),app=fs.readFileSync(appFile,'utf8'),css=fs.readFileSync(cssFile,'utf8');
const marker='<div id="auto3ShadowBox" class="auto3Box">';
if(html.includes(marker)&&!html.includes('id="auto4DecisionCenter"')){
  html=html.replace(marker,`<div id="auto4DecisionCenter" class="auto4DecisionCenter">
    <div class="auto4Head"><div><small>AUTOMÁTICO 4.0 • INTELIGÊNCIA</small><h3>Central de decisões</h3></div><span class="badge">SOMBRA</span></div>
    <div class="auto4Decision"><strong id="auto4Decision">OBSERVANDO</strong><span id="auto4Confidence">Confiança —</span></div>
    <p id="auto4Reason">O 4.0 está analisando clima, tendência e histórico sem controlar a bomba.</p>
    <div class="auto4Metrics"><div><small>Ciclo atual</small><b id="auto4Current">—</b></div><div><small>4.0 faria</small><b id="auto4Target">—</b></div><div><small>Demanda</small><b id="auto4Demand">—</b></div><div><small>Segurança</small><b>5 camadas</b></div></div>
    <div id="auto4Factors" class="auto4Factors"></div>
  </div>\n        ${marker}`);
}
const renderMarker='function renderAuto3(){';
if(app.includes(renderMarker)&&!app.includes('function renderAuto4(){')){
  app=app.replace(renderMarker,`function renderAuto4(){
  const a=app.dashboard?.climate?.shadow4||app.dashboard?.intelligence?.auto4||{};
  const el=id=>document.getElementById(id);if(!el('auto4Decision'))return;
  el('auto4Decision').textContent=a.decision||'OBSERVANDO';
  el('auto4Confidence').textContent='Confiança '+(a.confidence_label||'—')+(Number.isFinite(Number(a.confidence_score))?' • '+a.confidence_score+'%':'');
  el('auto4Reason').textContent=a.reason||'Coletando dados para o Automático 4.0.';
  el('auto4Current').textContent=a.current_on_seconds?a.current_on_seconds+'/'+a.current_off_seconds+' s':'—';
  el('auto4Target').textContent=a.target_on_seconds?a.target_on_seconds+'/'+a.target_off_seconds+' s':'—';
  el('auto4Demand').textContent=Number.isFinite(Number(a.demand_percent))?(a.demand_percent>0?'+':'')+a.demand_percent+'%':'—';
  el('auto4Factors').innerHTML=(a.factors||[]).slice(0,4).map(x=>'<span>'+esc(String(x))+'</span>').join('');
}

${renderMarker}`);
  app=app.replace(/renderAuto3\(\);/g,'renderAuto4();renderAuto3();');
}
if(!css.includes('professional-dashboard-v4'))css+=`\n/* professional-dashboard-v4 */
.auto4DecisionCenter{margin:14px 0;padding:16px;border-radius:18px;background:linear-gradient(145deg,#f4faf7,#fff);border:1px solid #dbe8e2;box-shadow:0 8px 24px rgba(25,70,52,.07)}
.auto4Head,.auto4Decision{display:flex;justify-content:space-between;align-items:center;gap:10px}.auto4Head small{color:var(--green);font-weight:900;letter-spacing:.12em;font-size:.48rem}.auto4Head h3{margin:3px 0 0;font-size:.9rem}.auto4Decision{margin-top:14px}.auto4Decision strong{font-size:1.25rem;letter-spacing:-.03em}.auto4Decision span{font-size:.52rem;color:var(--muted);font-weight:800}.auto4DecisionCenter>p{font-size:.58rem;color:#5f7169;line-height:1.45;margin:8px 0 12px}.auto4Metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.auto4Metrics>div{padding:9px;background:#fff;border:1px solid var(--line);border-radius:11px}.auto4Metrics small{display:block;color:var(--muted);font-size:.43rem}.auto4Metrics b{display:block;margin-top:4px;font-size:.64rem}.auto4Factors{display:flex;gap:5px;flex-wrap:wrap;margin-top:10px}.auto4Factors span{padding:5px 8px;border-radius:999px;background:#eaf4ef;color:#315f4c;font-size:.45rem;font-weight:750}
@media(max-width:560px){.auto4Metrics{grid-template-columns:repeat(2,1fr)}}\n`;
html=html.replace(/\/irrigacao\/app\.js\?v=[^\"]+/,'/irrigacao/app.js?v=20260912-v4');html=html.replace(/\/irrigacao\/app\.css\?v=[^\"]+/,'/irrigacao/app.css?v=20260912-v4');
fs.writeFileSync(htmlFile,html);fs.writeFileSync(appFile,app);fs.writeFileSync(cssFile,css);console.log('[Fazenda 2E] Dashboard profissional + Automático 4.0 UI aplicados.');
