import { sendPushAlert, listPushSubscriptions } from './_push.js';
import { getAutomationConfig } from './_store.js';
import { sendTelegramNotification, telegramAssistantConfig } from './_telegram.js';

const recent=new Map();
const groups=new Map();
const channelRuntime={telegram:{last_success_at:null,last_error_at:null,last_error:null},push:{last_success_at:null,last_error_at:null,last_error:null},whatsapp:{last_success_at:null,last_error_at:null,last_error:null}};
function recordChannel(name,ok,error=null){const x=channelRuntime[name];if(!x)return;const now=Date.now();if(ok){x.last_success_at=now;x.last_error=null}else if(error){x.last_error_at=now;x.last_error=String(error).slice(0,180)}}
export async function notificationChannelDiagnostics(){const assistant=telegramAssistantConfig(),pushCount=(await listPushSubscriptions().catch(()=>[])).length,wa=whatsappNotificationStatus();const tg=await import('./_telegram.js').then(m=>m.telegramNotificationStatus()).catch(()=>({configured:false}));return{checked_at:Date.now(),physical_control:false,channels:{telegram:{configured:tg.configured===true,available:tg.configured===true&&assistant.enabled!==false,...channelRuntime.telegram},push:{configured:pushCount>0,available:pushCount>0,subscriptions:pushCount,...channelRuntime.push},whatsapp:{configured:wa.configured===true,available:wa.configured===true,...channelRuntime.whatsapp}}};}
export function notificationPriority(level='info'){const l=String(level);return l==='critical'?{rank:3,label:'EMERGÊNCIA',icon:'🚨',bypassCooldown:true}:l==='warning'?{rank:2,label:'ATENÇÃO',icon:'⚠️',bypassCooldown:false}:{rank:1,label:'INFORMAÇÃO',icon:'ℹ️',bypassCooldown:false};}
function groupKey(tag,category){const t=String(tag||'').replace(/-recovered|-normaliz.*|-clear.*|-\d{4}-\d{2}-\d{2}.*$/g,'');return String(category||'operational')+':'+t;}
const GROUP_TTL_MS=24*60*60*1000,GROUP_MAX=256;
function pruneGroups(now=Date.now()){for(const [key,row] of groups)if(!row||now-Number(row.at||0)>GROUP_TTL_MS)groups.delete(key);if(groups.size>GROUP_MAX){const oldest=[...groups.entries()].sort((a,b)=>Number(a[1]?.at||0)-Number(b[1]?.at||0));for(let i=0;i<oldest.length-GROUP_MAX;i++)groups.delete(oldest[i][0]);}return groups.size;}
function groupedBody(key,body,level,now=Date.now()){pruneGroups(now);const old=groups.get(key);const same=old&&old.level===level&&now-old.at<=10*60000;const count=same?old.count+1:1;groups.set(key,{at:now,count,level});pruneGroups(now);return{body:count>1?String(body)+'\n\nOcorrências semelhantes agrupadas: '+count+'.':String(body),count};}
export function notificationQueueStatus(now=Date.now()){pruneGroups(now);return{recent_keys:recent.size,active_groups:groups.size,group_ttl_hours:GROUP_TTL_MS/3600000,group_max:GROUP_MAX,policy:{critical:'imediata',warning:'prioritária com agrupamento',info:'informativa com cooldown'}};}
const categoryFor=(tag,level)=>{const t=String(tag||'');if(/recover|clear|resume|normaliz/.test(t))return'recovery';if(/rain|weather/.test(t))return'rain';if(/window.*start|first-pulse|start-delay/.test(t))return'window_start';if(/window.*end|daily-summary|finished/.test(t))return'window_end';if(level==='critical'||level==='warning'||/watchdog|fail|error|anomal|delay|offline/.test(t))return'anomalies';return'operational';};

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

export function notificationPolicy({level='info',tag='fazenda2e',whatsapp=true,force=false,alertCfg={},assistant={}}={}){
  const normalizedLevel=['critical','warning','info'].includes(String(level))?String(level):'info',category=categoryFor(tag,normalizedLevel);
  const priorityEnabled=force||({critical:alertCfg?.priorities?.critical!==false,warning:alertCfg?.priorities?.warning!==false,info:alertCfg?.priorities?.info===true})[normalizedLevel];
  const telegram=force||(assistant.enabled!==false&&(category==='operational'?normalizedLevel!=='info':assistant[category]!==false));
  return{level:normalizedLevel,category,push:priorityEnabled&&(force||alertCfg?.channels?.push!==false),whatsapp:Boolean(whatsapp&&priorityEnabled&&(force||alertCfg?.channels?.whatsapp===true)),telegram,any:Boolean((priorityEnabled&&(force||alertCfg?.channels?.push!==false))||(whatsapp&&priorityEnabled&&(force||alertCfg?.channels?.whatsapp===true))||telegram)};
}
export async function notifyIrrigation({title='Fazenda 2E',body='Atualização da irrigação.',tag='fazenda2e',level='info',url='/irrigacao/',whatsapp=true,cooldownMinutes=0,force=false}={}){
  const key=String(tag||title||'fazenda2e'),cfg=await getAutomationConfig().catch(()=>({})),assistant=telegramAssistantConfig();
  const policy=notificationPolicy({level,tag,whatsapp,force,alertCfg:cfg?.alerts||{},assistant});
  const priority=notificationPriority(policy.level),gkey=groupKey(tag,policy.category);
  if(!policy.any)return{skipped:true,reason:'no_eligible_channel',level:policy.level,category:policy.category};
  const effectiveCooldown=priority.bypassCooldown?Math.max(0.25,Number(cooldownMinutes||0)):cooldownMinutes;
  if(!cooldownAllowed(key,effectiveCooldown))return{skipped:true,reason:'cooldown',priority:priority.label,category:policy.category};
  const grouped=groupedBody(gkey,body,policy.level);body=grouped.body;
  const push=policy.push?await sendPushAlert({title,body,tag,url,level:policy.level}).catch(error=>({sent:0,error:error?.message||String(error)})):{sent:0,total:0,disabled:true};
  const wa=policy.whatsapp?await sendWhatsAppTemplate({title,body,level:policy.level}):{enabled:false,sent:false,disabled:true};
  const telegram=policy.telegram?await sendTelegramNotification({title:priority.icon+' '+priority.label+' • '+String(title||'Alerta'),text:String(body||'')}).catch(error=>({ok:false,error:error?.message||String(error)})):{ok:false,skipped:true,reason:'assistant_preference'};
  recordChannel('push',Number(push?.sent||0)>0,push?.error);recordChannel('whatsapp',wa?.sent===true,wa?.error);recordChannel('telegram',telegram?.ok===true,telegram?.error);
  return{skipped:false,push,whatsapp:wa,telegram,category:policy.category,level:policy.level,priority:priority.label,group_count:grouped.count};
}
