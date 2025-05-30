/**
 * Script de detecção e correção de compatibilidade para backdrop-filter
 * Este script detecta a compatibilidade com backdrop-filter
 * e aplica alternativas quando não for suportado
 */

(function() {
  console.log('Inicializando detecção de compatibilidade para efeitos visuais');
  
  // Detecção de suporte a backdrop-filter
  function detectBackdropFilterSupport() {
    const prefixes = ['', '-webkit-', '-moz-', '-ms-', '-o-'];
    let supported = false;
    
    // Tenta detectar suporte usando várias abordagens
    prefixes.forEach(prefix => {
      const property = prefix + 'backdrop-filter';
      if (property in document.documentElement.style) {
        supported = true;
        console.log(`Navegador suporta ${property}`);
      }
    });
    
    // Tenta detectar suporte no Firefox (que tem implementação parcial)
    const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
    if (isFirefox) {
      console.log('Firefox detectado, backdrop-filter pode ter suporte experimental');
    }
    
    return supported;
  }
  
  // Aplicar alternativas se backdrop-filter não for suportado
  function applyBackdropFilterAlternative() {
    const styleEl = document.createElement('style');
    styleEl.innerHTML = `
      /* Alternativas para navegadores que não suportam backdrop-filter */
      .modal-flutuante-bg, 
      .sidebar-mobile-bg, 
      .hamburger-button, 
      .notificacoes-btn-superior {
        background-color: rgba(0, 0, 0, 0.85) !important;
      }
      
      /* Melhorar visibilidade para modais sem blur */
      .modal-flutuante {
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5) !important;
      }
    `;
    document.head.appendChild(styleEl);
    
    // Adicionar classe ao body para outros estilos condicionais via CSS
    document.body.classList.add('no-backdrop-filter');
    console.log('Aplicada alternativa para backdrop-filter');
  }
  
  // Executa a detecção e aplica correções se necessário
  window.addEventListener('DOMContentLoaded', function() {
    const hasBackdropSupport = detectBackdropFilterSupport();
    if (!hasBackdropSupport) {
      applyBackdropFilterAlternative();
    }
  });
})();
