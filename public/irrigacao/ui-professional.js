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
    bind(byId('climateObserveBtn'),'smartBound',()=>typeof setClimateObservation==='function'&&setClimateObservation());
    bind(byId('climateAutoBtn'),'smartBound',()=>typeof setClimateAutomatic==='function'&&setClimateAutomatic());
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

  function renamePrimarySections(){
    const header=qs('.top h1');
    if(header)header.textContent='Irrigação inteligente';
    const heroKicker=qs('.hero .ey');
    if(heroKicker)heroKicker.textContent='IRRIGAÇÃO INTELIGENTE • TEMPO REAL';
    const seconds=sectionByTitle('Ciclo rápido');
    if(seconds){
      const h=seconds.querySelector('h2');if(h)h.textContent='Programação inteligente';
      const k=seconds.querySelector('.sectionKicker');if(k)k.textContent='Tempos e horários';
    }
    const weather=sectionByTitle('Proteção automática por chuva');
    if(weather){const h=weather.querySelector('h2');if(h)h.textContent='Proteção por chuva'}
  }

  function moveEmergencyIntoFlow(){
    const main=qs('main.wrap');
    const hero=qs('main.wrap > .hero');
    const stop=byId('emergencyStop');
    if(!main||!hero||!stop)return;
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

  function buildAdvancedDisclosure(){
    const main=qs('main.wrap');
    if(!main)return;
    let details=byId('smartAdvanced');
    if(!details){
      details=document.createElement('details');
      details.id='smartAdvanced';
      details.className='smartAdvanced';
      const summary=document.createElement('summary');
      summary.textContent='Mais informações e manutenção';
      const inner=document.createElement('div');
      inner.className='smartAdvancedContent';
      details.append(summary,inner);
      main.appendChild(details);
    }
    const inner=qs('.smartAdvancedContent',details);
    const core=new Set([
      qs('main.wrap > .hero'),byId('climateAdviceBox'),
      sectionByTitle('Programação inteligente')||sectionByTitle('Ciclo rápido'),
      sectionByTitle('Proteção por chuva')||sectionByTitle('Proteção automática por chuva'),
      byId('todayBox'),byId('calendarBox')
    ].filter(Boolean));
    qsa('main.wrap > section').forEach(s=>{if(!core.has(s))inner.appendChild(s)});
  }

  function orderPrimary(){
    const main=qs('main.wrap');if(!main)return;
    const nodes=[
      byId('offlineBanner'),qs('main.wrap > .hero'),byId('smartSafety'),byId('climateAdviceBox'),
      sectionByTitle('Programação inteligente')||sectionByTitle('Ciclo rápido'),
      sectionByTitle('Proteção por chuva')||sectionByTitle('Proteção automática por chuva'),
      byId('todayBox'),byId('calendarBox')
    ].filter(Boolean);
    nodes.forEach(el=>main.appendChild(el));
  }

  function normalizeControls(){
    qsa('button:not([type])').forEach(b=>b.type='button');
    qsa('button').forEach(b=>{if(!b.hasAttribute('aria-label')&&b.textContent.trim())b.setAttribute('aria-label',b.textContent.trim())});
  }

  function auditOverflow(){
    qsa('.layoutOverflow').forEach(el=>el.classList.remove('layoutOverflow'));
    const vw=document.documentElement.clientWidth;
    const offenders=qsa('main.wrap *').filter(el=>{
      const r=el.getBoundingClientRect();
      return r.width>0&&(r.right>vw+2||r.left<-2||el.scrollWidth>el.clientWidth+3);
    }).slice(0,12);
    offenders.forEach(el=>el.classList.add('layoutOverflow'));
    if(offenders.length)console.warn('[Irrigação UI] elementos com overflow:',offenders);
    return offenders.length;
  }

  function relayout(){
    document.body.classList.add('smartIrrigationV5');
    renamePrimarySections();
    ensureModeSelector();
    moveEmergencyIntoFlow();
    orderPrimary();
    buildAdvancedDisclosure();
    bindMissingActions();
    normalizeControls();
    updateModeState();
    requestAnimationFrame(()=>auditOverflow());
  }

  function boot(){
    relayout();
    setTimeout(relayout,250);
    setTimeout(relayout,1200);
    const climate=byId('climateAdviceBox');
    if(climate)new MutationObserver(()=>updateModeState()).observe(climate,{subtree:true,attributes:true,attributeFilter:['class'],childList:true,characterData:true});
    window.addEventListener('resize',()=>requestAnimationFrame(auditOverflow),{passive:true});
    window.addEventListener('orientationchange',()=>setTimeout(auditOverflow,250),{passive:true});
    window.addEventListener('error',e=>console.error('[Irrigação UI runtime]',e.message||e.error));
    window.addEventListener('unhandledrejection',e=>console.error('[Irrigação UI promise]',e.reason));
    window.__irrigacaoUiAudit=()=>({overflow:auditOverflow()});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();