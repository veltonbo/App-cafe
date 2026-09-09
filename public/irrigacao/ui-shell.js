(()=>{
  'use strict';

  if(!document.querySelector('link[href*="/irrigacao/ui-premium.css"]')){
    const premium=document.createElement('link');
    premium.rel='stylesheet';
    premium.href='/irrigacao/ui-premium.css?v=20260909-1';
    premium.dataset.viveiroPremium='1';
    document.head.appendChild(premium);
  }

  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));

  function viveiroView(name){
    if(typeof window.__viveiroShowView==='function'){
      window.__viveiroShowView(name);
      return;
    }
    const btn=q('[data-smart-view="'+name+'"]');
    if(btn)btn.click();
  }

  function currentViveiro(){
    const active=q('.smartView.active');
    return({
      smartViewHome:'inicio',
      smartViewProfile:'perfil',
      smartViewHistory:'historico',
      smartViewSystem:'sistema'
    }[active?.id]||String(location.hash||'#inicio').replace('#',''));
  }

  const top=document.createElement('header');
  top.className='f2eShellTop';
  top.innerHTML=
    '<div class="f2eShellBrand">'+
      '<small>FAZENDA 2E</small>'+
      '<h1>Viveiro</h1>'+
    '</div>'+
    '<button type="button" class="f2eShellMenuBtn" aria-label="Abrir sistema">⚙ Sistema</button>';

  const systemBtn=q('.f2eShellMenuBtn',top);
  systemBtn.addEventListener('click',()=>viveiroView('sistema'));

  const bottomNav=document.createElement('nav');
  bottomNav.className='f2eBottomNav';
  bottomNav.setAttribute('aria-label','Navegação do Viveiro');

  [
    {key:'inicio',icon:'⌂',label:'Resumo'},
    {key:'perfil',icon:'◷',label:'Automação'},
    {key:'historico',icon:'≡',label:'Histórico'},
    {key:'sistema',icon:'⚙︎',label:'Sistema'}
  ].forEach(item=>{
    const button=document.createElement('button');
    button.type='button';
    button.dataset.key=item.key;
    button.innerHTML='<span>'+item.icon+'</span><small>'+item.label+'</small>';
    button.addEventListener('click',()=>viveiroView(item.key));
    bottomNav.appendChild(button);
  });

  function updateActive(){
    const key=currentViveiro();
    qa('button',bottomNav).forEach(button=>{
      button.classList.toggle('active',button.dataset.key===key);
    });
    systemBtn.classList.toggle('active',key==='sistema');
  }

  document.body.classList.add('f2eShellApplied');
  document.body.insertBefore(top,document.body.firstChild);
  document.body.appendChild(bottomNav);

  const syncSoon=()=>requestAnimationFrame(updateActive);
  window.__f2eShell={updateActive};
  window.addEventListener('hashchange',syncSoon);
  window.addEventListener('popstate',syncSoon);
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-smart-view],.f2eBottomNav button,.f2eShellMenuBtn'))syncSoon();
  });
  setTimeout(updateActive,100);
})();