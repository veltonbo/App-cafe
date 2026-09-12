import fs from 'node:fs';
import path from 'node:path';

const appFile=path.resolve('dist/irrigacao/app.js');
if(!fs.existsSync(appFile))throw new Error('dist/irrigacao/app.js não encontrado.');
let app=fs.readFileSync(appFile,'utf8');

const legacyBypass="  if(String(store.settings.token||'').startsWith('f2e.')){app.sessionReady=false;app.authChecked=true;return true;}\n";
if(app.includes(legacyBypass))app=app.replace(legacyBypass,'');

fs.writeFileSync(appFile,app);
console.log('Sessão segura do Viveiro restaurada: token local volta a ser trocado por cookie HttpOnly.');
