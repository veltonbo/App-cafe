function configured(){return Boolean(String(process.env.TELEGRAM_BOT_TOKEN||'').trim()&&String(process.env.TELEGRAM_CHAT_ID||'').trim())}
export async function telegramNotificationStatus(){return{provider:'telegram',configured:configured(),enabled:configured(),mode:configured()?'bot':'not_configured'}}
export async function sendTelegramNotification({text,title}={}){
  const token=String(process.env.TELEGRAM_BOT_TOKEN||'').trim(),chatId=String(process.env.TELEGRAM_CHAT_ID||'').trim();
  if(!token||!chatId)return{ok:false,skipped:true,reason:'not_configured'};
  const body={chat_id:chatId,text:[title,text].filter(Boolean).join('\n').slice(0,4000),disable_web_page_preview:true};
  const response=await fetch('https://api.telegram.org/bot'+encodeURIComponent(token)+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error('Telegram HTTP '+response.status);return{ok:true};
}
