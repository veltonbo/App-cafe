(()=>{
'use strict';
const KEY='fazenda2ePainelV1';
const $=id=>document.getElementById(id);
let token='';
try{token=localStorage.getItem(KEY)||''}catch{}
function num(v,d=0){const n=Number(v);return Number.isFinite(n)?n:d}
function fmtSeconds(s){s=Math.max(0,Math.round(num(s)));if(s<60)return s+' s';const m=Math.floor(s/60),r=s%60;return r?m+' min '+r+' s':m+' min'}
function fmtAge(ts){if(!ts)return'—';const ms=Date.now()-num(ts);if(ms<60000)return Math.max(0,Math.round(ms/1000))+' s atrás';if(ms<3600000)return Math.round(ms/60000)+' min atrás';return Math.round(ms/3600000)+' h atrás'}
function statusLabel(s){return s==='critical'?'CRÍTICO':s==='warning'?'ATENÇÃO':'NORMAL'}
function setStatus(cardId,dotId,labelId,status){
  const card=$(cardId),dot=$(dotId),label=$(labelId);
  card.classList.remove('warning','critical');
  dot.className='dot '+(status==='critical'?'critical':status==='warning'?'warning':'ok');
  if(status==='critical'||status==='warning')card.classList.add(status);
  label.textContent=statusLabel(status);
}
async function load(){
  if(!token)return;
  try{
    const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),12000);
    const r=await fetch('/api/overview',{headers:{Authorization:'Bearer '+token},signal:ctl.signal});
    clearTimeout(t);
    const d=await r.json().catch(()=>({}));
    if(r.status===401){token='';try{localStorage.removeItem(KEY)}catch{};$('setup').hidden=false;return}
    if(!r.ok)throw new Error(d.error||'Falha ao carregar.');
    render(d);$('offlineBar').hidden=true;
  }catch(e){
    $('offlineBar').hidden=false;
    $('headText').textContent='Reconectando';
    $('headDot').className='critical';
  }
}
function render(d){
  const status=d.status||'warning';
  $('overallCard').className='overall '+status;
  $('overallIcon').textContent=status==='critical'?'!':status==='warning'?'•':'✓';
  $('overallTitle').textContent=statusLabel(status);
  const total=num(d.alerts?.total);
  $('overallDetail').textContent=status==='normal'?'Viveiro, Café e clima funcionando normalmente.':total?total+' incidente'+(total===1?'':'s')+' aberto'+(total===1?'':'s')+'.':'Há um serviço que precisa de atenção.';
  $('updatedAt').textContent=fmtAge(d.generated_at);
  $('headText').textContent=status==='normal'?'Online':status==='warning'?'Atenção':'Crítico';
  $('headDot').className=status==='critical'?'critical':status==='warning'?'warning':'ok';

  const v=d.viveiro||{};
  setStatus('viveiroCard','viveiroDot','viveiroStatus',v.status||'warning');
  $('viveiroTitle').textContent=v.title||'Viveiro';
  $('viveiroDetail').textContent=v.detail||'—';
  $('viveiroPulses').textContent=String(num(v.pulses_today));
  $('viveiroTime').textContent=fmtSeconds(v.irrigated_seconds);

  const c=d.cafe||{};
  setStatus('cafeCard','cafeDot','cafeStatus',c.status||'warning');
  $('cafeTitle').textContent=c.title||'Café';
  $('cafeDetail').textContent=c.detail||'—';
  $('cafeSessions').textContent=String(num(c.sessions_today));
  $('cafeSectors').textContent=String(num(c.sectors_today));

  const w=d.climate||{};
  setStatus('climateCard','climateDot','climateStatus',w.status||'warning');
  $('climateDetail').textContent=w.linked?'Atualizado '+fmtAge(w.checked_at):(w.error||'Weather2-2 sem comunicação.');
  $('temperature').textContent=w.temperature==null?'—':num(w.temperature).toFixed(1)+' °C';
  $('humidity').textContent=w.humidity==null?'—':Math.round(num(w.humidity))+'%';
  $('rain').textContent=w.raining?'CHUVA':w.rain_mm==null?'—':num(w.rain_mm).toFixed(1)+' mm';

  const a=d.alerts||{};
  const alertStatus=num(a.critical)>0?'critical':num(a.total)>0?'warning':'normal';
  setStatus('alertsCard','alertsDot','alertsStatus',alertStatus);
  $('alertsTitle').textContent=num(a.total)?num(a.total)+' aberto'+(num(a.total)===1?'':'s'):'Sem alertas';
  $('alertsTotal').textContent=String(num(a.total));
  $('alertsCritical').textContent=String(num(a.critical));

  const next=c.next_schedule;
  if(next){
    const day=next.day_offset===0?'Hoje':next.day_offset===1?'Amanhã':'Em '+next.day_offset+' dias';
    $('nextCafe').textContent='Setor '+String(num(next.sector)).padStart(2,'0')+' • '+String(next.time||'—');
    $('nextCafeSub').textContent=day+' • '+Math.round(num(next.duration_minutes))+' min';
  }else{
    $('nextCafe').textContent='Nenhuma programação encontrada';
    $('nextCafeSub').textContent='—';
  }
}
$('refreshBtn').addEventListener('click',load);
$('connectBtn').addEventListener('click',()=>{
  const v=$('tokenInput').value.trim();
  if(!v)return;
  token=v;try{localStorage.setItem(KEY,token)}catch{}
  $('setup').hidden=true;load();
});
$('setup').hidden=Boolean(token);
if(token)load();
setInterval(()=>{if(document.visibilityState==='visible'&&token)load()},15000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&token)load()});
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>null);
})();