import fs from 'node:fs';

const H='dist/irrigacao/index.html';
const J='dist/irrigacao/app.js';
const C='dist/irrigacao/app.css';
const MARK='FAZENDA2E_UI_AUTOMATIC4_ONLY_V1';

let h=fs.readFileSync(H,'utf8');
let j=fs.readFileSync(J,'utf8');
let c=fs.readFileSync(C,'utf8');

if(!h.includes(MARK)){
  h=h.replaceAll('AUTOMÁTICO 2.0','AUTOMÁTICO 4.0');
  h=h.replaceAll('Automático 2.0','Automático 4.0');
  h=h.replaceAll('Ajustes Auto 2.0','Decisões Auto 4.0');
  h=h.replaceAll('AUTOMÁTICO 4.0 • SOMBRA','AUTOMÁTICO 4.0 • ATIVO');
  h=h.replaceAll('>SOMBRA<','>ATIVO<');
  h=h.replace('<span id="autoConfigState" class="badge">—</span>','<span id="autoConfigState" class="badge">ATIVO</span>');
  const mode='<div class="segmented" id="autoMode">';
  if(h.includes(mode)) h=h.replace(mode,`<div class="auto4OnlyNotice" data-version="${MARK}"><b>Automático 4.0 é o único controlador climático.</b><span>Ele decide se precisa irrigar, reduzir a frequência ou manter o viveiro desligado e reavaliar depois.</span></div><div class="segmented auto4LegacyHidden" id="autoMode">`);
  h=h.replace('<div class="fieldGrid two compactFields">\n          <label><span>Avaliar a cada</span>','<div class="fieldGrid two compactFields auto4LegacyHidden">\n          <label><span>Avaliar a cada</span>');
  h=h.replace('<button id="saveAutoBtn" class="primaryBtn full" type="button">Salvar Automático 4.0</button>','<button id="saveAutoBtn" class="primaryBtn full auto4LegacyHidden" type="button">Salvar Automático 4.0</button>');
}

j=j.replaceAll("'Automático 2.0'","'Automático 4.0'");
j=j.replaceAll('Automático 2.0','Automático 4.0');
j=j.replaceAll('AUTOMÁTICO 4.0 • SOMBRA','AUTOMÁTICO 4.0 • ATIVO');
j=j.replaceAll("'SOMBRA'","'ATIVO'");

if(!c.includes(MARK)) c+=`\n/* ${MARK} */\n.auto4LegacyHidden{display:none!important}.auto4OnlyNotice{display:flex;flex-direction:column;gap:6px;padding:14px 16px;margin:12px 0;border-radius:14px;background:rgba(40,120,70,.08);border:1px solid rgba(40,120,70,.18)}.auto4OnlyNotice b{font-size:14px}.auto4OnlyNotice span{font-size:12px;line-height:1.45;opacity:.8}\n`;

fs.writeFileSync(H,h);
fs.writeFileSync(J,j);
fs.writeFileSync(C,c);
console.log('[Fazenda 2E] UI ajustada para Automático 4.0 exclusivo.');
