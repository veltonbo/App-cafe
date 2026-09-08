(()=>{
  'use strict';
  const path=location.pathname.replace(/\/+$/,'/')||'/';
  const area=path.includes('/irrigacao/central/')?'central':path.includes('/irrigacao/inkbird/')?'cafe':'viveiro';
  const meta={
    central:{title:'Irrigação',context:'Escolher área',sub:'Viveiro ou Café'},
    viveiro:{title:'Viveiro',context:'Viveiro de mudas',sub:'Irrigação inteligente'},
    cafe:{title:'Café',context:'Café',sub:'Setores da lavoura'}
  }[area];

  const $=id=>document.getElementById(id);
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));

  function clickId(id){
    const el=$(id);
    if(el){el.click();return true}
    return false;
  }
  function cafeTab(name){
    if(typeof window.activateTab==='function'){window.activateTab(name);return}
    const btn=q('.tabBtn[data-tab="'+name+'"]');
    if(btn)btn.click();
  }
  function viveiroView(name){
    if(typeof window.__viveiroShowView==='function'){window.__viveiroShowView(name);return}
    const btn=q('[data-smart-view="'+name+'"]');
    if(btn)btn.click();
  }
  function currentCafe(){
    const btn=q('.tabBtn.active');
    return btn?.dataset?.tab||'overview';
  }
  function currentViveiro(){
    const active=q('.smartView.active');
    const map={smartViewHome:'inicio',smartViewProfile:'perfil',smartViewHistory:'historico',smartViewSystem:'sistema'};
    return map[active?.id]||String(location.hash||'#inicio').replace('#','');
  }
  function item({icon,label,sub,href,action,key,danger=false}){
    const el=document.createElement(href?'a':'button');
    if(href)el.href=href;else el.type='button';
    el.className='f2eShellItem'+(danger?' danger':'');
    el.dataset.key=key||'';
    el.innerHTML='<span class="ico">'+icon+'</span><span><b>'+label+'</b><small>'+sub+'</small></span><span class="arrow">›</span>';
    if(action)el.addEventListener('click',()=>{close();action()});
    return el;
  }
  function navItems(){
    if(area==='central')return[
      {label:'Áreas',items:[
        {icon:'V',label:'Viveiro',sub:'Irrigação das mudas',href:'/irrigacao/',key:'viveiro'},
        {icon:'C',label:'Café',sub:'Irrigação da lavoura',href:'/irrigacao/inkbird/',key:'cafe'}
      ]},
      {label:'Sistema',items:[
        {icon:'!',label:'Notificações',sub:'Prioridades e canais',action:()=>clickId('menuAlerts')},
        {icon:'✓',label:'Diagnóstico',sub:'Teste seguro, somente leitura',action:()=>clickId('menuDiagnostics')},
        {icon:'↺',label:'Backups',sub:'Salvar e restaurar configurações',action:()=>clickId('menuBackups')},
        {icon:'⚙',label:'Conexão',sub:'Configuração do aplicativo',action:()=>clickId('connectionBtn')}
      ]}
    ];
    if(area==='viveiro')return[
      {label:'Viveiro',items:[
        {icon:'⌂',label:'Resumo',sub:'Situação de agora',action:()=>viveiroView('inicio'),key:'inicio'},
        {icon:'◷',label:'Programação',sub:'Automático 2.0, tempos e chuva',action:()=>viveiroView('perfil'),key:'perfil'},
        {icon:'≡',label:'Histórico',sub:'Irrigações e eventos',action:()=>viveiroView('historico'),key:'historico'},
        {icon:'⚙',label:'Configurações',sub:'Sistema e manutenção',action:()=>viveiroView('sistema'),key:'sistema'}
      ]},
      {label:'Navegação',items:[
        {icon:'↔',label:'Trocar área',sub:'Voltar para Viveiro ou Café',href:'/irrigacao/central/'},
        {icon:'●',label:'Conexão',sub:'Conexão do Viveiro',action:()=>clickId('settings')||clickId('conn')}
      ]}
    ];
    return[
      {label:'Café',items:[
        {icon:'⌂',label:'Resumo',sub:'Situação da lavoura',action:()=>cafeTab('overview'),key:'overview'},
        {icon:'01',label:'Setores',sub:'Controle e programação',action:()=>cafeTab('sectors'),key:'sectors'},
        {icon:'☁',label:'Clima',sub:'Weather2-2 e proteção',action:()=>cafeTab('weather'),key:'weather'},
        {icon:'⚙',label:'Configurações',sub:'Controladores e sistema',action:()=>cafeTab('system'),key:'system'}
      ]},
      {label:'Navegação',items:[
        {icon:'↔',label:'Trocar área',sub:'Voltar para Viveiro ou Café',href:'/irrigacao/central/'},
        {icon:'●',label:'Conexão',sub:'Conexão do Café',action:()=>clickId('settingsBtn')}
      ]}
    ];
  }

  const top=document.createElement('header');
  top.className='f2eShellTop';
  top.innerHTML='<div class="f2eShellBrand"><small>FAZENDA 2E</small><h1>'+meta.title+'</h1></div><button type="button" class="f2eShellMenuBtn">☰ Menu</button>';

  const overlay=document.createElement('div');
  overlay.className='f2eShellOverlay';
  overlay.innerHTML='<aside class="f2eShellPanel" role="dialog" aria-label="Menu">'+
    '<div class="f2eShellHead"><div><small>FAZENDA 2E</small><strong>Menu</strong></div><button type="button" class="f2eShellClose">✕</button></div>'+
    '<div class="f2eShellContext"><span>ATIVO</span><b>'+meta.context+'</b><small>'+meta.sub+'</small></div>'+
    '<div class="f2eShellBody"></div></aside>';

  const body=q('.f2eShellBody',overlay);
  for(const group of navItems()){
    const lab=document.createElement('div');lab.className='f2eShellLabel';lab.textContent=group.label;body.appendChild(lab);
    const nav=document.createElement('nav');nav.className='f2eShellNav';
    group.items.forEach(x=>nav.appendChild(item(x)));body.appendChild(nav);
  }

  function updateActive(){
    const key=area==='viveiro'?currentViveiro():area==='cafe'?currentCafe():'';
    qa('.f2eShellItem',overlay).forEach(el=>el.classList.toggle('active',Boolean(key)&&el.dataset.key===key));
  }
  function open(){updateActive();overlay.classList.add('open');document.documentElement.style.overflow='hidden'}
  function close(){overlay.classList.remove('open');document.documentElement.style.overflow=''}

  q('.f2eShellMenuBtn',top).addEventListener('click',open);
  q('.f2eShellClose',overlay).addEventListener('click',close);
  overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});

  document.body.classList.add('f2eShellApplied');
  document.body.insertBefore(top,document.body.firstChild);
  document.body.appendChild(overlay);

  window.__f2eShell={open,close,updateActive};
  setInterval(updateActive,1500);
})();