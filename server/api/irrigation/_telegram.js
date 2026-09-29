import fs from 'node:fs';
import path from 'node:path';
const DATA=process.env.FAZENDA2E_DATA_DIR||'/data',CHAT=path.join(DATA,'guardian-telegram-chat-id'),TOKEN=path.join(DATA,'guardian-telegram-bot-token'),ASSIST=path.join(DATA,'telegram-assistant-config.json');
const defaults={enabled:true,rain:true,window_start:true,window_end:true,recovery:true,anomalies:true,morning_summary:true,evening_summary:true};
const read=p=>{try{return fs.readFileSync(p,'utf8').trim()}catch{return''}};
function token(){return String(read(TOKEN)||process.env.TELEGRAM_BOT_TOKEN||'').trim()}
function chat(){return String(process.env.TELEGRAM_CHAT_ID||read(CHAT)||'').trim()}
export function telegramAssistantConfig(){try{return{...defaults,...JSON.parse(read(ASSIST)||'{}')}}catch{return{...defaults}}}
export function telegramConfigured(){return Boolean(token()&&chat())}
export async function telegramNotificationStatus(){return{provider:'telegram',configured:telegramConfigured(),enabled:telegramConfigured()&&telegramAssistantConfig().enabled!==false,mode:telegramConfigured()?'bot':'not_configured'}}
export async function sendTelegramNotification({text,title}={}){const tk=token(),id=chat();if(!tk||!id)return{ok:false,skipped:true,reason:'not_configured'};const body={chat_id:id,text:[title,text].filter(Boolean).join('\n').slice(0,4000),disable_web_page_preview:true};const response=await fetch('https://api.telegram.org/bot'+encodeURIComponent(tk)+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error('Telegram HTTP '+response.status);return{ok:true}}
