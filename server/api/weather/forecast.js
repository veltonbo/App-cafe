import { applyCors, authorize } from '../_tuya.js';

const DEFAULT_LAT=-11.72;
const DEFAULT_LON=-62.32;
const TZ='America/Porto_Velho';
const CACHE_MS=10*60*1000;
let cache=null;
let cacheAt=0;

function n(v){const x=Number(v);return Number.isFinite(x)?x:null}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function weatherLabel(code){
  const c=Number(code);
  if(c===0)return'Céu limpo';
  if([1,2].includes(c))return'Parcialmente nublado';
  if(c===3)return'Nublado';
  if([45,48].includes(c))return'Neblina';
  if([51,53,55,56,57].includes(c))return'Garoa';
  if([61,63,65,66,67,80,81,82].includes(c))return'Chuva';
  if([95,96,99].includes(c))return'Trovoadas';
  return'Variável';
}
function riskLabel(hour={}){
  const rain=n(hour.precipitation_probability)||0;
  const vpd=n(hour.vapour_pressure_deficit);
  const et0=n(hour.et0_fao_evapotranspiration)||0;
  const gust=n(hour.wind_gusts_10m)||0;
  let score=0;
  if(rain>=60)score-=2;else if(rain>=35)score-=1;
  if(vpd!=null){if(vpd>=3.2)score+=3;else if(vpd>=2.3)score+=2;else if(vpd>=1.7)score+=1;else if(vpd<0.8)score-=1;}
  if(et0>=0.35)score+=1;
  if(gust>=35)score+=1;
  if(score>=4)return{level:'alto',label:'Demanda muito alta'};
  if(score>=2)return{level:'elevado',label:'Demanda elevada'};
  if(score<=-2)return{level:'baixo',label:'Baixa demanda / chuva provável'};
  return{level:'normal',label:'Demanda moderada'};
}
function rowsFromHourly(hourly={}){
  const t=hourly.time||[];
  return t.map((time,i)=>({
    time,
    temperature_2m:n(hourly.temperature_2m?.[i]),
    relative_humidity_2m:n(hourly.relative_humidity_2m?.[i]),
    precipitation_probability:n(hourly.precipitation_probability?.[i]),
    precipitation:n(hourly.precipitation?.[i]),
    rain:n(hourly.rain?.[i]),
    weather_code:n(hourly.weather_code?.[i]),
    wind_speed_10m:n(hourly.wind_speed_10m?.[i]),
    wind_gusts_10m:n(hourly.wind_gusts_10m?.[i]),
    vapour_pressure_deficit:n(hourly.vapour_pressure_deficit?.[i]),
    et0_fao_evapotranspiration:n(hourly.et0_fao_evapotranspiration?.[i])
  })).map(row=>({...row,risk:riskLabel(row)}));
}
function dailyRows(daily={}){
  const t=daily.time||[];
  return t.map((time,i)=>({
    time,
    weather_code:n(daily.weather_code?.[i]),
    weather_label:weatherLabel(daily.weather_code?.[i]),
    temperature_max:n(daily.temperature_2m_max?.[i]),
    temperature_min:n(daily.temperature_2m_min?.[i]),
    precipitation_sum:n(daily.precipitation_sum?.[i]),
    precipitation_probability_max:n(daily.precipitation_probability_max?.[i]),
    wind_gusts_max:n(daily.wind_gusts_10m_max?.[i]),
    et0:n(daily.et0_fao_evapotranspiration?.[i])
  }));
}

async function loadForecast(){
  if(cache&&Date.now()-cacheAt<CACHE_MS)return cache;
  const lat=n(process.env.FAZENDA2E_LATITUDE)??DEFAULT_LAT;
  const lon=n(process.env.FAZENDA2E_LONGITUDE)??DEFAULT_LON;
  const params=new URLSearchParams({
    latitude:String(lat),longitude:String(lon),timezone:TZ,forecast_days:'7',
    current:'temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m,wind_gusts_10m',
    hourly:'temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,rain,weather_code,wind_speed_10m,wind_gusts_10m,vapour_pressure_deficit,et0_fao_evapotranspiration',
    daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max,et0_fao_evapotranspiration'
  });
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),8000);
  try{
    const r=await fetch('https://api.open-meteo.com/v1/forecast?'+params,{signal:controller.signal,headers:{'User-Agent':'Fazenda2E/3.0'}});
    if(!r.ok)throw new Error('Previsão meteorológica HTTP '+r.status);
    const raw=await r.json();
    const hourly=rowsFromHourly(raw.hourly||{});
    const daily=dailyRows(raw.daily||{});
    const now=Date.now();
    const future=hourly.filter(row=>Date.parse(row.time)>=now-60*60000);
    const next24=future.slice(0,24);
    const nextRain=future.find(row=>(row.precipitation_probability||0)>=50||(row.precipitation||0)>=0.5)||null;
    const maxRainProb=next24.reduce((m,row)=>Math.max(m,row.precipitation_probability||0),0);
    const maxVpd=next24.reduce((m,row)=>Math.max(m,row.vapour_pressure_deficit||0),0);
    const et0Next24=next24.reduce((s,row)=>s+(row.et0_fao_evapotranspiration||0),0);
    const confidence=maxRainProb>=70?'alta':maxRainProb>=40?'média':'moderada';
    cache={
      ok:true,provider:'Open-Meteo',model_note:'Previsão por modelos numéricos; a Weather2-2 continua sendo a fonte principal do clima atual.',
      attribution:'Open-Meteo.com',generated_at:Date.now(),timezone:raw.timezone||TZ,
      location:{latitude:lat,longitude:lon,label:'Nova Brasilândia d’Oeste • RO'},
      current:{
        time:raw.current?.time||null,
        temperature_2m:n(raw.current?.temperature_2m),
        relative_humidity_2m:n(raw.current?.relative_humidity_2m),
        precipitation:n(raw.current?.precipitation),
        rain:n(raw.current?.rain),
        weather_code:n(raw.current?.weather_code),
        weather_label:weatherLabel(raw.current?.weather_code),
        wind_speed_10m:n(raw.current?.wind_speed_10m),
        wind_gusts_10m:n(raw.current?.wind_gusts_10m)
      },
      summary:{next_rain:nextRain,max_rain_probability_24h:maxRainProb,max_vpd_24h:Number(maxVpd.toFixed(2)),et0_24h:Number(et0Next24.toFixed(2)),forecast_confidence:confidence},
      hourly:future.slice(0,48),daily
    };
    cacheAt=Date.now();
    return cache;
  }finally{clearTimeout(timer)}
}

export default async function handler(req,res){
  applyCors(req,res);
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'Método não permitido.'});
  if(!authorize(req,res))return;
  try{return res.status(200).json(await loadForecast());}
  catch(error){
    if(cache)return res.status(200).json({...cache,stale:true,warning:'Previsão externa temporariamente indisponível; exibindo último resultado salvo.'});
    return res.status(502).json({ok:false,error:error?.message||'Falha ao consultar previsão meteorológica.'});
  }
}
