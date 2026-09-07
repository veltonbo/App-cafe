import { sendPushAlert } from './_push.js';

const recent=new Map();

function whatsappConfig(){
  const token=String(process.env.WHATSAPP_CLOUD_TOKEN||'').trim();
  const phoneNumberId=String(process.env.WHATSAPP_PHONE_NUMBER_ID||'').trim();
  const to=String(process.env.WHATSAPP_TO||'').replace(/\D/g,'');
  const templateName=String(process.env.WHATSAPP_TEMPLATE_NAME||'').trim();
  const language=String(process.env.WHATSAPP_TEMPLATE_LANGUAGE||'pt_BR').trim()||'pt_BR';
  const version=String(process.env.WHATSAPP_GRAPH_VERSION||'v26.0').trim()||'v26.0';
  return{token,phoneNumberId,to,templateName,language,version,enabled:Boolean(token&&phoneNumberId&&to&&templateName)};
}

export function whatsappNotificationStatus(){
  const cfg=whatsappConfig();
  return{
    configured:cfg.enabled,
    phone_number_configured:Boolean(cfg.phoneNumberId),
    recipient_configured:Boolean(cfg.to),
    template_configured:Boolean(cfg.templateName),
    graph_version:cfg.version
  };
}

async function sendWhatsAppTemplate({title,body,level='info'}={}){
  const cfg=whatsappConfig();
  if(!cfg.enabled)return{enabled:false,sent:false};
  const url='https://graph.facebook.com/'+encodeURIComponent(cfg.version)+'/'+encodeURIComponent(cfg.phoneNumberId)+'/messages';
  try{
    const response=await fetch(url,{
      method:'POST',
      headers:{
        'Authorization':'Bearer '+cfg.token,
        'Content-Type':'application/json'
      },
      body:JSON.stringify({
        messaging_product:'whatsapp',
        recipient_type:'individual',
        to:cfg.to,
        type:'template',
        template:{
          name:cfg.templateName,
          language:{code:cfg.language},
          components:[{
            type:'body',
            parameters:[
              {type:'text',text:String(title||'Fazenda 2E').slice(0,180)},
              {type:'text',text:String(body||'Atualização da irrigação.').slice(0,900)},
              {type:'text',text:String(level||'info').slice(0,40)}
            ]
          }]
        }
      })
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){
      return{enabled:true,sent:false,status:response.status,error:payload?.error?.message||('HTTP '+response.status)};
    }
    return{enabled:true,sent:true,id:payload?.messages?.[0]?.id||null};
  }catch(error){
    return{enabled:true,sent:false,error:error?.message||String(error)};
  }
}

function cooldownAllowed(key,cooldownMinutes){
  const now=Date.now();
  const last=Number(recent.get(key)||0);
  const cooldown=Math.max(0,Number(cooldownMinutes||0))*60000;
  if(cooldown&&last&&now-last<cooldown)return false;
  recent.set(key,now);
  return true;
}

export async function notifyIrrigation({
  title='Fazenda 2E',
  body='Atualização da irrigação.',
  tag='fazenda2e',
  level='info',
  url='/irrigacao/',
  whatsapp=true,
  cooldownMinutes=0
}={}){
  const key=String(tag||title||'fazenda2e');
  if(!cooldownAllowed(key,cooldownMinutes)){
    return{skipped:true,reason:'cooldown'};
  }
  const push=await sendPushAlert({title,body,tag,url,level}).catch(error=>({sent:0,error:error?.message||String(error)}));
  const wa=whatsapp?await sendWhatsAppTemplate({title,body,level}):{enabled:false,sent:false};
  return{skipped:false,push,whatsapp:wa};
}
