(()=>{
  'use strict';
  const byId=id=>document.getElementById(id);
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const titleOf=el=>el?.querySelector('h2')?.textContent?.trim()||'';
  const sectionByTitle=title=>qsa('main.wrap section').find(s=>titleOf(s)===title)||null;

  function bind(el,key,handler){
    if(!el||el.dataset[key]==='1')return;
    el.addEventListener('click',handler);
    el.dataset[key]='1';
  }
  function bindChange(el,key,handler){
    if(!el||el.dataset[key]==='1')return;
    el.addEventListener('change',handler);
    el.dataset[key]='1';
  }

  function normalizeControls(){
    qsa('button:not([type])').forEach(b=>b.type='button');
  }

  function renamePrimary(){
    const header=qs('.top h1');
    if(header)header.textContent='Viveiro';
    const heroKicker=qs('.hero .ey');
    if(heroKicker)heroKicker.textContent='VIVEIRO • TEMPO REAL';

    const seconds=sectionByTitle('Ciclo rápido');
    if(seconds){
      const h=seconds.querySelector('h2');if(h)h.textContent='Programação';
      const k=seconds.querySelector('.sectionKicker');if(k)k.textContent='Perfil do viveiro';
    }
    const weather=sectionByTitle('Proteção automática por chuva');
    if(weather){const h=weather.querySelector('h2');if(h)h.textContent='Proteção por chuva'}
    const climate=byId('climateAdviceBox');
    if(climate){
      const h=climate.querySelector('h2');if(h)h.textContent='Automático 2.0';
    }
  }

  function ensureModeSelector(){
    const auto=byId('climateAutoBtn');
    const observe=byId('climateObserveBtn');
    if(!auto||!observe)return;
    const group=auto.parentElement;
    group?.classList.add('smartModeGroup');
    let manual=byId('climateManualBtn');
    if(!manual){
      manual=document.createElement('button');
      manual.type='button';
      manual.id='climateManualBtn';
      manual.className='climateSwitch';
      manual.textContent='Manual';
      group?.insertBefore(manual,observe);
    }
    bind(manual,'smartBound',()=>{
      const autoActive=auto.classList.contains('auto');
      const observeActive=observe.classList.contains('auto');
      if(autoActive&&typeof setClimateAutomatic==='function')setClimateAutomatic();
      else if(observeActive&&typeof setClimateObservation==='function')setClimateObservation();
    });
    updateModeState();
  }

  function updateModeState(){
    const manual=byId('climateManualBtn');
    const observe=byId('climateObserveBtn');
    const auto=byId('climateAutoBtn');
    if(!manual||!observe||!auto)return;
    const autoActive=auto.classList.contains('auto');
    const observeActive=observe.classList.contains('auto');
    const manualActive=!autoActive&&!observeActive;
    manual.classList.toggle('auto',manualActive);
    manual.setAttribute('aria-pressed',String(manualActive));
    observe.setAttribute('aria-pressed',String(observeActive));
    auto.setAttribute('aria-pressed',String(autoActive));
    manual.textContent=manualActive?'Manual ativo':'Manual';
  }

  function bindMissingActions(){
    bind(byId('climateObserveBtn'),'smartBound',()=>{
      if(typeof setClimateObservation==='function')setClimateObservation();
      setTimeout(updateModeState,600);
    });
    bind(byId('climateAutoBtn'),'smartBound',()=>{
      if(typeof setClimateAutomatic==='function')setClimateAutomatic();
      setTimeout(updateModeState,600);
    });
    bind(byId('climateApply'),'smartBound',()=>typeof answerClimateSuggestion==='function'&&answerClimateSuggestion(true));
    bind(byId('climateReject'),'smartBound',()=>typeof answerClimateSuggestion==='function'&&answerClimateSuggestion(false));
    bind(byId('enableNotifications'),'smartBound',()=>typeof enableBrowserNotifications==='function'&&enableBrowserNotifications());
    bind(byId('refreshDashboard'),'smartBound',()=>typeof syncDashboard==='function'&&syncDashboard(true));
    bind(byId('saveFastPreset'),'smartBound',()=>typeof saveNamedPreset==='function'&&saveNamedPreset());

    bindChange(byId('fastPresetSelect'),'smartBoundChange',ev=>{
      const name=String(ev.currentTarget.value||'');
      if(name&&typeof applyNamedPreset==='function')applyNamedPreset(name);
    });

    qsa('.maintenanceBtn').forEach(btn=>bind(btn,'smartBound',()=>{
      const mins=Number(btn.dataset.minutes||0);
      if(typeof setMaintenance==='function')setMaintenance(mins);
    }));

    qsa('.dayShortcut').forEach(btn=>bind(btn,'smartBound',()=>{
      const mask=Number(btn.dataset.mask||0);
      if(typeof secondsEditorTouched!=='undefined')secondsEditorTouched=true;
      qsa('#secondsDays input').forEach(cb=>{cb.checked=Boolean(mask&Number(cb.value))});
      if(typeof updateFastCycleDraftUI==='function')updateFastCycleDraftUI();
      if(typeof validateFastCycle==='function')validateFastCycle();
    }));

    qsa('.auditFilter').forEach(btn=>bind(btn,'smartBound',()=>{
      if(typeof data!=='undefined'){
        data.auditFilter=String(btn.dataset.filter||'all');
        if(typeof save==='function')save();
        if(typeof renderDashboard==='function')renderDashboard();
      }
    }));
  }

  function moveEmergencyIntoFlow(){
    const hero=qs('main.wrap > .hero');
    const stop=byId('emergencyStop');
    if(!hero||!stop)return;
    let row=byId('smartSafety');
    if(!row){
      row=document.createElement('div');
      row.id='smartSafety';
      row.className='smartSafety';
      hero.insertAdjacentElement('afterend',row);
    }
    if(stop.parentElement!==row)row.appendChild(stop);
    stop.textContent='PARAR IRRIGAÇÃO AGORA';
  }

  function ensureProfileCard(){
    const main=qs('main.wrap');
    if(!main)return null;
    let card=byId('viveiroProfileCard');
    if(!card){
      card=document.createElement('section');
      card.id='viveiroProfileCard';
      card.className='box smartProfileCard smartOverviewCard';
      card.innerHTML=
        '<div class="smartOverviewHead">'+
          '<div><span class="sectionKicker">AGORA</span><h2>Resumo do viveiro</h2></div>'+
          '<span id="smartClimateBadge" class="profileBadge">ATIVO</span>'+
        '</div>'+
        '<div class="smartOverviewGrid">'+
          '<div><small>Ciclo atual</small><strong id="smartClimateCycle">—</strong></div>'+
          '<div><small>Ciclo-base</small><strong id="smartBaseCycle">—</strong></div>'+
          '<div><small>Temperatura</small><strong id="smartOverviewTemp">—</strong></div>'+
          '<div><small>Umidade</small><strong id="smartOverviewHumidity">—</strong></div>'+
        '</div>'+
        '<div class="smartIntensity">'+
          '<div class="smartIntensityTop"><span><small>Intensidade</small><b id="smartIntensityText">Normal</b></span><span id="smartIntensityDelta">0%</span></div>'+
          '<div class="smartIntensityTrack"><i id="smartIntensityFill"></i></div>'+
        '</div>'+
        '<div class="smartClimateLine">'+
          '<span><small>Condição</small><b id="smartClimateLevel">Aguardando</b></span>'+
          '<span><small>Tendência</small><b id="smartTrendText">Aguardando</b></span>'+
        '</div>'+
        '<p id="smartClimateReason" class="note smartOverviewReason">Aguardando avaliação climática.</p>'+
        '<div class="smartWhyCycle"><small>Por que este ciclo?</small><strong id="smartWhyCycleTitle">Aguardando</strong><span id="smartWhyCycleDetail"></span></div>'+
        '<div class="smartDecisionSummary">'+
          '<small>Última decisão</small><strong id="smartLastDecision">Aguardando</strong>'+
          '<span id="smartLastDecisionTime"></span>'+
        '</div>'+
        '<div class="smartOverviewMeta">'+
          '<span><small>Modo</small><b id="profileMode">Automático 2.0</b></span>'+
          '<span><small>Próxima avaliação</small><b id="smartNextEval">—</b></span>'+
          '<span><small>Horário</small><b id="profileSchedule">—</b></span>'+
          '<span><small>Confiança</small><b id="smartClimateConfidence">—</b></span>'+
        '</div>'+
        '<button type="button" id="openProfileConfig" class="btn soft smartOverviewAction">Automação e horários</button>';
      main.appendChild(card);
    }
    bind(byId('openProfileConfig'),'smartBound',()=>showView('perfil'));
    return card;
  }
  function ensureClimateStatus(){
    const card=byId('viveiroProfileCard')||ensureProfileCard();
    updateClimateStatus();
    return card;
  }
  function updateClimateStatus(){
    let sec={},cc={},cs={};
    try{
      sec=(typeof data!=='undefined'&&data.secondsMode)||{};
      cc=(typeof data!=='undefined'&&data.dashboard?.climate?.config)||{};
      cs=(typeof data!=='undefined'&&data.dashboard?.climate?.state)||{};
    }catch{}
    const outside=String(cs.last_decision||'')==='outside_schedule';
    const mode=outside?'AGUARDANDO HORÁRIO':cc.observation?'OBSERVAÇÃO':cc.automatic?'AUTOMÁTICO':'MANUAL';
    const badge=byId('smartClimateBadge');
    if(badge){
      badge.textContent=mode;
      badge.classList.toggle('warn',outside||mode==='MANUAL'||mode==='OBSERVAÇÃO');
    }
    const baseOn=Number(sec.base_on_seconds||sec.on_seconds||30);
    const baseOff=Number(sec.base_off_seconds||sec.off_seconds||120);
    const on=Number(sec.on_seconds||baseOn);
    const off=Number(sec.off_seconds||baseOff);
    if(byId('smartClimateCycle'))byId('smartClimateCycle').textContent=on+' s / '+off+' s';
    if(byId('smartClimateLevel'))byId('smartClimateLevel').textContent=outside
      ?'Aguardando janela'
      :String(cs.drying_level_label||'Aguardando');
    let liveWeather={};
    try{liveWeather=(typeof data!=='undefined'&&data.weatherProtection?.weather?.metrics)||{}}catch{}
    const liveTemp=Number(liveWeather?.temperature?.value);
    const liveHumidity=Number(liveWeather?.humidity?.value);
    const temp=Number.isFinite(liveTemp)?liveTemp:Number(cs.last_temperature);
    const humidity=Number.isFinite(liveHumidity)?liveHumidity:Number(cs.last_humidity);
    if(byId('smartOverviewTemp'))byId('smartOverviewTemp').textContent=Number.isFinite(temp)?temp.toFixed(1)+' °C':'—';
    if(byId('smartOverviewHumidity'))byId('smartOverviewHumidity').textContent=Number.isFinite(humidity)?Math.round(humidity)+'%':'—';
    if(byId('smartClimateReason')){
      byId('smartClimateReason').textContent=outside
        ?'Automático 2.0 aguardando o horário programado. Fora da janela ele não altera o ciclo.'
        :String(cs.last_reason||'Aguardando avaliação climática.');
    }
  }
  function fmtDuration(seconds){
    const s=Math.max(0,Math.round(Number(seconds)||0));
    if(typeof humanDurationSeconds==='function')return humanDurationSeconds(s);
    if(s<60)return s+' s';
    const m=Math.floor(s/60),r=s%60;
    return m+' min'+(r?' '+r+' s':'');
  }
  function relativeTime(ts){
    const n=Number(ts||0);
    if(!n)return '—';
    const diff=n-Date.now();
    if(diff<=0)return 'agora';
    const sec=Math.ceil(diff/1000);
    if(sec<60)return 'em '+sec+' s';
    const min=Math.ceil(sec/60);
    if(min<120)return 'em '+min+' min';
    const target=new Date(n);
    const now=new Date();
    const sameDay=target.toDateString()===now.toDateString();
    const tomorrow=new Date(now);tomorrow.setDate(now.getDate()+1);
    const isTomorrow=target.toDateString()===tomorrow.toDateString();
    const clock=new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(target);
    return sameDay?'às '+clock:isTomorrow?'amanhã '+clock:new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(target);
  }
  function shortClock(ts){
    const n=Number(ts||0);
    if(!n)return '';
    return new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(new Date(n));
  }
  function trendLabel(cs={}){
    const t=Number(cs.trend_temp_slope_per_10m||0);
    const h=Number(cs.trend_humidity_slope_per_10m||0);
    const v=Number(cs.trend_vpd_slope_per_10m||0);
    if(v>=.18||t>=1.2||h<=-6)return 'Secando rápido ↑';
    if(v<=-.18&&t<=-.5)return 'Ficando mais úmido ↓';
    if(Math.abs(v)<.08&&Math.abs(t)<.6)return 'Estável';
    return v>0?'Secando ↑':'Aliviando ↓';
  }
  function decisionText(row){
    if(!row)return 'Nenhuma mudança importante recente.';
    if(row.to_on&&row.to_off&&row.from_on&&row.from_off){
      return row.title+': '+row.from_on+'/'+row.from_off+' → '+row.to_on+'/'+row.to_off+' s';
    }
    return row.title+(row.detail?': '+row.detail:'');
  }
  function ensureOperationalCard(){
    const main=qs('main.wrap');
    if(!main)return null;
    let card=byId('smartOperatingCard');
    if(!card){
      card=document.createElement('section');
      card.id='smartOperatingCard';
      card.className='smartOperatingCard';
      card.innerHTML=
        '<div class="smartOperatingState"><i></i><div><small>ESTADO AGORA</small><strong id="smartOperatingLabel">VERIFICANDO</strong><span id="smartOperatingDetail">Aguardando o servidor...</span></div></div>'+
        '<div class="smartOperatingNext"><small id="smartOperatingNextLabel">Próximo evento</small><strong id="smartOperatingNext">—</strong></div>';
      main.appendChild(card);
    }
    return card;
  }
  function ensureHealthStrip(){
    const main=qs('main.wrap');
    if(!main)return null;
    let el=byId('smartHealthStrip');
    if(!el){
      el=document.createElement('button');
      el.type='button';
      el.id='smartHealthStrip';
      el.className='smartHealthStrip';
      el.innerHTML='<i></i><span><b id="smartHealthTitle">Verificando sistema</b><small id="smartHealthDetail">Aguardando dados</small></span><em>›</em>';
      bind(el,'smartBound',()=>showView('sistema'));
      main.appendChild(el);
    }
    return el;
  }
  function ensureDailyCompare(){
    const box=byId('todayBox');
    if(!box)return null;
    let el=byId('smartDailyCompare');
    if(!el){
      el=document.createElement('div');
      el.id='smartDailyCompare';
      el.className='smartDailyCompare';
      el.innerHTML=
        '<div><small>Tempo irrigado</small><strong id="smartTodayIrrigated">—</strong></div>'+
        '<div><small>Referência do ciclo-base</small><strong id="smartTodayBase">—</strong></div>'+
        '<div class="wide"><small>Comparação com o ciclo-base</small><strong id="smartTodayDelta">—</strong><div class="smartCompareTrack"><i id="smartCompareFill"></i></div><span id="smartTodayCompareNote" class="smartCompareNote"></span></div>';
      box.appendChild(el);
    }
    const legacyWater=byId('todayWaterTime')?.closest('.todayCard');
    if(legacyWater)legacyWater.classList.add('smartUiHidden');
    return el;
  }
  function ensureDecisionTimeline(){
    const main=qs('main.wrap');
    if(!main)return null;
    let box=byId('smartDecisionBox');
    if(!box){
      box=document.createElement('section');
      box.id='smartDecisionBox';
      box.className='box smartDecisionBox';
      box.innerHTML=
        '<div class="head"><div><span class="sectionKicker">DECISÕES</span><h2>O que o sistema fez</h2></div></div>'+
        '<p class="note">Somente mudanças relevantes de clima, chuva, ciclo e segurança.</p>'+
        '<div id="smartDecisionList" class="smartDecisionList"><div class="empty">Aguardando histórico...</div></div>';
      main.appendChild(box);
    }
    return box;
  }
  function ensureSystemSummary(){
    const box=byId('systemHealthBox');
    if(!box)return null;
    let el=byId('smartSystemSummary');
    if(!el){
      el=document.createElement('div');
      el.id='smartSystemSummary';
      el.className='smartSystemSummary';
      el.innerHTML='<span class="smartSystemDot"></span><div><b id="smartSystemTitle">Verificando</b><small id="smartSystemDetail">Aguardando dados...</small></div>';
      const ops=qs('.opsGrid',box);
      if(ops)box.insertBefore(el,ops);else box.appendChild(el);
    }
    let details=byId('smartSystemDetails');
    if(!details){
      details=document.createElement('details');
      details.id='smartSystemDetails';
      details.className='smartSystemDetails';
      details.innerHTML='<summary>Ver detalhes técnicos</summary>';
      const ops=qs('.opsGrid',box);
      const diag=qs('.diag',box);
      if(ops)details.appendChild(ops);
      if(diag)details.appendChild(diag);
      box.appendChild(details);
    }
    return el;
  }
  function renderOperationalIntelligence(){
    let d={},sec={},cs={};
    try{
      d=(typeof data!=='undefined'&&data.dashboard)||{};
      sec=(typeof data!=='undefined'&&data.secondsMode)||{};
      cs=d.climate?.state||{};
    }catch{}
    const intel=d.intelligence||{};
    const intensity=intel.intensity||{};
    const baseOn=Number(sec.base_on_seconds||sec.on_seconds||30);
    const baseOff=Number(sec.base_off_seconds||sec.off_seconds||120);
    if(byId('smartBaseCycle'))byId('smartBaseCycle').textContent=baseOn+' s / '+baseOff+' s';
    if(byId('smartIntensityText'))byId('smartIntensityText').textContent=String(intensity.label||'Normal');
    const pct=Number(intensity.change_percent||0);
    if(byId('smartIntensityDelta'))byId('smartIntensityDelta').textContent=(pct>0?'+':'')+pct.toFixed(0)+'% vs base';
    const fill=byId('smartIntensityFill');
    if(fill){
      const pos=Math.max(8,Math.min(100,50+pct));
      fill.style.width=pos+'%';
      fill.dataset.level=String(intensity.level||'normal');
    }
    if(byId('smartTrendText'))byId('smartTrendText').textContent=
      String(cs.last_decision||'')==='outside_schedule'?'Aguardando janela':trendLabel(cs);
    if(byId('smartClimateConfidence'))byId('smartClimateConfidence').textContent=String(cs.confidence_label||'—');
    if(byId('smartNextEval'))byId('smartNextEval').textContent=relativeTime(intel.next_evaluation_at);

    const decisions=Array.isArray(intel.decisions)?intel.decisions:[];
    const lastDecision=decisions.find(x=>['climate','weather','critical','warning'].includes(String(x.kind||'')))||decisions[0]||null;
    if(byId('smartLastDecision'))byId('smartLastDecision').textContent=decisionText(lastDecision);
    if(byId('smartLastDecisionTime'))byId('smartLastDecisionTime').textContent=lastDecision?.ts?shortClock(lastDecision.ts):'';

    const op=intel.operation||{};
    const opCard=byId('smartOperatingCard');
    const safetyRow=byId('smartSafety');
    const emergencyBtn=byId('emergencyStop');
    const showEmergency=['irrigating','interval','starting'].includes(String(op.code||''));
    if(safetyRow)safetyRow.classList.toggle('show',showEmergency);
    if(emergencyBtn)emergencyBtn.setAttribute('aria-hidden',String(!showEmergency));
    if(opCard){
      opCard.dataset.tone=String(op.tone||'neutral');
      if(byId('smartOperatingLabel'))byId('smartOperatingLabel').textContent=String(op.label||'VERIFICANDO');
      if(byId('smartOperatingDetail'))byId('smartOperatingDetail').textContent=String(op.detail||'Aguardando estado...');
      if(byId('smartOperatingNextLabel'))byId('smartOperatingNextLabel').textContent=String(op.next_event_label||'Próximo evento');
      if(byId('smartOperatingNext'))byId('smartOperatingNext').textContent=op.next_event_at?relativeTime(op.next_event_at):'—';
    }

    const cycleReason=intel.cycle_reason||{};
    if(byId('smartWhyCycleTitle'))byId('smartWhyCycleTitle').textContent=String(cycleReason.title||'Aguardando');
    if(byId('smartWhyCycleDetail'))byId('smartWhyCycleDetail').textContent=String(cycleReason.detail||'');

    const health=intel.health||{};
    const strip=byId('smartHealthStrip');
    if(strip){
      strip.dataset.level=String(health.level||'warning');
      if(byId('smartHealthTitle'))byId('smartHealthTitle').textContent=String(health.message||'Verificando sistema');
      const issues=Array.isArray(health.issues)?health.issues:[];
      if(byId('smartHealthDetail'))byId('smartHealthDetail').textContent=
        issues.length?issues.slice(1,3).map(x=>x.message).join(' • ')||'Toque para ver detalhes':'Smart Life, Weather2-2 e automação monitorados';
    }

    const system=byId('smartSystemSummary');
    if(system){
      system.dataset.level=String(health.level||'warning');
      if(byId('smartSystemTitle'))byId('smartSystemTitle').textContent=String(health.message||'Verificando sistema');
      const issues=Array.isArray(health.issues)?health.issues:[];
      if(byId('smartSystemDetail'))byId('smartSystemDetail').textContent=
        issues.length?issues.map(x=>x.message).join(' • '):'Railway, Firebase, Smart Life e Weather2-2 estão respondendo.';
    }

    const sum=d.summary?.today||{};
    if(byId('smartTodayIrrigated'))byId('smartTodayIrrigated').textContent=fmtDuration(sum.irrigated_seconds);
    const comparisonComplete=String(sum.comparison_status||'')==='complete';
    if(byId('smartTodayBase'))byId('smartTodayBase').textContent=comparisonComplete
      ?fmtDuration(sum.base_expected_irrigated_seconds)
      :'Dados parciais';
    const delta=sum.versus_base_percent==null?null:Number(sum.versus_base_percent);
    if(byId('smartTodayDelta')){
      byId('smartTodayDelta').textContent=comparisonComplete&&delta!=null&&Number.isFinite(delta)
        ?(delta>0?'+':'')+delta.toFixed(0)+'% em relação ao base'
        :'Comparação indisponível hoje';
    }
    if(byId('smartTodayCompareNote'))byId('smartTodayCompareNote').textContent=
      String(sum.comparison_note||'');
    const compare=byId('smartCompareFill');
    if(compare){
      const pos=comparisonComplete&&delta!=null&&Number.isFinite(delta)?Math.max(5,Math.min(100,50+delta)):0;
      compare.style.width=pos+'%';
      compare.style.opacity=comparisonComplete?'1':'0';
    }

    const list=byId('smartDecisionList');
    if(list){
      list.textContent='';
      const rows=decisions.slice(0,12);
      if(!rows.length){
        const empty=document.createElement('div');empty.className='empty';empty.textContent='Nenhuma decisão importante registrada ainda.';list.appendChild(empty);
      }else rows.forEach(row=>{
        const item=document.createElement('div');
        item.className='smartDecisionItem';
        item.dataset.kind=String(row.kind||'info');
        const dot=document.createElement('i');
        const body=document.createElement('div');
        const title=document.createElement('b');title.textContent=String(row.title||'Evento');
        const detail=document.createElement('small');detail.textContent=decisionText(row).replace(String(row.title||'')+': ','');
        body.append(title,detail);
        const time=document.createElement('time');time.textContent=shortClock(row.ts);
        item.append(dot,body,time);list.appendChild(item);
      });
    }
  }

  function ensureAlertCenter(){
    const main=qs('main.wrap');
    if(!main)return null;
    let box=byId('smartAlerts');
    if(!box){
      box=document.createElement('section');
      box.id='smartAlerts';
      box.className='box smartAlerts';
      box.innerHTML=
        '<div class="head"><div><span class="sectionKicker">Alertas</span><h2>Notificações</h2></div></div>'+
        '<div class="smartAlertGrid">'+
          '<div class="smartAlertCard"><small>iPhone</small><strong id="smartPushState">Verificando</strong></div>'+
          '<div class="smartAlertCard"><small>WhatsApp</small><strong id="smartWhatsappState">Verificando</strong></div>'+
        '</div>'+
        '<button type="button" id="smartEnablePush" class="btn soft">Ativar avisos no iPhone</button>';
      main.appendChild(box);
    }
    bind(byId('smartEnablePush'),'smartBound',()=>typeof enableBrowserNotifications==='function'&&enableBrowserNotifications());
    renderSmartAlerts();
    return box;
  }

  function renderSmartAlerts(){
    const push=byId('smartPushState');
    const wa=byId('smartWhatsappState');
    const btn=byId('smartEnablePush');
    if(push){
      const supported=('Notification' in window);
      const permission=supported?Notification.permission:'unsupported';
      push.textContent=permission==='granted'?'Ativas':permission==='denied'?'Bloqueadas':'Desativadas';
      push.className=permission==='granted'?'ok':permission==='denied'?'bad':'';
    }
    if(btn){
      const granted=('Notification' in window)&&Notification.permission==='granted';
      btn.textContent=granted?'Avisos no iPhone ativos':'Ativar avisos no iPhone';
      btn.disabled=granted;
    }
    if(wa){
      let configured=false;
      try{configured=Boolean(typeof data!=='undefined'&&data.dashboard?.notifications?.whatsapp?.configured)}catch{}
      wa.textContent=configured?'Conectado':'Não conectado';
      wa.className=configured?'ok':'';
    }
  }

  function updateProfileSummary(){
    const sec=(typeof data!=='undefined'&&data.secondsMode)||{};
    const cc=(typeof data!=='undefined'&&data.dashboard?.climate?.config)||{};
    const mode=cc.observation?'Observação':cc.automatic?'Automático 2.0':'Manual';
    if(byId('profileMode'))byId('profileMode').textContent=mode;
    if(byId('profileSchedule')){
      const start=Number(sec.start_minutes ?? (typeof data!=='undefined'?data.secondsDraft?.start_minutes:360) ?? 360);
      const end=Number(sec.end_minutes ?? (typeof data!=='undefined'?data.secondsDraft?.end_minutes:1080) ?? 1080);
      const fmt=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
      byId('profileSchedule').textContent=fmt(start)+'–'+fmt(end);
    }
    if(byId('profileWeather')){
      const linked=Boolean(typeof data!=='undefined'&&data.weatherProtection?.weather?.linked);
      byId('profileWeather').textContent=linked?'Weather2-2 online':'Weather2-2';
    }
  }

  function makeView(id,title,subtitle){
    const main=qs('main.wrap');
    let view=byId(id);
    if(!view){
      view=document.createElement('div');
      view.id=id;
      view.className='smartView';
      view.innerHTML='<div class="smartPageTitle"><span class="sectionKicker">'+subtitle+'</span><h2>'+title+'</h2></div>';
      main.appendChild(view);
    }
    return view;
  }

  function organizeViews(){
    const main=qs('main.wrap');
    if(!main)return;

    const home=makeView('smartViewHome','Resumo','VISÃO RÁPIDA');
    const profile=makeView('smartViewProfile','Automação','CICLO, CLIMA E HORÁRIOS');
    const history=makeView('smartViewHistory','Histórico','ACOMPANHAMENTO');
    const system=makeView('smartViewSystem','Sistema','SEGURANÇA E MANUTENÇÃO');

    const hero=qs('main.wrap > .hero');
    const legacyStats=qs('main.wrap > .grid');
    if(hero)hero.classList.add('smartLegacyVisual');
    if(legacyStats)legacyStats.classList.add('smartUiHidden');
    const operation=byId('smartOperatingCard');
    const healthStrip=byId('smartHealthStrip');
    const safety=byId('smartSafety');
    const profileCard=byId('viveiroProfileCard');
    const today=byId('todayBox');
    [operation,healthStrip,safety,profileCard,today,hero].filter(Boolean).forEach(el=>home.appendChild(el));

    const climate=byId('climateAdviceBox');
    const seconds=sectionByTitle('Programação')||sectionByTitle('Ciclo rápido');
    const weather=sectionByTitle('Proteção por chuva')||sectionByTitle('Proteção automática por chuva');
    const calendar=byId('calendarBox');
    [climate,seconds,weather,calendar].filter(Boolean).forEach(el=>profile.appendChild(el));

    [byId('smartDecisionBox'),byId('weeklyBox')]
      .filter(Boolean).forEach(el=>history.appendChild(el));
    if(byId('eventsBox'))byId('eventsBox').classList.add('smartUiHidden');

    [byId('systemHealthBox'),byId('maintenanceBox'),byId('smartAlerts')]
      .filter(Boolean).forEach(el=>system.appendChild(el));

    const hiddenTitles=new Set([
      'Programação da irrigação',
      'Estado em tempo real',
      'Controle manual',
      'Ciclo já configurado',
      'Diagnóstico do ciclo',
      'Histórico do app',
      'Conexão segura • Fazenda 2E'
    ]);
    qsa('main.wrap section').forEach(el=>{
      if(hiddenTitles.has(titleOf(el)))el.classList.add('smartUiHidden');
    });
    [byId('dailyReportBox'),byId('pulseActivityBox')].filter(Boolean)
      .forEach(el=>el.classList.add('smartUiHidden'));

    const known=new Set([home,profile,history,system]);
    qsa('main.wrap > section, main.wrap > .grid').forEach(el=>{
      if(known.has(el)||el.classList.contains('smartUiHidden'))return;
      // Blocos técnicos remanescentes ficam fora da tela principal.
      system.appendChild(el);
    });

    const offline=byId('offlineBanner');
    if(offline)main.insertBefore(offline,main.firstChild);
  }
  function ensureMenu(){
    const top=qs('.top');
    if(!top)return;

    qsa('.top a.pill').forEach(a=>a.style.display='none');
    if(byId('conn'))byId('conn').style.display='none';

    let btn=byId('smartMenuBtn');
    if(!btn){
      btn=document.createElement('button');
      btn.id='smartMenuBtn';
      btn.type='button';
      btn.className='smartMenuBtn';
      btn.textContent='☰ Viveiro';
      top.appendChild(btn);
    }

    if(!byId('smartMenuOverlay')){
      const overlay=document.createElement('div');
      overlay.id='smartMenuOverlay';
      overlay.className='smartMenuOverlay';
      overlay.innerHTML=
        '<aside class="smartMenuPanel" role="dialog" aria-label="Menu do Viveiro">'+
          '<div class="smartMenuHead"><div><span>FAZENDA 2E</span><strong>Viveiro</strong></div><button type="button" id="smartMenuClose">✕</button></div>'+
          '<a class="smartSwitchProfile" href="/irrigacao/central/">← Trocar perfil</a>'+
          '<div class="smartMenuLabel">Viveiro</div>'+
          '<nav class="smartSubNav">'+
            '<button type="button" data-smart-view="inicio">Resumo do Viveiro</button>'+
            '<button type="button" data-smart-view="perfil">Configurações do Viveiro</button>'+
            '<button type="button" data-smart-view="historico">Histórico do Viveiro</button>'+
            '<button type="button" data-smart-view="sistema">Sistema e manutenção</button>'+
          '</nav>'+
          '<button type="button" id="smartConnectionBtn" class="smartConnectionBtn">Conexão do Viveiro</button>'+
        '</aside>';
      document.body.appendChild(overlay);
    }

    const overlay=byId('smartMenuOverlay');
    const open=()=>overlay.classList.add('open');
    const close=()=>overlay.classList.remove('open');
    bind(btn,'smartBound',open);
    bind(byId('smartMenuClose'),'smartBound',close);
    bind(overlay,'smartOverlayBound',e=>{if(e.target===overlay)close()});
    qsa('[data-smart-view]',overlay).forEach(b=>bind(b,'smartBound',()=>{
      showView(String(b.dataset.smartView||'inicio'));close();
    }));
    bind(byId('smartConnectionBtn'),'smartBound',()=>{
      close();
      const target=byId('settings')||byId('conn');
      if(target)target.click();
    });
  }

  const viewMap={inicio:'smartViewHome',perfil:'smartViewProfile',historico:'smartViewHistory',sistema:'smartViewSystem'};
  window.__viveiroShowView=(name)=>showView(name);
  function showView(name='inicio'){
    const key=viewMap[name]?name:'inicio';
    Object.entries(viewMap).forEach(([k,id])=>{
      const el=byId(id);if(el)el.classList.toggle('active',k===key);
    });
    qsa('[data-smart-view]').forEach(b=>b.classList.toggle('active',b.dataset.smartView===key));
    if(location.hash!=='#'+key)history.replaceState(null,'','#'+key);
    window.scrollTo({top:0,behavior:'instant'});
  }

  function auditOverflow(){
    qsa('.layoutOverflow').forEach(el=>el.classList.remove('layoutOverflow'));
    const vw=document.documentElement.clientWidth;
    const offenders=qsa('main.wrap *').filter(el=>{
      const r=el.getBoundingClientRect();
      return r.width>0&&(r.right>vw+2||r.left<-2||el.scrollWidth>el.clientWidth+3);
    }).slice(0,12);
    offenders.forEach(el=>el.classList.add('layoutOverflow'));
    if(offenders.length)console.warn('[Irrigação UI] overflow:',offenders);
    return offenders.length;
  }

  function boot(){
    document.body.classList.add('smartIrrigationV5','smartIrrigationV6','smartIrrigationV7');
    normalizeControls();
    renamePrimary();
    ensureModeSelector();
    bindMissingActions();
    moveEmergencyIntoFlow();
    ensureProfileCard();
    ensureClimateStatus();
    ensureOperationalCard();
    ensureHealthStrip();
    ensureDailyCompare();
    ensureDecisionTimeline();
    ensureSystemSummary();
    ensureAlertCenter();
    organizeViews();

    const initial=String(location.hash||'#inicio').replace('#','');
    showView(viewMap[initial]?initial:'inicio');
    updateProfileSummary();
    renderSmartAlerts();
    updateModeState();
    renderOperationalIntelligence();

    setInterval(()=>{
      updateModeState();
      updateProfileSummary();
      updateClimateStatus();
      renderSmartAlerts();
      renderOperationalIntelligence();
    },3000);

    window.addEventListener('hashchange',()=>{
      const k=String(location.hash||'#inicio').replace('#','');
      showView(viewMap[k]?k:'inicio');
    });
    window.addEventListener('resize',()=>requestAnimationFrame(auditOverflow),{passive:true});
    window.addEventListener('orientationchange',()=>setTimeout(auditOverflow,250),{passive:true});
    window.addEventListener('error',e=>console.error('[Irrigação UI runtime]',e.message||e.error));
    window.addEventListener('unhandledrejection',e=>console.error('[Irrigação UI promise]',e.reason));
    window.__irrigacaoUiAudit=()=>({overflow:auditOverflow()});
    setTimeout(auditOverflow,300);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();