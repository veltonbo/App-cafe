(()=>{
  'use strict';

  function arrange(){
    document.body.classList.add('viveiroV18');
    const home=document.getElementById('smartViewHome');
    const today=document.getElementById('todayBox');
    const health=document.getElementById('smartHealthStrip');

    // O painel "Hoje" já existe e já recebe dados reais do backend.
    // Apenas o reposicionamos na tela inicial, sem duplicar IDs ou consultas.
    if(home&&today&&today.parentElement!==home){
      today.classList.remove('smartUiHidden');
      if(health&&health.parentElement===home)home.insertBefore(today,health);
      else home.appendChild(today);
    }

    // O Viveiro agora possui uma única navegação: barra inferior.
    const oldMenu=document.querySelector('.f2eShellOverlay');
    if(oldMenu)oldMenu.setAttribute('aria-hidden','true');
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',arrange,{once:true});
  }else{
    arrange();
  }
  setTimeout(arrange,250);
  setTimeout(arrange,1200);
})();