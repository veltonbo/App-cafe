/**
 * performance-mobile.js - Otimizações de desempenho para dispositivos móveis
 * Detecta dispositivos de baixo desempenho e aplica otimizações
 */

document.addEventListener('DOMContentLoaded', function() {
  // Verifica se é um dispositivo móvel
  if (isMobileDevice()) {
    // Inicializa otimizações para mobile
    initPerformanceOptimizations();
  }
});

/**
 * Verifica se o dispositivo atual é um dispositivo móvel
 * @returns {boolean} true se for um dispositivo móvel
 */
function isMobileDevice() {
  return (window.innerWidth <= 700) || 
         (navigator.userAgent.match(/Android/i) ||
          navigator.userAgent.match(/webOS/i) ||
          navigator.userAgent.match(/iPhone/i) ||
          navigator.userAgent.match(/iPad/i) ||
          navigator.userAgent.match(/iPod/i) ||
          navigator.userAgent.match(/BlackBerry/i) ||
          navigator.userAgent.match(/Windows Phone/i));
}

/**
 * Inicializa otimizações de desempenho para dispositivos móveis
 */
function initPerformanceOptimizations() {
  // Detecta dispositivos de baixo desempenho
  if (isLowPerformanceDevice()) {
    document.body.classList.add('low-performance');
    applyLowPerformanceOptimizations();
  }
  
  // Otimizações para todos os dispositivos móveis
  applyCoreOptimizations();
  
  // Adiciona listeners para monitorar o desempenho
  monitorPerformance();
}

/**
 * Verifica se o dispositivo é de baixo desempenho
 * @returns {boolean} true se for um dispositivo de baixo desempenho
 */
function isLowPerformanceDevice() {
  // Verifica memória disponível (quando disponível)
  if (navigator.deviceMemory && navigator.deviceMemory < 4) {
    return true;
  }
  
  // Verifica número de núcleos de CPU (quando disponível)
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
    return true;
  }
  
  // Se não consegue detectar por API, usa heurística
  const userAgent = navigator.userAgent.toLowerCase();
  
  // Dispositivos Android mais antigos ou de baixo custo
  if (userAgent.includes('android') && 
      (userAgent.includes('mediatek') || 
       userAgent.includes('unisoc') || 
       userAgent.includes('spreadtrum'))) {
    return true;
  }
  
  return false;
}

/**
 * Aplica otimizações para dispositivos de baixo desempenho
 */
function applyLowPerformanceOptimizations() {
  console.log("Aplicando otimizações para dispositivo de baixo desempenho");
  
  // Remove ou simplifica animações
  document.querySelectorAll('.animation, .animated, [class*="animate"]').forEach(el => {
    el.classList.add('simplified-animation');
    el.style.animation = 'none';
    el.style.transition = 'none';
  });
  
  // Reduz qualidade de imagens de fundo
  document.querySelectorAll('[style*="background-image"]').forEach(el => {
    el.classList.add('low-quality-bg');
  });
  
  // Remover efeitos de blur/desfoque
  document.querySelectorAll('[style*="filter"], [style*="backdrop-filter"]').forEach(el => {
    el.style.backdropFilter = 'none';
    el.style.webkitBackdropFilter = 'none';
    el.style.filter = 'none';
  });
  
  // Desativa efeitos de rolagem suave
  document.documentElement.style.scrollBehavior = 'auto';
  document.body.style.scrollBehavior = 'auto';
}

/**
 * Aplica otimizações principais para todos os dispositivos móveis
 */
function applyCoreOptimizations() {
  // Adiciona touch feedback para elementos clicáveis
  document.querySelectorAll('button, .clickable, [role="button"]').forEach(el => {
    el.classList.add('touch-feedback');
  });
  
  // Otimiza renderização para elementos que aparecem na tela
  setupLazyLoading();
  
  // Otimiza carregamento de imagens
  optimizeImages();
}

/**
 * Configura carregamento preguiçoso para elementos
 */
function setupLazyLoading() {
  // Usa IntersectionObserver para carregar conteúdo apenas quando visível
  if ('IntersectionObserver' in window) {
    const lazyLoadObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const element = entry.target;
          if (element.classList.contains('lazy-load')) {
            element.classList.remove('lazy-load');
            element.classList.add('loaded');
          }
          observer.unobserve(element);
        }
      });
    });
    
    // Observa elementos com a classe lazy-load
    document.querySelectorAll('.lazy-load').forEach(el => {
      lazyLoadObserver.observe(el);
    });
  }
}

/**
 * Otimiza o carregamento de imagens
 */
function optimizeImages() {
  // Usar imagens de menor resolução para dispositivos móveis
  document.querySelectorAll('img[data-mobile-src]').forEach(img => {
    if (img.dataset.mobileSrc) {
      img.src = img.dataset.mobileSrc;
    }
  });
}

/**
 * Monitora o desempenho da aplicação
 */
function monitorPerformance() {
  // Monitora taxa de quadros
  let lastTime = performance.now();
  let frames = 0;
  let fps = 60;
  
  function checkFPS() {
    frames++;
    const currentTime = performance.now();
    
    if (currentTime > lastTime + 1000) {
      fps = Math.round((frames * 1000) / (currentTime - lastTime));
      frames = 0;
      lastTime = currentTime;
      
      // Se a taxa de quadros cair muito, aplicar otimizações adicionais
      if (fps < 30 && !document.body.classList.contains('low-performance')) {
        document.body.classList.add('low-performance');
        applyLowPerformanceOptimizations();
      }
    }
    
    requestAnimationFrame(checkFPS);
  }
  
  // Inicia a verificação de FPS
  requestAnimationFrame(checkFPS);
}
