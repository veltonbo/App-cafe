import fs from 'node:fs';

const smartFile='server/api/_smartlife.js';
const appFile='dist/irrigacao/app.js';
const htmlFile='dist/irrigacao/index.html';

let smart=fs.readFileSync(smartFile,'utf8');
const oldStart=`export async function smartLifeReauthStart(){\n  const session=await loadSession();\n  if(!session)throw new Error('Não há uma sessão Smart Life anterior para recuperar o User Code.');\n  const result=await queuedBridge({action:'reauth_start',client_id:session.client_id||'HA_3y9q4ak7g4ephrvke',user_code:session.user_code});\n  return{ok:true,token:result.token,qr_data:result.qr_data,qr_image:result.qr_image};\n}`;
const newStart=`export async function smartLifeReauthStart(){\n  const session=await loadSession();\n  if(!session)throw new Error('Não há uma sessão Smart Life anterior para recuperar o User Code.');\n  const request={action:'reauth_start',client_id:session.client_id||'HA_3y9q4ak7g4ephrvke',user_code:session.user_code};\n  let result=null;\n  for(let attempt=0;attempt<2;attempt++){\n    result=await queuedBridge(request,{timeoutMs:30000});\n    if(result?.token&&result?.qr_image)break;\n  }\n  if(!result?.token||!result?.qr_image){\n    throw new Error('Smart Life respondeu sem QR Code completo. Tente novamente em alguns segundos.');\n  }\n  return{ok:true,token:String(result.token),qr_data:String(result.qr_data||''),qr_image:String(result.qr_image)};\n}`;
if(smart.includes(oldStart))smart=smart.replace(oldStart,newStart);
else if(!smart.includes('Smart Life respondeu sem QR Code completo'))throw new Error('smartLifeReauthStart não encontrado.');
fs.writeFileSync(smartFile,smart);

let app=fs.readFileSync(appFile,'utf8');
const oldCheck=`    const result=await api('/api/smartlife/reauth',{method:'POST',body:JSON.stringify({action:'start'})});\n    if(!result?.token||!result?.qr_image)throw new Error('Smart Life não retornou o QR Code.');\n    app.smartLifeReauthToken=String(result.token);\n    img.src=result.qr_image;area.hidden=false;btn.hidden=true;`;
const newCheck=`    const result=await api('/api/smartlife/reauth',{method:'POST',body:JSON.stringify({action:'start'})});\n    const payload=result?.result||result?.data||result||{};\n    const token=payload?.token||payload?.qr_token||payload?.qrcode_token;\n    const qrImage=payload?.qr_image||payload?.qrImage||payload?.image;\n    if(!token||!qrImage)throw new Error(result?.error||payload?.error||'Smart Life não retornou o QR Code completo.');\n    app.smartLifeReauthToken=String(token);\n    img.src=String(qrImage);area.hidden=false;btn.hidden=true;`;
if(app.includes(oldCheck))app=app.replace(oldCheck,newCheck);
else if(!app.includes('const payload=result?.result||result?.data||result||{}'))throw new Error('Fluxo de QR Smart Life não encontrado no app gerado.');
fs.writeFileSync(appFile,app);

let html=fs.readFileSync(htmlFile,'utf8');
html=html.replace(/\/irrigacao\/app\.js\?v=[^\"]+/,'/irrigacao/app.js?v=20260912-reauth2');
fs.writeFileSync(htmlFile,html);

console.log('[Fazenda 2E] Reconexão Smart Life reforçada e cache do app atualizado.');
