import { applyCors, authorize, ensureCloudConfig, tuyaRequest } from '../_tuya.js';
import { listInkbirdDevices } from '../inkbird/_device.js';
import { fetchWeatherSnapshot } from '../weather/_weather.js';
import { getViveiroWeatherState } from '../viveiro/_weather_logic.js';
import { verifyGitHubOidc } from '../viveiro/_github_oidc.js';
import { getAutomationConfig, storeGet, storeSet } from './_store.js';
import { sendPushAlert } from './_push.js';

async function authorized(req,res){
  if(await verifyGitHubOidc(req))return true;
  return authorize(req,res);
}
function normalizeStatus(result){
  if(Array.isArray(result))return result;
  if(Array.isArray(result?.status))return result.status;
  return[];
}
function mapStatus(result){return Object.fromEntries(normalizeStatus(result).map(x=>[x.code,x.value]));}
function historyArray(raw){
  if(!raw||typeof raw!=='object')return[];
  return Object.entries(raw).map(([id,v])=>({id,...(v||{})})).sort((a,b)=>Number(a.ts||0)-Number(b.ts||0));
}
async function currentAlerts(){
  const config=await getAutomationConfig().catch(()=>({}));
  const prefs={weather:true,offline:true,overdue:true,irrigation:true,...(config?.alerts||{})};
  const [weather,devices,viveiroState]=await Promise.all([
    fetchWeatherSnapshot().catch(()=>null),
    listInkbirdDevices().catch(()=>[]),
    getViveiroWeatherState().catch(()=>({}))
  ]);
  const alerts=[];
  if(prefs.weather&&weather?.metrics?.rainDetected){
    alerts.push({key:'weather-rain',level:'warning',title:'Chuva detectada',body:'A Weather2-2 detectou chuva na Fazenda 2E.',url:'/irrigacao/central/'});
  }
  if(prefs.weather&&['paused_rain','waiting_resume_delay','paused_waiting_weather'].includes(String(viveiroState?.status||''))){
    alerts.push({key:'viveiro-weather',level:'warning',title:'Viveiro protegido',body:viveiroState.status==='waiting_resume_delay'?'Aguardando o tempo para retomar após a chuva.':'Irrigação do viveiro pausada por chuva.',url:'/irrigacao/'});
  }
  for(let i=0;i<devices.length;i++){
    const d=devices[i];
    if(prefs.offline&&d.online===false){
      alerts.push({key:'offline-'+d.id,level:'critical',title:'Controlador INKBIRD offline',body:`Controlador ${i+1} • Setores ${String(i*8+1).padStart(2,'0')}–${String(i*8+8).padStart(2,'0')} está offline.`,url:'/irrigacao/inkbird/'});
      continue;
    }
    if(prefs.overdue){
      try{
        const [st,session]=await Promise.all([
          tuyaRequest('GET',`/v1.0/iot-03/devices/${d.id}/status`),
          storeGet(`IrrigacaoFazenda2E/active/${d.id}`).catch(()=>null)
        ]);
        const m=mapStatus(st),mask=Number(m.zonerun_state||0),end=Number(session?.expected_end_at||0);
        if(mask&&end&&Date.now()>end+120000){
          alerts.push({key:'overdue-'+d.id,level:'critical',title:'Irrigação fora do tempo',body:`Controlador ${i+1} ainda indica setor ativo após o término previsto.`,url:'/irrigacao/inkbird/'});
        }
      }catch{}
    }
  }
  return{alerts,prefs,weather,viveiroState};
}
function eventPush(h){
  const sector=Number(h.sector||0)?'Setor '+String(h.sector).padStart(2,'0'):'Irrigação';
  if(h.type==='start')return{title:sector+' iniciado',body:`Irrigação manual por ${Number(h.duration_minutes||0)} min.`,tag:'event-'+h.id,url:'/irrigacao/central/'};
  if(h.type==='group_start')return{title:h.detail||'Grupo iniciado',body:'Irrigação de grupo confirmada.',tag:'event-'+h.id,url:'/irrigacao/central/'};
  if(h.type==='complete')return{title:sector+' concluído',body:h.detail||'Irrigação concluída.',tag:'event-'+h.id,url:'/irrigacao/central/'};
  if(h.type==='stop')return{title:'Irrigação parada',body:sector+' foi interrompido.',tag:'event-'+h.id,url:'/irrigacao/central/'};
  if(h.type==='weather_suspend'||h.type==='viveiro_rain_pause')return{title:'Irrigação bloqueada pela chuva',body:h.detail||'Proteção meteorológica acionada.',tag:'event-'+h.id,url:'/irrigacao/central/'};
  if(h.type==='weather_restore'||h.type==='viveiro_rain_resume')return{title:'Irrigação liberada',body:h.detail||'Proteção meteorológica liberou o sistema.',tag:'event-'+h.id,url:'/irrigacao/central/'};
  return null;
}
export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(!['GET','POST'].includes(req.method))return res.status(405).json({ok:false,error:'Método não permitido.'});
  if(!(await authorized(req,res))||!ensureCloudConfig(res))return;
  try{
    const state=(await storeGet('IrrigacaoFazenda2E/alertMonitor').catch(()=>null))||{};
    const current=await currentAlerts();
    const activeNow=Object.fromEntries(current.alerts.map(a=>[a.key,a]));
    const activeBefore=state.active||{};
    const sent=[];
    for(const alert of current.alerts){
      const prior=activeBefore[alert.key];
      if(!prior){
        const result=await sendPushAlert({...alert,tag:alert.key});
        sent.push({key:alert.key,type:'active',...result});
      }
    }
    for(const [key,old] of Object.entries(activeBefore)){
      if(activeNow[key])continue;
      let resolved=null;
      if(key==='weather-rain')resolved={title:'Chuva não detectada',body:'A Weather2-2 não indica chuva neste momento.',tag:key+'-clear',url:'/irrigacao/central/'};
      else if(key==='viveiro-weather')resolved={title:'Proteção do viveiro liberada',body:'O bloqueio climático do viveiro foi encerrado ou está em processo de retomada.',tag:key+'-clear',url:'/irrigacao/'};
      else if(key.startsWith('offline-'))resolved={title:'Controlador online novamente',body:old.body?.replace(' está offline.',' voltou a responder.')||'Controlador restabelecido.',tag:key+'-clear',url:'/irrigacao/central/'};
      else if(key.startsWith('overdue-'))resolved={title:'Alerta de irrigação encerrado',body:'O controlador não indica mais irrigação fora do tempo previsto.',tag:key+'-clear',url:'/irrigacao/central/'};
      if(resolved){
        const result=await sendPushAlert(resolved);
        sent.push({key,type:'resolved',...result});
      }
    }

    let lastEventTs=Number(state.lastEventTs||0);
    if(current.prefs.irrigation){
      const history=historyArray(await storeGet('IrrigacaoFazenda2E/history').catch(()=>null));
      if(!lastEventTs&&history.length){
        lastEventTs=Math.max(...history.map(h=>Number(h.ts||0)));
      }else{
        const newer=history.filter(h=>Number(h.ts||0)>lastEventTs).slice(-8);
        for(const h of newer){
          const p=eventPush(h);
          if(p){
            const result=await sendPushAlert(p);
            sent.push({key:'event-'+h.id,type:'event',...result});
          }
        }
        if(history.length)lastEventTs=Math.max(lastEventTs,...history.map(h=>Number(h.ts||0)));
      }
    }

    await storeSet('IrrigacaoFazenda2E/alertMonitor',{
      active:Object.fromEntries(current.alerts.map(a=>[a.key,{...a,seenAt:Date.now()}])),
      lastEventTs,
      checkedAt:Date.now()
    });

    return res.status(200).json({ok:true,alerts:current.alerts,sent});
  }catch(error){
    return res.status(502).json({ok:false,error:error?.message||'Falha no monitor de alertas.'});
  }
}
