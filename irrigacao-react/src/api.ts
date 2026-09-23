export type ApiData=Record<string,any>;
async function request(path:string,init:RequestInit={}){let token='';try{token=JSON.parse(sessionStorage.getItem('fazenda2e-react-auth')||'null')?.appToken||''}catch{}const r=await fetch(path,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(init.headers||{})},...init});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data?.error||`${r.status}`);return data}
export const irrigationApi={
  dashboard:()=>request('/api/viveiro/dashboard'),
  diagnostics:()=>request('/api/irrigation/diagnostics'),
  emergencyStop:()=>request('/api/viveiro/seconds',{method:'POST',body:JSON.stringify({action:'emergency_stop',reason:'Parada de emergência pelo novo app React'})}),
  history:(days=7)=>request(`/api/irrigation/history?days=${days}`),
  forecast:()=>request('/api/weather/forecast'),
  viveiroDevices:()=>request('/api/viveiro/device'),
  testViveiroDevice:(deviceId:string)=>request('/api/viveiro/device',{method:'POST',body:JSON.stringify({action:'test',deviceId})}),
  selectViveiroDevice:(deviceId:string)=>request('/api/viveiro/device',{method:'POST',body:JSON.stringify({action:'select',deviceId})}),
  clearViveiroDevice:()=>request('/api/viveiro/device',{method:'POST',body:JSON.stringify({action:'clear'})}),
  configureSeconds:(on_seconds:number,off_seconds:number,resume_delay_minutes:number,start_minutes?:number,end_minutes?:number,days_mask?:number)=>request('/api/viveiro/seconds',{method:'POST',body:JSON.stringify({action:'configure',on_seconds,off_seconds,resume_delay_minutes,start_minutes,end_minutes,days_mask})}),
  config:()=>request('/api/irrigation/config'),
  saveConfig:(config:any)=>request('/api/irrigation/config',{method:'PATCH',body:JSON.stringify(config)}),
  telegram:()=>request('/api/irrigation/telegram'),
  saveTelegramAssistant:(assistant:any)=>request('/api/irrigation/telegram',{method:'POST',body:JSON.stringify({action:'set_assistant',assistant})}),
  saveTelegramToken:(token:string)=>request('/api/irrigation/telegram',{method:'POST',body:JSON.stringify({action:'set_token',token})}),
  detectTelegramChat:()=>request('/api/irrigation/telegram',{method:'POST',body:JSON.stringify({action:'detect_chat'})}),
  saveTelegramChatId:(chat_id:string)=>request('/api/irrigation/telegram',{method:'POST',body:JSON.stringify({action:'set_chat_id',chat_id})}),
  testTelegram:()=>request('/api/irrigation/telegram',{method:'POST',body:JSON.stringify({action:'test'})})
};
export function subscribeViveiroLive(onEvent:(event:any)=>void,onStatus?:(online:boolean)=>void){
  let closed=false,es:EventSource|null=null,retry:any=null;
  const connect=()=>{if(closed)return;es=new EventSource('/api/viveiro/live');es.onopen=()=>onStatus?.(true);es.onerror=()=>{onStatus?.(false);es?.close();if(!closed)retry=setTimeout(connect,1500)};for(const type of ['seconds','confirmation','watchdog','autonomy','event'])es.addEventListener(type,(e:any)=>{try{onEvent(JSON.parse(e.data))}catch{}})};
  connect();return()=>{closed=true;if(retry)clearTimeout(retry);es?.close()};
}
