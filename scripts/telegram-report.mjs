import {readFile} from 'node:fs/promises';
const data=process.env.FAZENDA2E_DATA_DIR||'/home/ubuntu/fazenda2e-data';
async function txt(p){try{return (await readFile(p,'utf8')).trim()}catch{return''}}
async function cfg(){const token=await txt(`${data}/guardian-telegram-bot-token`);const chat=await txt(`${data}/guardian-telegram-chat-id`);return{token,chat}}
export async function sendReport({title='Fazenda 2E • Relatório',text=''}){const {token,chat}=await cfg();if(!token||!chat)return{ok:false,reason:'telegram_not_bound'};const body={chat_id:chat,text:`${title}\n\n${text}`.slice(0,4000),disable_web_page_preview:true};const r=await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error(`Telegram HTTP ${r.status}`);return{ok:true}}
if(import.meta.url===`file://${process.argv[1]}`){const title=process.argv[2]||'Fazenda 2E • Relatório',text=process.argv.slice(3).join(' ')||await txt(`${data}/quality-agent-summary.txt`);console.log(JSON.stringify(await sendReport({title,text})))}
