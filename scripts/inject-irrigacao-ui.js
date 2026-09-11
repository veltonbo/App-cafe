import fs from 'node:fs';
import path from 'node:path';

const htmlFile=path.resolve('dist/irrigacao/index.html');
const appFile=path.resolve('dist/irrigacao/app.js');
const cssFile=path.resolve('dist/irrigacao/app.css');
const authFile=path.resolve('dist/irrigacao/firebase-auth.js');
if(!fs.existsSync(htmlFile)||!fs.existsSync(appFile)||!fs.existsSync(cssFile)||!fs.existsSync(authFile))throw new Error('Build do Viveiro incompleto.');

let html=fs.readFileSync(htmlFile,'utf8');
html=html.replace(/\/irrigacao\/app\.js\?v=[^\"]+/,'/irrigacao/app.js?v=20260911-7');
html=html.replace(/\/irrigacao\/app\.css\?v=[^\"]+/,'/irrigacao/app.css?v=20260911-7');
if(!html.includes('/irrigacao/firebase-auth.js'))html=html.replace(/<script src="\/irrigacao\/app\.js[^>]*><\/script>/,m=>m+'\n  <script src="/irrigacao/firebase-auth.js?v=20260910-1" defer></script>');

if(!html.includes('id="climateForecastPanel"')){
  const marker='        <article class="metric"><small>Chuva</small><strong id="rain">—</strong><span id="rainHint">Proteção automática</span></article>\n      </div>';
  if(!html.includes(marker))throw new Error('Grade de clima atual não encontrada.');
  html=html.replace(marker,marker+`

      <article id="climateForecastPanel" class="climateForecastPanel">
        <div class="climateForecastHead">
          <div><small>CLIMA • ESTAÇÃO + PREVISÃO</small><h3>Previsão agrícola</h3></div>
          <span id="forecastBadge" class="badge">CARREGANDO</span>
        </div>
        <div class="climateReliability">
          <div><small>Fonte atual</small><strong>Weather2-2</strong></div>
          <div><small>Modelo</small><strong id="forecastProvider">Open-Meteo</strong></div>
          <div><small>Conferência</small><strong id="forecastAgreement">—</strong></div>
        </div>
        <div class="forecastHighlights">
          <div><small>Próxima chuva</small><strong id="forecastNextRain">—</strong></div>
          <div><small>Chuva 24 h</small><strong id="forecastRain24">—</strong></div>
          <div><small>VPD máx. 24 h</small><strong id="forecastVpd24">—</strong></div>
          <div><small>ET₀ 24 h</small><strong id="forecastEt024">—</strong></div>
        </div>
        <div class="forecastTitleRow"><strong>Próximas horas</strong><small id="forecastUpdated">—</small></div>
        <div id="forecastHourly" class="forecastHourly"><span class="panelNote">Carregando previsão...</span></div>
        <div class="forecastTitleRow"><strong>Próximos dias</strong><small>modelo numérico</small></div>
        <div id="forecastDaily" class="forecastDaily"><span class="panelNote">Carregando previsão...</span></div>
        <p id="forecastNote" class="forecastNote">A estação local é usada para decisões atuais. A previsão serve para antecipar chuva, calor, VPD e demanda de água.</p>
      </article>`);
}

if(!html.includes('id="auto3ShadowBox"')){
  const marker='<p id="autoReason">O sistema ainda não enviou a avaliação climática.</p>';
  if(!html.includes(marker))throw new Error('Bloco Automático 2.0 não encontrado.');
  html=html.replace(marker,marker+`
        <div id="auto3ShadowBox" class="auto3Box">
          <div class="autoTop">
            <div><small>AUTOMÁTICO 3.0 • MODO SOMBRA</small><h3 id="auto3Title">Observando sem controlar</h3></div>
            <span id="auto3Badge" class="badge">SOMBRA</span>
          </div>
          <p id="auto3Reason">O 3.0 calcula em paralelo, mas não envia comandos para a bomba.</p>
          <div class="auto3Grid">
            <div><small>Ciclo atual</small><strong id="auto3Current">—</strong></div>
            <div><small>3.0 faria</small><strong id="auto3Target">—</strong></div>
            <div><small>Confiança</small><strong id="auto3Confidence">—</strong></div>
            <div><small>Leitura climática</small><strong id="auto3WeatherAge">—</strong></div>
          </div>
        </div>`);
}

const systemTitle='      <div class="pageTitle"><small>SEGURANÇA</small><h2>Sistema</h2><p>Conectividade, proteção, manutenção e diagnóstico.</p></div>';
if(!html.includes('id="serverDiagnosticsPanel"')&&html.includes(systemTitle))html=html.replace(systemTitle,systemTitle+`
      <article id="serverDiagnosticsPanel" class="panel">
        <div class="panelHead"><div><small>ORACLE CLOUD • DIAGNÓSTICO</small><h3>Saúde do servidor</h3></div><span id="diagOverallBadge" class="badge">VERIFICANDO</span></div>
        <div class="statusRows">
          <div><span>Hospedagem</span><strong>Oracle Cloud</strong></div>
          <div><span>Memória do servidor</span><strong id="diagServerRam">—</strong></div>
          <div><span>Memória do Fazenda 2E</span><strong id="diagProcessRam">—</strong></div>
          <div><span>Histórico local</span><strong id="diagHistory">—</strong></div>
          <div><span>Sincronização local</span><strong id="diagSync">—</strong></div>
          <div><span>Backups locais</span><strong id="diagBackup">—</strong></div>
          <div><span>Firebase</span><strong id="diagFirebase">—</strong></div>
        </div>
        <p id="diagAlerts" class="panelNote">Verificando componentes do servidor.</p>
        <div class="auditFoot"><span>Último diagnóstico</span><strong id="diagCheckedAt">—</strong></div>
      </article>`);
fs.writeFileSync(htmlFile,html);

let css=fs.readFileSync(cssFile,'utf8');
if(!css.includes('/* climate-forecast-ui-v7 */')){
  css+=`
/* climate-forecast-ui-v7 */
.climateForecastPanel{margin-top:8px;padding:12px;border:1px solid var(--line);border-radius:16px;background:#fff;box-shadow:var(--shadow)}
.climateForecastHead{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.climateForecastHead small{display:block;color:var(--green);font-size:.49rem;font-weight:950;letter-spacing:.14em}
.climateForecastHead h3{margin:3px 0 0;font-size:.84rem}
.climateReliability,.forecastHighlights{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:9px}
.climateReliability{grid-template-columns:repeat(3,minmax(0,1fr))}
.climateReliability>div,.forecastHighlights>div{padding:8px;border:1px solid var(--line);border-radius:11px;background:#f8fbf9}
.climateReliability small,.forecastHighlights small{display:block;color:var(--muted);font-size:.43rem}
.climateReliability strong,.forecastHighlights strong{display:block;margin-top:4px;font-size:.6rem;line-height:1.2}
.forecastTitleRow{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:11px;margin-bottom:6px}
.forecastTitleRow strong{font-size:.58rem}.forecastTitleRow small{color:var(--muted);font-size:.44rem}
.forecastHourly{display:flex;gap:6px;overflow-x:auto;padding-bottom:3px;scrollbar-width:none}.forecastHourly::-webkit-scrollbar{display:none}
.forecastHour{flex:0 0 84px;padding:8px;border:1px solid var(--line);border-radius:11px;background:#fff}
.forecastHour b{display:block;font-size:.58rem}.forecastHour strong{display:block;margin-top:5px;font-size:.68rem}.forecastHour span{display:block;margin-top:4px;color:var(--muted);font-size:.43rem;line-height:1.25}
.forecastDaily{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px}
.forecastDay{min-width:0;padding:8px 5px;border:1px solid var(--line);border-radius:10px;background:#f8fbf9;text-align:center}
.forecastDay b{display:block;font-size:.5rem}.forecastDay strong{display:block;margin-top:5px;font-size:.58rem}.forecastDay span{display:block;margin-top:3px;color:var(--muted);font-size:.41rem;line-height:1.2}
.forecastNote{margin:9px 0 0;color:var(--muted);font-size:.48rem;line-height:1.35}
.operationCard.tone-starting_on,.operationCard.tone-stopping_off{border-color:#cbded6;background:linear-gradient(145deg,#fff,#f4faf7)}
.auto3Box{margin-top:15px;padding-top:14px;border-top:1px solid var(--line)}
.auto3Box>p{margin:8px 0 10px;color:#62736b;font-size:.61rem;line-height:1.42}
.auto3Grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;padding:9px;border:1px solid var(--line);border-radius:12px;background:#f8fbf9}
.auto3Grid>div{min-width:0;padding:4px 5px}.auto3Grid small{display:block;color:var(--muted);font-size:.45rem}.auto3Grid strong{display:block;margin-top:4px;font-size:.64rem;line-height:1.25}
@media(max-width:560px){
  .appMain{padding-bottom:calc(132px + env(safe-area-inset-bottom))}
  .auto3Grid,.forecastHighlights{grid-template-columns:repeat(2,minmax(0,1fr))}
  .climateReliability{grid-template-columns:repeat(3,minmax(0,1fr))}
  .metricGrid,.todayGrid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .operationCard{grid-template-columns:42px minmax(0,1fr) 106px}
  .automationSummary{padding:12px}
  .forecastDaily{grid-template-columns:repeat(5,76px);overflow-x:auto}
}
`;
  fs.writeFileSync(cssFile,css);
}

let app=fs.readFileSync(appFile,'utf8');
const sessionMarker='async function ensureSecureSession(){\n';
if(app.includes(sessionMarker)&&!app.includes("startsWith('f2e.')"))app=app.replace(sessionMarker,sessionMarker+"  if(String(store.settings.token||'').startsWith('f2e.')){app.sessionReady=false;app.authChecked=true;return true;}\n");

const operationRegex=/function renderOperation\(\)\{[\s\S]*?\n\}\n\nfunction renderMetrics\(\)\{/;
const realtimeOperation=`function renderOperation(){
  const d=app.dashboard||{},fallback=d.intelligence?.operation||{},s=seconds();
  const phase=String(s.phase||fallback.phase||'');
  let code=fallback.code||'neutral',label=fallback.label||'AGUARDANDO',detail=fallback.detail||'Aguardando estado do sistema.',nextAt=0,nextLabel='Próximo evento';
  if(phase==='starting_on'){code='starting_on';label='LIGANDO';detail='Comando enviado. Aguardando confirmação da saída.';nextLabel='Confirmação';}
  else if(phase==='on'){code='irrigating';label='IRRIGANDO';detail='Saída do viveiro ligada.';nextAt=num(s.expected_off_at);nextLabel='Desliga';}
  else if(phase==='stopping_off'){code='stopping_off';label='DESLIGANDO';detail='Tempo concluído. Confirmando desligamento da saída.';nextLabel='Confirmação';}
  else if(phase==='off'){code='interval';label='INTERVALO';detail='Saída desligada. Aguardando o próximo pulso.';nextAt=num(s.expected_next_on_at);nextLabel='Liga';}
  else if(phase==='waiting_window'){code='waiting_schedule';label='AGUARDANDO HORÁRIO';detail='Automação armada fora da janela de irrigação.';nextAt=num(s.next_window_at);nextLabel='Próximo início';}
  else if(phase==='weather_blocked'){code='rain';label='PAUSADO POR CHUVA';detail='A Weather2-2 detectou chuva e manteve a saída desligada.';}
  else if(phase==='waiting_after_rain'){code='rain';label='AGUARDANDO APÓS CHUVA';detail='Aguardando o período de segurança para retomar.';}
  else if(phase==='weather_unavailable'){code='emergency';label='CLIMA INDISPONÍVEL';detail='Weather2-2 sem dados. Irrigação desligada por segurança.';}
  else if(phase==='maintenance'){code='neutral';label='MANUTENÇÃO';detail='Automação temporariamente bloqueada pelo modo manutenção.';}
  else if(phase==='emergency_stopped'){code='emergency';label='PARADA DE EMERGÊNCIA';detail='Saída bloqueada até liberação manual.';}
  $('operationLabel').textContent=label;
  $('operationDetail').textContent=detail;
  $('operationCard').className='operationCard tone-'+code;
  $('operationIcon').textContent=code==='irrigating'?'●':code==='interval'?'◷':code==='rain'?'☂':code==='emergency'?'!':code==='starting_on'?'▶':code==='stopping_off'?'■':'◷';
  if(!nextAt&&phase!=='starting_on'&&phase!=='stopping_off')nextAt=num(fallback.next_event_at);
  $('nextEventLabel').textContent=nextLabel||fallback.next_event_label||'Próximo evento';
  $('nextEventValue').dataset.at=String(nextAt||0);
  $('nextEventValue').textContent=nextAt?fmtSeconds(Math.max(0,(nextAt-Date.now())/1000)):(phase==='starting_on'||phase==='stopping_off'?'aguarde':'—');
  const deviceAt=num(s.last_confirmation_at||s.state_updated_at||app.lastStatusAt),weatherAt=num(weather().checked_at||d.weather?.state?.lastWeatherAt);
  $('deviceAge').textContent=fmtAge(deviceAt);$('weatherAge').textContent=fmtAge(weatherAt);$('liveAge').textContent=app.liveConnected?fmtAge(app.lastLiveAt):'reconectando';
  setDot('deviceDot',app.status?.online===true?true:app.status?.online===false?false:null);setDot('weatherDot',weather()?.linked&&weather()?.error==null?true:weather()?.error?false:null);setDot('liveDot',app.liveConnected?true:false);
  const active=Boolean(s.enabled);$('emergencyBtn').hidden=!active&&!d.safety?.emergency_latched;
}

function renderMetrics(){`;
if(operationRegex.test(app))app=app.replace(operationRegex,realtimeOperation);else throw new Error('renderOperation não encontrado para atualização em tempo real.');

const oldClimate="  const v=cs.last_vpd??cs.vpd;\n  const r=m.rainGeneric?.value??m.rain24h?.value;";
const newClimate="  const currentClimate=d.climate?.current||{};\n  const v=currentClimate.fresh?currentClimate.vpd:null;\n  const r=m.rainGeneric?.value??m.rain24h?.value;";
if(app.includes(oldClimate))app=app.replace(oldClimate,newClimate);
const oldHint="  $('vpd').textContent=Number.isFinite(Number(v))?Number(v).toFixed(2)+' kPa':'—';\n  $('rain').textContent=";
const newHint="  $('vpd').textContent=Number.isFinite(Number(v))?Number(v).toFixed(2)+' kPa':'—';\n  if($('vpdHint'))$('vpdHint').textContent=currentClimate.fresh?'Calculado da leitura atual':currentClimate.observed_at?'Leitura climática antiga':'Aguardando leitura sincronizada';\n  $('rain').textContent=";
if(app.includes(oldHint))app=app.replace(oldHint,newHint);
const oldLevel="  const level=String(cs.drying_level_label||cs.drying_level||cs.last_level||cs.level||'').replaceAll('_',' ');";
const newLevel="  const level=currentClimate.fresh?String(currentClimate.level_label||currentClimate.level||'').replaceAll('_',' '):'';";
if(app.includes(oldLevel))app=app.replace(oldLevel,newLevel);

if(!app.includes("const shadow3=d.climate?.shadow3||{};")){
  const marker="  $('autoReason').textContent=intel.cycle_reason?.detail||cs.last_reason||'Aguardando avaliação climática.';";
  if(!app.includes(marker))throw new Error('Renderização Automático 2.0 não encontrada.');
  app=app.replace(marker,marker+`
  const shadow3=d.climate?.shadow3||{};
  if($('auto3ShadowBox')){
    const st=String(shadow3.status||'observing');const lb=st==='shadow_recommendation'?'SIMULARIA':st==='stable'?'ESTÁVEL':st==='outside_schedule'?'FORA DO HORÁRIO':st==='blocked'?'CHUVA':'OBSERVANDO';
    setBadge($('auto3Badge'),lb,shadow3.would_act?'warn':'');$('auto3Title').textContent=shadow3.level_label?shadow3.level_label+' • sem controlar':'Observando sem controlar';$('auto3Reason').textContent=shadow3.reason||'O 3.0 calcula em paralelo, mas não envia comandos para a bomba.';
    const a=num(shadow3.current_on_seconds),b=num(shadow3.current_off_seconds),c=num(shadow3.target_on_seconds),e=num(shadow3.target_off_seconds);$('auto3Current').textContent=a&&b?a+' s / '+b+' s':'—';$('auto3Target').textContent=c&&e?c+' s / '+e+' s':'—';$('auto3Confidence').textContent=shadow3.confidence_label||'—';if($('auto3WeatherAge'))$('auto3WeatherAge').textContent=shadow3.weather_observed_at?(shadow3.weather_fresh?'Atual • '+fmtAge(shadow3.weather_observed_at):'Antiga • '+fmtAge(shadow3.weather_observed_at)):'Aguardando';
  }`);
}

const statusDetailOld="      ?'O sistema registrou uma ocorrência que merece acompanhamento.'";
const statusDetailNew="      ?(num(incidents.totals?.open)>0?'Existe uma ocorrência aberta que merece acompanhamento.':'Houve uma ocorrência hoje, mas não existe incidente aberto agora.')";
if(app.includes(statusDetailOld))app=app.replace(statusDetailOld,statusDetailNew);

if(!app.includes('function renderClimateForecast(')){
  const end=app.lastIndexOf('})();');if(end<0)throw new Error('Final do app não encontrado.');
  const code=`
function forecastClock(v){if(!v)return'—';const d=new Date(v);return d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});}
function forecastDay(v){if(!v)return'—';const d=new Date(v+'T12:00:00');return d.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','');}
function renderClimateForecast(f){
  if(!$('climateForecastPanel')||!f?.ok)return;
  const s=f.summary||{},local=weather()?.metrics||{},model=f.current||{};
  const lt=Number(local.temperature?.value),lh=Number(local.humidity?.value),mt=Number(model.temperature_2m),mh=Number(model.relative_humidity_2m);
  const tDiff=Number.isFinite(lt)&&Number.isFinite(mt)?Math.abs(lt-mt):null,hDiff=Number.isFinite(lh)&&Number.isFinite(mh)?Math.abs(lh-mh):null;
  const agrees=tDiff!=null&&hDiff!=null?(tDiff<=2.5&&hDiff<=12):null;
  setBadge($('forecastBadge'),f.stale?'DADOS SALVOS':agrees===true?'CONFIÁVEL':agrees===false?'DIVERGÊNCIA':'PREVISÃO',f.stale||agrees===false?'warn':'');
  $('forecastProvider').textContent=f.provider||'Open-Meteo';$('forecastAgreement').textContent=agrees==null?'Aguardando':agrees?'Estação e modelo próximos':'Modelo difere da estação';
  const nr=s.next_rain;$('forecastNextRain').textContent=nr?forecastClock(nr.time)+' • '+Math.round(num(nr.precipitation_probability))+'%':'Sem chuva forte';
  $('forecastRain24').textContent=Math.round(num(s.max_rain_probability_24h))+'%';$('forecastVpd24').textContent=num(s.max_vpd_24h).toFixed(2)+' kPa';$('forecastEt024').textContent=num(s.et0_24h).toFixed(1)+' mm';
  $('forecastUpdated').textContent=f.generated_at?'atualizada há '+fmtAge(f.generated_at):'—';
  const hourly=(f.hourly||[]).filter((_,i)=>i%2===0).slice(0,8);
  $('forecastHourly').innerHTML=hourly.map(x=>'<div class="forecastHour"><b>'+esc(forecastClock(x.time))+'</b><strong>'+esc(Number(x.temperature_2m).toFixed(0)+'°')+'</strong><span>💧 '+esc(Math.round(num(x.relative_humidity_2m))+'%')+'</span><span>🌧 '+esc(Math.round(num(x.precipitation_probability))+'%')+'</span><span>VPD '+esc(num(x.vapour_pressure_deficit).toFixed(1))+'</span><span>'+esc(x.risk?.label||'')+'</span></div>').join('')||'<span class="panelNote">Previsão horária indisponível.</span>';
  $('forecastDaily').innerHTML=(f.daily||[]).slice(0,5).map(x=>'<div class="forecastDay"><b>'+esc(forecastDay(x.time))+'</b><strong>'+esc(Math.round(num(x.temperature_min))+'–'+Math.round(num(x.temperature_max))+'°')+'</strong><span>🌧 '+esc(Math.round(num(x.precipitation_probability_max))+'%')+'</span><span>'+esc(num(x.precipitation_sum).toFixed(1)+' mm')+'</span></div>').join('')||'<span class="panelNote">Previsão diária indisponível.</span>';
  $('forecastNote').textContent=(f.model_note||'')+(f.stale?' • A fonte externa está temporariamente indisponível; usando a última previsão salva.':'');
}
async function refreshClimateForecast(){if(!hasAuth()||!$('climateForecastPanel'))return;try{renderClimateForecast(await api('/api/weather/forecast'))}catch(error){setBadge($('forecastBadge'),'INDISPONÍVEL','warn');$('forecastNote').textContent='Previsão externa indisponível agora. A Weather2-2 continua sendo usada normalmente no controle da irrigação.';}}
function renderServerDiagnostics(d){const badge=$('diagOverallBadge');if(!badge)return;const alerts=Array.isArray(d?.alerts)?d.alerts:[];const critical=alerts.some(x=>x?.level==='critical');setBadge(badge,critical?'CRÍTICO':alerts.length?'ATENÇÃO':'SAUDÁVEL',critical?'bad':alerts.length?'warn':'');const total=num(d?.server?.memory?.total_mb),free=num(d?.server?.memory?.free_mb);$('diagServerRam').textContent=total?Math.round(free)+' MB livres / '+Math.round(total)+' MB':'—';$('diagProcessRam').textContent=d?.checks?.maintenance?.ok?Math.round(num(d.checks.maintenance.value?.memory?.rss_mb))+' MB RAM':'Indisponível';const hist=d?.checks?.local_history;$('diagHistory').textContent=hist?.ok?num(hist.value?.rows).toLocaleString('pt-BR')+' registros':'Indisponível';const syncAt=num(hist?.value?.sync?.last_success_at);$('diagSync').textContent=syncAt?'Atualizado há '+fmtAge(syncAt):'Aguardando';const maint=d?.checks?.maintenance,backups=maint?.value?.backups||{},backupAt=num(backups?.last?.at);$('diagBackup').textContent=maint?.ok?String(num(backups.count))+' arquivos'+(backupAt?' • há '+fmtAge(backupAt):''):'Indisponível';const fb=d?.checks?.firebase;$('diagFirebase').textContent=fb?.ok?'Online • '+Math.round(num(fb.ms))+' ms':'Indisponível';$('diagCheckedAt').textContent=d?.checked_at?localDateTime(d.checked_at):'—';$('diagAlerts').textContent=alerts.length?alerts.map(x=>x?.message).filter(Boolean).join(' • '):'Servidor Oracle, histórico, sincronização, backups e Firebase funcionando normalmente.';}
async function refreshServerDiagnostics(){if(!hasAuth()||!$('serverDiagnosticsPanel'))return;try{renderServerDiagnostics(await api('/api/irrigation/diagnostics'))}catch(error){const b=$('diagOverallBadge');if(b)setBadge(b,'INDISPONÍVEL','bad');if($('diagAlerts'))$('diagAlerts').textContent='Não foi possível atualizar o diagnóstico: '+(error?.message||'erro de comunicação')}}
qsa('[data-view="system"]').forEach(el=>el.addEventListener('click',()=>setTimeout(refreshServerDiagnostics,200)));
setTimeout(refreshClimateForecast,1800);setInterval(refreshClimateForecast,10*60000);setTimeout(refreshServerDiagnostics,1500);setInterval(refreshServerDiagnostics,30000);
`;
  app=app.slice(0,end)+code+app.slice(end);
}
fs.writeFileSync(appFile,app);
console.log('Irrigação: tempo real imediato, previsão agrícola, Automático 3.0 e diagnóstico aplicados.');
