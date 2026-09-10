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
fs.writeFileSync(appFile,app);

console.log('Irrigação: interface validada com login Firebase e sessão bearer compatível com HTTP.');
