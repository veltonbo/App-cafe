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
  saveTelegramAssistant:(assistant:any)=>request('/api/irrigation/telegram',{method:'POST',body:JSON.stringify({action:'set_assistant',assistant})})
};