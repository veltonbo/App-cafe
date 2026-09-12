export type ApiData=Record<string,any>;
async function request(path:string,init:RequestInit={}){const r=await fetch(path,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(init.headers||{})},...init});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data?.error||`${r.status}`);return data}
export const irrigationApi={
  dashboard:()=>request('/api/viveiro/dashboard'),
  diagnostics:()=>request('/api/irrigation/diagnostics'),
  history:(days=7)=>request(`/api/irrigation/history?days=${days}`),
  forecast:()=>request('/api/weather/forecast'),
  viveiroDevices:()=>request('/api/viveiro/device'),
  testViveiroDevice:(deviceId:string)=>request('/api/viveiro/device',{method:'POST',body:JSON.stringify({action:'test',deviceId})}),
  selectViveiroDevice:(deviceId:string)=>request('/api/viveiro/device',{method:'POST',body:JSON.stringify({action:'select',deviceId})}),
  clearViveiroDevice:()=>request('/api/viveiro/device',{method:'POST',body:JSON.stringify({action:'clear'})})
};