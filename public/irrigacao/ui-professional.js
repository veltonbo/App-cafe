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
      if(typeof secondsActive==='function'&&secondsActive())return typeof toast==='function'&&toast('Pare o ciclo antes de alterar os dias');
      const mask=Number(btn.dataset.mask||0);
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
      card.className='box smartProfileCard';
      card.innerHTML=
        '<div class="profileTop">'+
          '<div><span class="sectionKicker">PERFIL ATIVO</span><h2>Viveiro de mudas</h2><p class="note">As configurações ficam agrupadas neste perfil.</p></div>'+
          '<span class="profileBadge">ATIVO</span>'+
        '</div>'+
        '<div class="profileSummary">'+
          '<div><small>Modo</small><strong id="profileMode">Automático 2.0</strong></div>'+
          '<div><small>Ciclo-base</small><strong>30 s / 120 s</strong></div>'+
          '<div><small>Clima</small><strong id="profileWeather">Weather2-2</strong></div>'+
          '<div><small>Horário</small><strong id="profileSchedule">—</strong></div>'+
        '</div>'+
        '<button type="button" id="openProfileConfig" class="btn primary">Configurações do perfil</button>';
      main.appendChild(card);
    }
    bind(byId('openProfileConfig'),'smartBound',()=>showView('perfil'));
    return card;
  }

  function ensureClimateStatus(){
    const main=qs('main.wrap');
    if(!main)return null;
    let box=byId('smartClimateStatus');
    if(!box){
      box=document.createElement('section');
      box.id='smartClimateStatus';
      box.className='box smartClimateStatus';
      box.innerHTML=
        '<div class="head"><div><span class="sectionKicker">AUTOMÁTICO 2.0</span><h2>Ajuste inteligente</h2></div><span id="smartClimateBadge" class="profileBadge">ATIVO</span></div>'+
        '<div class="smartClimateSummary">'+
          '<div><small>Ciclo atual</small><strong id="smartClimateCycle">30 s / 120 s</strong></div>'+
          '<div><small>Condição</small><strong id="smartClimateLevel">Aguardando</strong></div>'+
        '</div>'+
        '<p id="smartClimateReason" class="note">Aguardando avaliação climática.</p>'+
        '<button type="button" id="openClimateConfig" class="btn soft">Ver ajuste automático</button>';
      main.appendChild(box);
    }
    bind(byId('openClimateConfig'),'smartBound',()=>showView('perfil'));
    updateClimateStatus();
    return box;
  }

  function updateClimateStatus(){
    let sec={},cc={},cs={};
    try{
      sec=(typeof data!=='undefined'&&data.secondsMode)||{};
      cc=(typeof data!=='undefined'&&data.dashboard?.climate?.config)||{};
      cs=(typeof data!=='undefined'&&data.dashboard?.climate?.state)||{};
    }catch{}
    const mode=cc.observation?'OBSERVAÇÃO':cc.automatic?'ATIVO':'MANUAL';
    if(byId('smartClimateBadge'))byId('smartClimateBadge').textContent=mode;
    if(byId('smartClimateCycle'))byId('smartClimateCycle').textContent=
      Number(sec.on_seconds||30)+' s / '+Number(sec.off_seconds||120)+' s';
    if(byId('smartClimateLevel'))byId('smartClimateLevel').textContent=String(cs.drying_level_label||'Aguardando');
    if(byId('smartClimateReason'))byId('smartClimateReason').textContent=
      String(cs.last_reason||'Aguardando avaliação climática.');
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

    const home=makeView('smartViewHome','Viveiro','VISÃO RÁPIDA');
    const profile=makeView('smartViewProfile','Perfil do viveiro','CONFIGURAÇÕES');
    const history=makeView('smartViewHistory','Histórico','ACOMPANHAMENTO');
    const system=makeView('smartViewSystem','Sistema','MANUTENÇÃO E DIAGNÓSTICO');

    const hero=qs('main.wrap > .hero');
    const safety=byId('smartSafety');
    const profileCard=byId('viveiroProfileCard');
    const climateStatus=byId('smartClimateStatus');
    const climate=byId('climateAdviceBox');
    const today=byId('todayBox');

    [hero,safety,profileCard,climateStatus,today].filter(Boolean).forEach(el=>home.appendChild(el));

    const seconds=sectionByTitle('Programação')||sectionByTitle('Ciclo rápido');
    const weather=sectionByTitle('Proteção por chuva')||sectionByTitle('Proteção automática por chuva');
    const calendar=byId('calendarBox');
    const alerts=byId('smartAlerts');
    [climate,seconds,weather,calendar,alerts].filter(Boolean).forEach(el=>profile.appendChild(el));

    [byId('dailyReportBox'),byId('weeklyBox'),byId('eventsBox'),byId('pulseActivityBox')]
      .filter(Boolean).forEach(el=>history.appendChild(el));

    [byId('systemHealthBox'),byId('maintenanceBox')]
      .filter(Boolean).forEach(el=>system.appendChild(el));

    const known=new Set([home,profile,history,system]);
    qsa('main.wrap > section, main.wrap > .grid').forEach(el=>{
      if(!known.has(el))system.appendChild(el);
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
      btn.textContent='☰ Menu';
      top.appendChild(btn);
    }

    if(!byId('smartMenuOverlay')){
      const overlay=document.createElement('div');
      overlay.id='smartMenuOverlay';
      overlay.className='smartMenuOverlay';
      overlay.innerHTML=
        '<aside class="smartMenuPanel" role="dialog" aria-label="Menu de irrigação">'+
          '<div class="smartMenuHead"><div><span>FAZENDA 2E</span><strong>Irrigação</strong></div><button type="button" id="smartMenuClose">✕</button></div>'+
          '<nav class="smartMainNav">'+
            '<a href="/irrigacao/central/"><span>⌂</span><div><b>Início</b><small>Central de irrigação</small></div></a>'+
            '<a class="active" href="/irrigacao/"><span>◉</span><div><b>Viveiro</b><small>Irrigação inteligente</small></div></a>'+
            '<a href="/irrigacao/inkbird/"><span>☕</span><div><b>Café</b><small>Setores da lavoura</small></div></a>'+
          '</nav>'+
          '<div class="smartMenuLabel">Viveiro</div>'+
          '<nav class="smartSubNav">'+
            '<button type="button" data-smart-view="inicio">Resumo</button>'+
            '<button type="button" data-smart-view="perfil">Perfil e configurações</button>'+
            '<button type="button" data-smart-view="historico">Histórico</button>'+
            '<button type="button" data-smart-view="sistema">Sistema e manutenção</button>'+
          '</nav>'+
          '<button type="button" id="smartConnectionBtn" class="smartConnectionBtn">Conexão do app</button>'+
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
    document.body.classList.add('smartIrrigationV5','smartIrrigationV6');
    normalizeControls();
    renamePrimary();
    ensureModeSelector();
    bindMissingActions();
    moveEmergencyIntoFlow();
    ensureProfileCard();
    ensureClimateStatus();
    ensureAlertCenter();
    ensureMenu();
    organizeViews();

    const initial=String(location.hash||'#inicio').replace('#','');
    showView(viewMap[initial]?initial:'inicio');
    updateProfileSummary();
    renderSmartAlerts();
    updateModeState();

    setInterval(()=>{
      updateModeState();
      updateProfileSummary();
      updateClimateStatus();
      renderSmartAlerts();
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