import { sendPushAlert } from './_push.js';
import { getAutomationConfig } from './_store.js';

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

function pruneRecent(now=Date.now()){
  if(recent.size<512)return;
  for(const [key,at] of recent){
    if(now-Number(at||0)>24*60*60*1000)recent.delete(key);
  }
  if(recent.size<=512)return;
  const oldest=[...recent.entries()].sort((a,b)=>Number(a[1]||0)-Number(b[1]||0));
  for(const [key] of oldest.slice(0,recent.size-512))recent.delete(key);
}

function cooldownAllowed(key,cooldownMinutes){
  const now=Date.now();
  pruneRecent(now);
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
  cooldownMinutes=0,
  force=false
}={}){
  const key=String(tag||title||'fazenda2e');
  if(!cooldownAllowed(key,cooldownMinutes)){
    return{skipped:true,reason:'cooldown'};
  }

  const cfg=await getAutomationConfig().catch(()=>({}));
  const alertCfg=cfg?.alerts||{};
  const priorities={
    critical:alertCfg?.priorities?.critical!==false,
    warning:alertCfg?.priorities?.warning!==false,
    info:alertCfg?.priorities?.info===true
  };
  const channels={
    push:alertCfg?.channels?.push!==false,
    whatsapp:alertCfg?.channels?.whatsapp===true
  };
  const normalizedLevel=['critical','warning','info'].includes(String(level))?String(level):'info';
  if(!force&&!priorities[normalizedLevel]){
    return{skipped:true,reason:'priority_disabled',level:normalizedLevel};
  }

  const push=channels.push||force
    ?await sendPushAlert({title,body,tag,url,level:normalizedLevel}).catch(error=>({sent:0,error:error?.message||String(error)}))
    :{sent:0,total:0,disabled:true};
  const wa=(whatsapp&&(channels.whatsapp||force))
    ?await sendWhatsAppTemplate({title,body,level:normalizedLevel})
    :{enabled:false,sent:false,disabled:true};
  return{skipped:false,push,whatsapp:wa,level:normalizedLevel};
}
