import { getDeviceId, tuyaRequest } from '../_tuya.js';
import { decodeCycle, encodeCycle } from '../_cycle.js';
import { fetchWeatherSnapshot } from '../weather/_weather.js';
import { appendHistory, storeGet, storePatch, storeSet } from '../irrigation/_store.js';

const TZ='America/Porto_Velho';
const CONFIG_PATH='IrrigacaoFazenda2E/viveiroWeather/config';
const STATE_PATH='IrrigacaoFazenda2E/viveiroWeather/state';
const SECONDS_STATE_PATH='IrrigacaoFazenda2E/viveiroSecondsState';

export const DEFAULT_VIVEIRO_WEATHER_CONFIG={
  enabled:true,
  resumeDelayMinutes:30,
  checkMinutes:5,
  blockWhileRaining:true,
  rainThresholdMm:5
};

function normalizeStatus(result){
  if(Array.isArray(result))return result;
  if(Array.isArray(result?.status))return result.status;
  if(Array.isArray(result?.result))return result.result;
  return [];
}
function statusMap(result){
  return Object.fromEntries(normalizeStatus(result).map(x=>[x.code,x.value]));
}
async function getShadowMap(deviceId){
  try{
    const shadow=await tuyaRequest('GET',`/v2.0/cloud/thing/${deviceId}/shadow/properties`);
    const props=Array.isArray(shadow?.properties)?shadow.properties:[];
    return Object.fromEntries(props.map(x=>[x.code,x.value]));
  }catch{return{}}
}
async function readEkaza(deviceId){
  const [statusR,shadowMap]=await Promise.all([
    tuyaRequest('GET',`/v1.0/iot-03/devices/${deviceId}/status`),
    getShadowMap(deviceId)
  ]);
  const map=statusMap(statusR);
  const cycleRaw=typeof shadowMap.cycle_time==='string'?shadowMap.cycle_time:(typeof map.cycle_time==='string'?map.cycle_time:'');
  return{
    relay:typeof map.switch_1==='boolean'?map.switch_1:null,
    cycleRaw,
    cycleConfig:decodeCycle(cycleRaw),
    raw:map,
    shadow:shadowMap
  };
}
async function setRelay(deviceId,on){
  await tuyaRequest('POST',`/v1.0/iot-03/devices/${deviceId}/commands`,{
    commands:[{code:'switch_1',value:Boolean(on)}]
  });
}
async function setCycleEnabled(deviceId,currentRaw,currentConfig,enabled){
  if(!currentConfig)throw new Error('Programação cycle_time não reconhecida.');
  const encoded=encodeCycle({
    enabled,
    daysMask:currentConfig.daysMask,
    startMinutes:currentConfig.startMinutes,
    endMinutes:currentConfig.endMinutes,
    onMinutes:currentConfig.onMinutes,
    offMinutes:currentConfig.offMinutes
  },currentRaw);
  await tuyaRequest('POST',`/v1.0/iot-03/devices/${deviceId}/commands`,{
    commands:[{code:'cycle_time',value:encoded.raw}]
  });
  return encoded;
}
function timeContext(now=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
    timeZone:TZ,
    weekday:'short',
    hour:'2-digit',
    minute:'2-digit',
    hourCycle:'h23'
  }).formatToParts(now).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  const dayMap={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  const dayIndex=dayMap[parts.weekday]??0;
  const minutes=Number(parts.hour)*60+Number(parts.minute);
  return{dayIndex,minutes,weekday:parts.weekday,time:String(parts.hour).padStart(2,'0')+':'+String(parts.minute).padStart(2,'0')};
}
function schedulePosition(cycleConfig,now=new Date()){
  if(!cycleConfig)return{dayAllowed:false,insideWindow:false,beforeStart:false,afterEnd:false};
  const t=timeContext(now);
  const dayAllowed=Boolean(Number(cycleConfig.daysMask||0)&(1<<t.dayIndex));
  return{
    ...t,
    dayAllowed,
    insideWindow:dayAllowed&&t.minutes>=Number(cycleConfig.startMinutes)&&t.minutes<Number(cycleConfig.endMinutes),
    beforeStart:dayAllowed&&t.minutes<Number(cycleConfig.startMinutes),
    afterEnd:dayAllowed&&t.minutes>=Number(cycleConfig.endMinutes)
  };
}
function sanitizeConfig(input={}){
  return{
    enabled:input.enabled!==false,
    resumeDelayMinutes:Math.max(0,Math.min(1440,Math.round(Number(input.resumeDelayMinutes??30)))),
    checkMinutes:Math.max(1,Math.min(60,Math.round(Number(input.checkMinutes??5)))),
    blockWhileRaining:input.blockWhileRaining!==false,
    rainThresholdMm:Math.max(0,Math.min(500,Number(input.rainThresholdMm??5)))
  };
}
function rainAmountMm(metrics={}){
  const values=[metrics.rain24h,metrics.rainToday,metrics.rainGeneric].map(x=>Number(x?.value)).filter(Number.isFinite);
  return values.length?Math.max(...values):null;
}

export async function getViveiroWeatherConfig(){
  const stored=await storeGet(CONFIG_PATH).catch(()=>null);
  return sanitizeConfig({...DEFAULT_VIVEIRO_WEATHER_CONFIG,...(stored||{})});
}
export async function saveViveiroWeatherConfig(input={}){
  const config=sanitizeConfig(input);
  await storeSet(CONFIG_PATH,config);
  return config;
}
export async function getViveiroWeatherState(){
  return(await storeGet(STATE_PATH).catch(()=>null))||{};
}

async function record(type,detail,extra={}){
  await appendHistory({
    type,
    source:'viveiro_weather',
    status:'confirmed',
    detail,
    ...extra
  }).catch(()=>null);
}

export async function runViveiroWeatherCheck(){
  const deviceId=getDeviceId();
  const config=await getViveiroWeatherConfig();
  const previous=await getViveiroWeatherState();
  const checkedAt=Date.now();

  let weather=null;
  try{weather=await fetchWeatherSnapshot()}catch(error){
    weather={ok:false,linked:false,error:error?.message||String(error)};
  }

  const ekaza=await readEkaza(deviceId);
  const seconds=(await storeGet(SECONDS_STATE_PATH).catch(()=>null))||{};
  const position=schedulePosition(seconds.enabled
    ?{daysMask:seconds.days_mask,startMinutes:seconds.start_minutes,endMinutes:seconds.end_minutes}
    :ekaza.cycleConfig);
  const next={...previous,lastCheckedAt:checkedAt};
  const result={
    ok:true,
    config,
    weather,
    relay:ekaza.relay,
    cycle_config:ekaza.cycleConfig,
    schedule_position:position,
    action:'none'
  };

  if(!config.enabled){
    next.status='disabled';
    await storeSet(STATE_PATH,next);
    return{...result,state:next};
  }

  const weatherUsable=Boolean(weather?.linked&&weather?.metrics);
  if(!weatherUsable){
    next.status=previous.pausedByWeather?'paused_waiting_weather':'weather_unavailable';
    next.lastWeatherError=weather?.error||'Weather2-2 sem dados suficientes.';
    // Fail-safe: se já estava pausado por chuva, não retoma sem confirmar o clima.
    if(previous.pausedByWeather&&ekaza.relay===true){
      await setRelay(deviceId,false).catch(()=>null);
      result.action='forced_off_weather_unavailable';
    }
    await storeSet(STATE_PATH,next);
    return{...result,state:next};
  }

  const rainMm=rainAmountMm(weather.metrics);
  const raining=Boolean(config.blockWhileRaining&&weather.metrics.rainDetected);
  const threshold=Number(config.rainThresholdMm||0);
  const thresholdReached=threshold>0&&Number.isFinite(rainMm)&&rainMm>=threshold;
  next.lastWeatherError=null;
  next.rainDetected=raining;
  next.rainAmountMm=rainMm;
  next.rainThresholdReached=thresholdReached;

  if(raining||thresholdReached){
    next.lastRainAt=checkedAt;
    if(!previous.rainActive)next.rainStartedAt=checkedAt;
    next.rainActive=true;
    next.rainStoppedAt=null;

    const wasEnabled=previous.pausedByWeather
      ? Boolean(previous.wasCycleEnabled)
      : Boolean(seconds.enabled||ekaza.cycleConfig?.enabled);

    next.wasCycleEnabled=wasEnabled;
    next.pausedByWeather=Boolean(previous.pausedByWeather||wasEnabled);
    next.status='paused_rain';

    if(seconds.enabled){
      // O servidor contínuo é o único responsável pelo estado do modo rápido.
      // Esta verificação apenas reforça o desligamento físico em caso de chuva.
      result.action='continuous_seconds_manager_handles_rain';
    }else if(ekaza.cycleConfig?.enabled){
      await setCycleEnabled(deviceId,ekaza.cycleRaw,ekaza.cycleConfig,false);
      result.action='cycle_paused_rain';
    }
    if(ekaza.relay!==false){
      await setRelay(deviceId,false);
      result.action=result.action==='none'?'relay_off_rain':result.action+'+relay_off';
    }

    if(!previous.rainActive){
      await record('viveiro_rain_pause','Viveiro pausado automaticamente por chuva.',{
        weather:{rainDetected:true},
        duration_minutes:0
      });
    }
    await storeSet(STATE_PATH,next);
    return{...result,state:next};
  }

  // Chuva não está mais sendo detectada.
  next.rainActive=false;
  if(previous.rainActive&&!previous.rainStoppedAt){
    next.rainStoppedAt=checkedAt;
    await record('viveiro_rain_stopped','Weather2-2 deixou de detectar chuva.');
  }else{
    next.rainStoppedAt=previous.rainStoppedAt||null;
  }

  if(!previous.pausedByWeather){
    next.status='clear';
    await storeSet(STATE_PATH,next);
    return{...result,state:next};
  }

  const stoppedAt=Number(next.rainStoppedAt||checkedAt);
  const delayMs=Number(config.resumeDelayMinutes||0)*60000;
  const resumeAt=stoppedAt+delayMs;
  next.resumeEligibleAt=resumeAt;

  if(checkedAt<resumeAt){
    next.status='waiting_resume_delay';
    if(seconds.enabled){
      result.action='continuous_seconds_manager_handles_resume_delay';
    }else if(ekaza.cycleConfig?.enabled){
      // Alguém reativou manualmente durante a espera: mantém a proteção.
      await setCycleEnabled(deviceId,ekaza.cycleRaw,ekaza.cycleConfig,false);
      result.action='cycle_kept_paused_delay';
    }
    if(ekaza.relay===true){
      await setRelay(deviceId,false);
      result.action=result.action==='none'?'relay_off_delay':result.action+'+relay_off';
    }
    await storeSet(STATE_PATH,next);
    return{...result,state:next};
  }

  if(previous.wasCycleEnabled){
    if(seconds.enabled){
      result.action=position.insideWindow?'continuous_seconds_ready':'continuous_seconds_waiting_window';
    }else if(ekaza.cycleConfig&&!ekaza.cycleConfig.enabled){
      const restored=await setCycleEnabled(deviceId,ekaza.cycleRaw,ekaza.cycleConfig,true);
      result.cycle_config=restored;
      result.action=position.insideWindow?'cycle_resumed_inside_window':'cycle_restored_for_next_window';
    }
    if(!position.insideWindow){
      await setRelay(deviceId,false).catch(()=>null);
    }
    next.status=position.insideWindow?'resumed_inside_window':'restored_outside_window';
    await record(
      position.insideWindow?'viveiro_rain_resume':'viveiro_rain_restore',
      position.insideWindow
        ?'Viveiro liberado após chuva dentro da janela de irrigação.'
        :'Ciclo do viveiro restaurado fora da janela; aguardará o próximo período.',
      {weather:{rainDetected:false}}
    );
  }else{
    next.status='manual_pause_preserved';
    result.action='manual_pause_preserved';
  }

  next.pausedByWeather=false;
  next.wasCycleEnabled=false;
  next.resumeCompletedAt=checkedAt;
  await storeSet(STATE_PATH,next);
  return{...result,state:next};
}
