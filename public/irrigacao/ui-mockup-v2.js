(()=>{
  'use strict';
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const path=location.pathname.replace(/\/+$/,'/')||'/';
  if(path.includes('/irrigacao/inkbird/')||path.includes('/irrigacao/central/'))return;

  function enhanceHeader(){
    const top=q('.f2eShellTop');
    const brand=q('.f2eShellBrand',top||document);
    if(!top||!brand)return;
    document.body.classList.add('mockupV2');
    if(!q('.f2eHeaderSubtitle',brand)){
      const sub=document.createElement('span');
      sub.className='f2eHeaderSubtitle';
      sub.textContent='Irrigação inteligente para um futuro mais verde.';
      brand.appendChild(sub);
    }
    if(!q('.f2eHeaderBadge',brand)){
      const badge=document.createElement('span');
      badge.className='f2eHeaderBadge';
      badge.textContent='Viveiro ativo';
      brand.appendChild(badge);
    }
    const menu=q('.f2eShellMenuBtn',top);
    if(menu)menu.textContent='☰  Mais';
  }

  function decorateOperational(){
    const icon=q('.smartOperatingState>i');
    if(icon&&!icon.textContent.trim())icon.textContent='◷';
    const health=q('.smartHealthStrip>i');
    if(health&&!health.textContent.trim())health.textContent='✓';
  }

  function decorateMetrics(){
    const map={
      'Ciclo atual':'◉',
      'Ciclo-base':'◷',
      'Temperatura':'♨',
      'Umidade':'◌'
    };
    qa('.smartOverviewGrid>div').forEach(card=>{
      const label=q('small',card)?.textContent?.trim()||'';
      if(q('.m2Icon',card))return;
      const icon=document.createElement('span');
      icon.className='m2Icon';
      icon.textContent=map[label]||'•';
      card.appendChild(icon);
    });
  }

  function addFooter(){
    const home=document.getElementById('smartViewHome');
    if(!home||q('.m2Footer',home))return;
    const footer=document.createElement('div');
    footer.className='m2Footer';
    footer.innerHTML='<span>☘ Tecnologia que cultiva<br>um futuro mais verde.</span><b>FAZENDA 2E</b>';
    home.appendChild(footer);
  }

  function refineLabels(){
    const home=document.getElementById('smartViewHome');
    const profile=document.getElementById('smartViewProfile');
    const history=document.getElementById('smartViewHistory');
    const system=document.getElementById('smartViewSystem');
    const setTitle=(view,kicker,title)=>{
      const box=q('.smartPageTitle',view||document);
      if(!box)return;
      const k=q('.sectionKicker',box);if(k)k.textContent=kicker;
      const h=q('h2',box);if(h)h.textContent=title;
    };
    setTitle(profile,'CICLO, CLIMA E HORÁRIOS','Automação');
    setTitle(history,'ACOMPANHAMENTO','Histórico');
    setTitle(system,'SEGURANÇA E MANUTENÇÃO','Sistema');
    if(home){
      const title=q('.smartPageTitle',home);
      if(title)title.style.display='none';
    }
  }

  function run(){
    enhanceHeader();
    decorateOperational();
    decorateMetrics();
    addFooter();
    refineLabels();
  }

  const obs=new MutationObserver(()=>run());
  obs.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',run,{once:true});
  setTimeout(run,50);
  setTimeout(run,600);
  setTimeout(run,1800);
})();
