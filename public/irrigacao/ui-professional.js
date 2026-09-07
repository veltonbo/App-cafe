(()=>{
  'use strict';
  const byId=id=>document.getElementById(id);
  const safeBind=(id,fnName)=>{
    const el=byId(id);
    if(!el||el.dataset.uiFixBound==='1')return;
    const fn=window[fnName];
    if(typeof fn!=='function')return;
    el.addEventListener('click',ev=>{
      if(el.disabled)return;
      try{fn.call(window,ev)}catch(err){console.error('[UI]',id,err)}
    });
    el.dataset.uiFixBound='1';
  };
  function stabilize(){
    // Botão adicionado na evolução climática ficou sem ligação em algumas versões.
    safeBind('climateObserveBtn','setClimateObservation');

    // Garante semântica de botão e evita submit acidental em controles da interface.
    document.querySelectorAll('button:not([type])').forEach(b=>b.type='button');

    // Impede larguras inline antigas de estourarem a tela do celular.
    document.querySelectorAll('.box,.hero,.configGroup,.secondsField,.secondsMetric,.protectCard,.climateCard').forEach(el=>{
      el.style.maxWidth='100%';
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',stabilize,{once:true});
  else stabilize();
  new MutationObserver(stabilize).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('error',e=>console.error('[UI runtime]',e.message||e.error));
  window.addEventListener('unhandledrejection',e=>console.error('[UI promise]',e.reason));
})();
