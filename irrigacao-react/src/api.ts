export type ApiData=Record<string,any>;
async function request(path:string,init:RequestInit={}){let token='';try{token=JSON.parse(localStorage.getItem('fazenda2e-react-auth')||'null')?.appToken||''}catch{}const r=await fetch(path,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(init.headers||{})},...init});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data?.error||`${r.status}`);return data}
export const irrigationApi={
  dashboard:()=>request('/api/viveiro/dashboard'),
  secondsFast:()=>request('/api/viveiro/seconds?fast=1'),
  farm:()=>request('/api/farm'),
  farmManagement:(sector?:number)=>request('/api/farm/management'+(sector?'?sector='+sector:'')),
  addFarmManagement:(entry:any)=>request('/api/farm/management',{method:'POST',body:JSON.stringify(entry)}),
  addFarmPhoto:(photo:any)=>request('/api/farm/attachment',{method:'POST',body:JSON.stringify(photo)}),
  farmGeo:()=>request('/api/farm/geo'),
  importFarmGeo:(x:any)=>request('/api/farm/geo',{method:'POST',body:JSON.stringify(x)}),
  farmClones:()=>request('/api/farm/clones'),
  saveFarmClones:(x:any)=>request('/api/farm/clones',{method:'POST',body:JSON.stringify(x)}),
  farmPlanting:()=>request('/api/farm/planting'),
  saveFarmPlanting:(x:any)=>request('/api/farm/planting',{method:'POST',body:JSON.stringify(x)}),
  farmRows:()=>request('/api/farm/rows'),
  saveFarmRow:(x:any)=>request('/api/farm/rows',{method:'POST',body:JSON.stringify(x)}),
  diagnostics:()=>request('/api/irrigation/diagnostics'),
  smartLifeReauthStart:()=>request('/api/smartlife/reauth',{method:'POST',body:JSON.stringify({action:'start'})}),
  smartLifeReauthFinish:(token:string)=>request('/api/smartlife/reauth',{method:'POST',body:JSON.stringify({action:'finish',token})}),
  esp32:()=>request('/api/esp32/controller'),
  esp32Relay:(relay:number,on:boolean)=>request('/api/esp32/controller',{method:'POST',body:JSON.stringify({action:'relay',relay,on})}),
  esp32CoffeeSequenceStart:(sectors:any[])=>request('/api/esp32/controller',{method:'POST',body:JSON.stringify({action:'coffee_sequence_start',sectors})}),
  esp32CoffeeSequenceStop:()=>request('/api/esp32/controller',{method:'POST',body:JSON.stringify({action:'coffee_sequence_stop'})}),
  esp32CoffeeSequencePause:()=>request('/api/esp32/controller',{method:'POST',body:JSON.stringify({action:'coffee_sequence_pause'})}),
  esp32CoffeeSequenceResume:()=>request('/api/esp32/controller',{method:'POST',body:JSON.stringify({action:'coffee_sequence_resume'})}),
  esp32CoffeeSequenceAdjust:(adjust:string,payload:any={})=>request('/api/esp32/controller',{method:'POST',body:JSON.stringify({action:'coffee_sequence_adjust',adjust,...payload})}),
  esp32CoffeeAutomationSave:(config:any)=>request('/api/esp32/controller',{method:'POST',body:JSON.stringify({action:'coffee_automation_save',config})}),
  esp32AllOff:()=>request('/api/esp32/controller',{method:'POST',body:JSON.stringify({action:'all_off'})}),
  esp32WifiScan:()=>request('/api/esp32/controller',{method:'POST',body:JSON.stringify({action:'wifi_scan'})}),
  esp32Wifi:(ssid:string,password:string)=>request('/api/esp32/controller',{method:'POST',body:JSON.stringify({action:'wifi',ssid,password})}),
  emergencyStop:()=>request('/api/viveiro/seconds',{method:'POST',body:JSON.stringify({action:'emergency_stop',reason:'Parada de emergência pelo novo app React'})}),
  history:(days=7)=>request(`/api/irrigation/history?days=${days}`),
  forecast:()=>request('/api/weather/forecast'),
  configureSeconds:(on_seconds:number,off_seconds:number,resume_delay_minutes:number,start_minutes?:number,end_minutes?:number,days_mask?:number)=>request('/api/viveiro/seconds',{method:'POST',body:JSON.stringify({action:'configure',on_seconds,off_seconds,resume_delay_minutes,start_minutes,end_minutes,days_mask})}),
  config:()=>request('/api/irrigation/config'),
  telegram:()=>request('/api/irrigation/telegram'),
  saveTelegramAssistant:(assistant:any)=>request('/api/irrigation/telegram',{method:'POST',body:JSON.stringify({action:'set_assistant',assistant})}),
  saveTelegramToken:(token:string)=>request('/api/irrigation/telegram',{method:'POST',body:JSON.stringify({action:'set_token',token})}),
  detectTelegramChat:()=>request('/api/irrigation/telegram',{method:'POST',body:JSON.stringify({action:'detect_chat'})}),
  saveTelegramChatId:(chat_id:string)=>request('/api/irrigation/telegram',{method:'POST',body:JSON.stringify({action:'set_chat_id',chat_id})}),
  testTelegram:()=>request('/api/irrigation/telegram',{method:'POST',body:JSON.stringify({action:'test'})}),
  pushStatus:()=>request('/api/irrigation/push'),
  subscribePush:(subscription:any,platform:string)=>request('/api/irrigation/push',{method:'POST',body:JSON.stringify({action:'subscribe',subscription,platform})}),
  unsubscribePush:(endpoint:string)=>request('/api/irrigation/push',{method:'POST',body:JSON.stringify({action:'unsubscribe',endpoint})}),
  testPush:()=>request('/api/irrigation/push',{method:'POST',body:JSON.stringify({action:'test'})})
};
export function subscribeViveiroLive(onEvent:(event:any)=>void,onStatus?:(online:boolean)=>void){
  let closed=false,es:EventSource|null=null,retry:any=null;
  const connect=()=>{if(closed)return;es=new EventSource('/api/viveiro/live');es.onopen=()=>onStatus?.(true);es.onerror=()=>{onStatus?.(false);es?.close();if(!closed)retry=setTimeout(connect,1500)};for(const type of ['seconds','confirmation','watchdog','autonomy','event','weather','protection','connection','server'])es.addEventListener(type,(e:any)=>{try{onEvent(JSON.parse(e.data))}catch{}})};
  connect();return()=>{closed=true;if(retry)clearTimeout(retry);es?.close()};
}
