import { listInkbirdDevices } from '../api/inkbird/_device.js';
import { readInkbirdState } from '../api/inkbird/_transport.js';
import { fetchWeatherSnapshot } from '../api/weather/_weather.js';
import { appendHistory, getAutomationConfig, storeGet, storeSet } from '../api/irrigation/_store.js';
import { notifyIrrigation } from '../api/irrigation/_notify.js';
import { CAFE_ROOT, getCafeActiveSession, getCafeScheduleCache } from './state.js';

const TZ='America/Porto_Velho';
const AUDIT_PATH=CAFE_ROOT+'/audit/state';
const INCIDENT_ROOT=CAFE_ROOT+'/incidents';

function historyRows(raw){
  if(!raw||typeof raw!=='object')return[];
  return Object.entries(raw)
    .map(([id,value])=>({id,...(value||{})}))
    .filter(row=>String(row.app||'cafe')==='cafe')
    .sort((a,b)=>Number(b.ts||Date.parse(b.at||0)||0)-Number(a.ts||Date.parse(a.at||0)||0));
}

function localParts(ts=Date.now()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
    timeZone:TZ,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(new Date(ts)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  const dayMap={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  return{weekday:dayMap[parts.weekday]??0,minutes:Number(parts.hour)*60+Number(parts.minute)};
}

function localDayKey(ts=Date.now()){
  return new Intl.DateTimeFormat('en-CA',{
    timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'
  }).format(new Date(ts));
}

function dayStartUtcApprox(key,minuteOfDay){
  const [y,m,d]=String(key).split('-').map(Number);
  // Porto Velho não usa horário de verão: UTC-4.
  return Date.UTC(y,m-1,d,4,0,0,0)+Number(minuteOfDay||0)*60000;
}

function previousLocalDay(key,days){
  const [y,m,d]=String(key).split('-').map(Number);
  const date=new Date(Date.UTC(y,m-1,d,12)-days*86400000);
  return new Intl.DateTimeFormat('en-CA',{timeZone:'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}

function startsFromHistory(history){
  return history.filter(row=>['start','group_start'].includes(String(row.type||'')));
}

function sectorsFromRow(row){
  const out=[];
  if(Number(row.sector)>0)out.push({sector:Number(row.sector),duration:Number(row.duration_minutes||0)});
  if(Array.isArray(row.zones)){
    const index=Math.max(1,Number(row.controller_index||1));
    for(const item of row.zones){
      const zone=Number(item?.zone);
      if(zone>=1&&zone<=8){
        out.push({
          sector:(index-1)*8+zone,
          duration:Number(item?.duration_minutes||0)
        });
      }
    }
  }
  return out;
}

export function buildSectorActivity(history=[],controllers=[],now=Date.now()){
  const cutoff=now-7*86400000;
  const result={};
  for(const controller of controllers){
    const id=String(controller.id||'');
    result[id]={};
    for(let zone=1;zone<=8;zone++){
      const sector=Number(controller.sector_start||1)+zone-1;
      result[id][zone]={
        controller_id:id,
        controller_index:Number(controller.controller_index||1),
        zone,
        sector,
        last_start_at:null,
        starts_7d:0,
        planned_minutes_7d:0
      };
    }
  }

  for(const row of startsFromHistory(history)){
    const ts=Number(row.ts||Date.parse(row.at||0)||0);
    const id=String(row.controller_id||'');
    const controller=controllers.find(c=>String(c.id)===id);
    if(!controller)continue;
    const sectors=sectorsFromRow(row);
    for(const item of sectors){
      const zone=item.sector-Number(controller.sector_start||1)+1;
      const target=result[id]?.[zone];
      if(!target)continue;
      if(!target.last_start_at||ts>target.last_start_at)target.last_start_at=ts;
      if(ts>=cutoff){
        target.starts_7d+=1;
        target.planned_minutes_7d+=Math.max(0,Number(item.duration||row.duration_minutes||0));
      }
    }
  }
  return result;
}

function latestScheduledOccurrence(schedule,now=Date.now()){
  if(!schedule?.enabled||!Array.isArray(schedule.start_times)||!schedule.start_times.length)return null;
  const mask=Math.max(0,Number(schedule.days_mask??127));
  const current=localParts(now);
  const todayKey=localDayKey(now);
  let latest=null;

  for(let back=0;back<8;back++){
    const key=previousLocalDay(todayKey,back);
    const dow=(current.weekday-back+7*8)%7;
    if(!(mask&(1<<dow)))continue;
    for(const raw of schedule.start_times){
      const time=String(typeof raw==='string'?raw:raw?.value||'');
      const match=time.match(/^(\d{2}):(\d{2})$/);
      if(!match)continue;
      const minutes=Number(match[1])*60+Number(match[2]);
      const at=dayStartUtcApprox(key,minutes);
      if(at<=now&&(!latest||at>latest))latest=at;
    }
  }
  return latest;
}

export function evaluateCafeAudit({
  controllers=[],
  states={},
  activeSessions={},
  weather=null,
  history=[],
  schedules={},
  bootTimes=[],
  now=Date.now()
}={}){
  const issues=[];

  if(!controllers.length){
    issues.push({level:'critical',code:'controller_missing',message:'Nenhum IIC-800 foi encontrado no Smart Life.'});
  }

  for(const controller of controllers){
    const id=String(controller.id||'');
    if(controller.online===false){
      issues.push({
        level:'critical',
        code:'controller_offline_'+id,
        message:(controller.name||'IIC-800')+' está offline.'
      });
      continue;
    }
    const state=states[id];
    if(!state){
      issues.push({
        level:'critical',
        code:'controller_read_failed_'+id,
        message:'Não foi possível confirmar o estado do '+(controller.name||'IIC-800')+'.'
      });
      continue;
    }

    const session=activeSessions[id];
    const activeMask=Number(state.runtime?.active_mask||0);
    const pendingMask=Number(state.runtime?.pending_mask||0);
    if(session){
      const expected=Number(session.expected_end_at||0);
      if(expected&&now>expected+5*60000&&(activeMask||pendingMask)){
        issues.push({
          level:'critical',
          code:'irrigation_overdue_'+id,
          message:'Irrigação do '+(controller.name||'IIC-800')+' continua ativa mais de 5 min após o término previsto.'
        });
      }
      if(expected&&now>expected+10*60000&&!activeMask&&!pendingMask){
        issues.push({
          level:'warning',
          code:'session_stale_'+id,
          message:'Existe uma sessão antiga do '+(controller.name||'IIC-800')+' aguardando fechamento.'
        });
      }
    }
  }

  const weatherAt=Number(weather?.checked_at||0);
  if(!weather?.linked||weather?.device?.online===false||weather?.error){
    issues.push({level:'critical',code:'weather_offline',message:'Weather2-2 sem comunicação.'});
  }else if(weatherAt&&now-weatherAt>15*60000){
    issues.push({level:'warning',code:'weather_stale',message:'Weather2-2 está há mais de 15 min sem atualização.'});
  }

  const recent30=history.filter(row=>now-Number(row.ts||Date.parse(row.at||0)||0)<30*60000);
  const failures=recent30.filter(row=>
    String(row.type||'').includes('error')||String(row.status||'').includes('error')
  );
  if(failures.length>=2){
    issues.push({level:'critical',code:'repeated_failures',message:'Foram registradas falhas repetidas no Café nos últimos 30 minutos.'});
  }

  const starts30=recent30.filter(row=>['start','group_start'].includes(String(row.type||'')));
  if(starts30.length>=8){
    issues.push({level:'warning',code:'many_starts',message:'O IIC-800 iniciou muitas irrigações nos últimos 30 minutos.'});
  }

  if((bootTimes||[]).filter(ts=>now-Number(ts)<60*60000).length>=3){
    issues.push({level:'warning',code:'restarts_excessive',message:'O serviço do Café reiniciou várias vezes na última hora.'});
  }

  const activity=buildSectorActivity(history,controllers,now);
  for(const controller of controllers){
    const cache=schedules[String(controller.id)]||{};
    for(const [zoneKey,schedule] of Object.entries(cache)){
      const zone=Number(zoneKey);
      if(zone<1||zone>8||schedule?.enabled!==true)continue;
      const due=latestScheduledOccurrence(schedule,now);
      if(!due||now-due<30*60000)continue;
      const last=Number(activity[String(controller.id)]?.[zone]?.last_start_at||0);
      if(!last||last<due-5*60000){
        const sector=Number(controller.sector_start||1)+zone-1;
        issues.push({
          level:'warning',
          code:'schedule_missed_'+String(controller.id)+'_'+zone,
          message:'Setor '+String(sector).padStart(2,'0')+' não tem início registrado após a última programação prevista.'
        });
      }
    }
  }

  const severity=issues.some(x=>x.level==='critical')?'critical':issues.length?'warning':'ok';
  return{
    status:severity,
    checked_at:now,
    issues,
    message:severity==='ok'
      ?'Auditoria do Café sem anomalias.'
      :issues[0]?.message||'A auditoria encontrou uma anomalia.',
    sector_activity:activity
  };
}

export async function markCafeServerBoot(now=Date.now()){
  const previous=await storeGet(AUDIT_PATH).catch(()=>null)||{};
  const boots=[...(Array.isArray(previous.boot_times)?previous.boot_times:[]),now]
    .filter(ts=>now-Number(ts)<6*60*60000)
    .slice(-20);
  await storeSet(AUDIT_PATH,{...previous,boot_times:boots,last_boot_at:now}).catch(()=>null);
  return boots;
}

export async function runCafeAudit({notify=true}={}){
  const now=Date.now();
  const [devices,weather,historyRaw,previous]=await Promise.all([
    listInkbirdDevices().catch(()=>[]),
    fetchWeatherSnapshot({maxAgeMs:5000}).catch(error=>({linked:false,error:error?.message||String(error)})),
    storeGet(CAFE_ROOT+'/history').catch(()=>null),
    storeGet(AUDIT_PATH).catch(()=>null)
  ]);
  const controllers=(Array.isArray(devices)?devices:[]).map((device,index)=>({
    id:device.id,
    name:device.name||'IIC-800-WIFI',
    model:device.model||'IIC-800-WIFI',
    online:device.online!==false,
    controller_index:index+1,
    sector_start:index*8+1,
    sector_end:index*8+8
  }));

  const stateEntries=await Promise.all(controllers.map(async controller=>[
    controller.id,
    await readInkbirdState({deviceId:controller.id,force:true,maxAgeMs:0}).catch(()=>null)
  ]));
  const sessionEntries=await Promise.all(controllers.map(async controller=>[
    controller.id,
    await getCafeActiveSession(controller.id).catch(()=>null)
  ]));
  const scheduleEntries=await Promise.all(controllers.map(async controller=>[
    controller.id,
    await getCafeScheduleCache(controller.id).catch(()=>({}))
  ]));

  const history=historyRows(historyRaw);
  const audit=evaluateCafeAudit({
    controllers,
    states:Object.fromEntries(stateEntries),
    activeSessions:Object.fromEntries(sessionEntries),
    weather,
    history,
    schedules:Object.fromEntries(scheduleEntries),
    bootTimes:Array.isArray(previous?.boot_times)?previous.boot_times:[],
    now
  });

  const previousCodes=new Set((previous?.issues||[]).map(issue=>String(issue.code)));
  const notifiedCodes=new Set((previous?.notified_codes||[]).map(String));
  const activeIncidents={...(previous?.active_incidents||{})};
  const currentCodes=new Set(audit.issues.map(issue=>String(issue.code)));
  const newIssues=audit.issues.filter(issue=>!notifiedCodes.has(String(issue.code)));
  const cleared=[...previousCodes].filter(code=>!currentCodes.has(code));
  const toNotify=notify?newIssues.slice(0,3):[];
  const nextNotified=new Set([...notifiedCodes].filter(code=>currentCodes.has(code)));
  for(const issue of toNotify)nextNotified.add(String(issue.code));

  for(const issue of audit.issues){
    const code=String(issue.code||'unknown');
    let incident=activeIncidents[code];
    if(!incident){
      const id=(code+'-'+now).replace(/[^A-Za-z0-9_-]/g,'_');
      incident={
        id,code,
        level:issue.level==='critical'?'critical':'warning',
        message:String(issue.message||code),
        opened_at:now,
        last_seen_at:now,
        status:'open',
        source:'cafe_audit'
      };
      activeIncidents[code]=incident;
      await storeSet(INCIDENT_ROOT+'/'+id,incident).catch(error=>
        console.warn('Falha ao abrir incidente do Café:',error?.message||error)
      );
    }else{
      incident={...incident,last_seen_at:now,level:issue.level==='critical'?'critical':'warning',message:String(issue.message||incident.message)};
      activeIncidents[code]=incident;
      await storeSet(INCIDENT_ROOT+'/'+incident.id,incident).catch(()=>null);
    }
  }

  for(const code of cleared){
    const incident=activeIncidents[code];
    if(!incident)continue;
    const openedAt=Number(incident.opened_at||now);
    const interventionTypes=new Set(['start','stop','mode','schedule','group_start']);
    const manualIntervention=history.some(row=>
      Number(row.ts||Date.parse(row.at||0)||0)>=openedAt&&
      Number(row.ts||Date.parse(row.at||0)||0)<=now&&
      interventionTypes.has(String(row.type||''))&&
      String(row.source||'')!=='cafe_audit'
    );
    const resolved={
      ...incident,
      status:'resolved',
      resolved_at:now,
      last_seen_at:Number(incident.last_seen_at||now),
      duration_ms:Math.max(0,now-openedAt),
      resolution:manualIntervention?'intervencao':'automatico'
    };
    await storeSet(INCIDENT_ROOT+'/'+incident.id,resolved).catch(error=>
      console.warn('Falha ao encerrar incidente do Café:',error?.message||error)
    );
    delete activeIncidents[code];
  }

  const stored={
    ...audit,
    boot_times:Array.isArray(previous?.boot_times)?previous.boot_times:[],
    last_boot_at:Number(previous?.last_boot_at||0)||null,
    new_codes:newIssues.map(issue=>issue.code),
    notified_codes:[...nextNotified],
    cleared_codes:cleared,
    active_incidents:activeIncidents
  };
  await storeSet(AUDIT_PATH,stored);

  if(notify){
    for(const issue of toNotify){
      await notifyIrrigation({
        title:issue.level==='critical'?'Alerta crítico • Café':'Atenção • Café',
        body:issue.message,
        tag:'cafe-audit-'+issue.code,
        level:issue.level,
        url:'/',
        cooldownMinutes:issue.level==='critical'?30:60,
        whatsapp:true
      }).catch(()=>null);
      await appendHistory({
        type:'audit_alert',
        source:'cafe_audit',
        status:issue.level,
        detail:issue.message,
        audit_code:issue.code,
        level:issue.level
      }).catch(()=>null);
    }
    if(cleared.length&&!audit.issues.length){
      await appendHistory({
        type:'audit_recovered',
        source:'cafe_audit',
        status:'ok',
        detail:'Auditoria do Café voltou ao estado normal.',
        cleared_codes:cleared
      }).catch(()=>null);
    }
  }
  return stored;
}

export async function getCafeAuditState(){
  return await storeGet(AUDIT_PATH).catch(()=>null);
}
