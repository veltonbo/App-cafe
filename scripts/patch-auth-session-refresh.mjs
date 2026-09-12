import fs from 'node:fs';
import path from 'node:path';

const appFile=path.resolve('dist/irrigacao/app.js');
if(!fs.existsSync(appFile)) throw new Error('dist/irrigacao/app.js não encontrado.');
let app=fs.readFileSync(appFile,'utf8');

// When an API call gets 401/403, the browser may still hold an expired Fazenda 2E
// session token. Force one secure-session refresh and retry once instead of leaving
// the System page stuck as "Indisponível".
if(!app.includes('async function apiWithSessionRetry(')){
  const marker='async function api(path,opt={}){';
  const idx=app.indexOf(marker);
  if(idx<0) throw new Error('Função api() não encontrada.');

  // Rename the existing low-level API function so we can wrap it safely.
  app=app.replace(marker,'async function apiRaw(path,opt={}){');

  const next='\nfunction num';
  const end=app.indexOf(next,idx);
  if(end<0) throw new Error('Fim da função api() não encontrado.');

  const wrapper=`\nasync function apiWithSessionRetry(path,opt={}){\n  try{\n    return await apiRaw(path,opt);\n  }catch(error){\n    const msg=String(error?.message||error||'');\n    const unauthorized=/\\b(401|403)\\b|não autorizado|unauthorized|forbidden/i.test(msg);\n    if(!unauthorized||opt.__sessionRetry)return Promise.reject(error);\n    try{\n      store.settings.token='';\n      app.sessionReady=false;\n      app.authChecked=false;\n      await ensureSecureSession();\n      if(!hasAuth())throw error;\n      return await apiRaw(path,{...opt,__sessionRetry:true});\n    }catch(refreshError){\n      throw refreshError||error;\n    }\n  }\n}\nasync function api(path,opt={}){return apiWithSessionRetry(path,opt);}\n`;
  app=app.slice(0,end)+wrapper+app.slice(end);
}

fs.writeFileSync(appFile,app);
console.log('Auth session retry patch aplicado.');
