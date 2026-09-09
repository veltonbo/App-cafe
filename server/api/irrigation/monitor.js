import { applyCors, authorize } from '../_tuya.js';
import { fetchWeatherSnapshot } from '../weather/_weather.js';
import { getViveiroWeatherState } from '../viveiro/_weather_logic.js';
import { verifyGitHubOidc } from '../viveiro/_github_oidc.js';
import { getAutomationConfig, storeGet, storeSet } from './_store.js';
import { notifyIrrigation } from './_notify.js';

async function authorized(req,res){
  if(await verifyGitHubOidc(req))return true;
  return authorize(req,res);
}

async function currentAlerts(){
  const config=await getAutomationConfig().catch(()=>({}));
  const prefs={weather:true,...(config?.alerts||{})};
  const [weather,viveiroState]=await Promise.all([
    fetchWeatherSnapshot().catch(()=>null),
    getViveiroWeatherState().catch(()=>({}))
  ]);
  const alerts=[];

  if(prefs.weather&&weather?.metrics?.rainDetected){
    alerts.push({
      key:'weather-rain',
      level:'warning',
      title:'Chuva detectada',
      body:'A Weather2-2 detectou chuva no Viveiro.',
      url:'/irrigacao/'
    });
  }
  if(prefs.weather&&['paused_rain','waiting_resume_delay','paused_waiting_weather'].includes(String(viveiroState?.status||''))){
    alerts.push({
      key:'viveiro-weather',
      level:'warning',
      title:'Viveiro protegido',
      body:viveiroState.status==='waiting_resume_delay'
        ?'Aguardando o tempo configurado para retomar após a chuva.'
        :'Irrigação do viveiro pausada por chuva.',
      url:'/irrigacao/'
    });
  }
  return{alerts,prefs,weather,viveiroState};
}

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(!['GET','POST'].includes(req.method))return res.status(405).json({ok:false,error:'Método não permitido.'});
  if(!(await authorized(req,res)))return;

  try{
    const state=(await storeGet('IrrigacaoFazenda2E/alertMonitor').catch(()=>null))||{};
    const current=await currentAlerts();
    const activeNow=Object.fromEntries(current.alerts.map(a=>[a.key,a]));
    const activeBefore=state.active||{};
    const sent=[];

    for(const alert of current.alerts){
      if(!activeBefore[alert.key]){
        const result=await notifyIrrigation({...alert,tag:alert.key,whatsapp:true});
        sent.push({key:alert.key,type:'active',...result});
      }
    }

    for(const [key] of Object.entries(activeBefore)){
      if(activeNow[key])continue;
      let resolved=null;
      if(key==='weather-rain'){
        resolved={
          title:'Chuva não detectada',
          body:'A Weather2-2 não indica chuva neste momento.',
          tag:key+'-clear',
          url:'/irrigacao/'
        };
      }else if(key==='viveiro-weather'){
        resolved={
          title:'Proteção do viveiro liberada',
          body:'O bloqueio climático do viveiro foi encerrado ou está em processo de retomada.',
          tag:key+'-clear',
          url:'/irrigacao/'
        };
      }
      if(resolved){
        const result=await notifyIrrigation({...resolved,level:'info',whatsapp:true});
        sent.push({key,type:'resolved',...result});
      }
    }

    await storeSet('IrrigacaoFazenda2E/alertMonitor',{
      active:Object.fromEntries(current.alerts.map(a=>[a.key,{...a,seenAt:Date.now()}])),
      checkedAt:Date.now()
    });

    return res.status(200).json({ok:true,alerts:current.alerts,sent});
  }catch(error){
    return res.status(502).json({ok:false,error:error?.message||'Falha no monitor do Viveiro.'});
  }
}
