/**
 * responsive.js - Melhoria da responsividade para o Manejo Café
 * Contém funções específicas para melhorar a experiência em dispositivos móveis
 */

// Executa quando o DOM estiver completamente carregado
document.addEventListener('DOMContentLoaded', function() {
  initResponsiveFeatures();
  
  // Verifica se é um dispositivo móvel e aplica otimizações específicas
  if (isMobileDevice()) {
    applyMobileOptimizations();
  }
  
  // Ajusta elementos quando a janela for redimensionada
  window.addEventListener('resize', handleResize);
  
  // Ajuste especial para quando o dispositivo muda de orientação
  window.addEventListener('orientationchange', function() {
    // Espera um pouco para garantir que a transição de orientação seja concluída
    setTimeout(handleOrientationChange, 200);
  });
});

/**
 * Inicializa recursos responsivos para diferentes tamanhos de tela
 */
function initResponsiveFeatures() {
  // Ajustes responsivos que não interferem na navegação
  // Observação: O controle do menu foi transferido para o arquivo mobile.js
  // para evitar conflitos entre os múltiplos controladores
  
  // Ajustar altura do viewport para corrigir problemas em navegadores móveis
  adjustViewportHeight();
  
  // Ajusta altura do viewport para corrigir problemas em navegadores móveis
  adjustViewportHeight();
}

/**
 * Aplica otimizações específicas para dispositivos móveis
 */
function applyMobileOptimizations() {
  // Ajusta tamanho de fonte para melhorar legibilidade
  if (window.innerWidth <= 360) {
    document.documentElement.style.fontSize = '14px';
  } else if (window.innerWidth <= 480) {
    document.documentElement.style.fontSize = '15px';
  }
  
  // Adiciona classe específica ao corpo da página
  document.body.classList.add('mobile-device');
  
  // Desativa algumas animações pesadas em dispositivos móveis
  const heavyAnimationElements = document.querySelectorAll('.heavy-animation');
  heavyAnimationElements.forEach(el => {
    el.classList.add('simplified-animation');
  });
  
  // Otimiza carregamento de imagens para dispositivos móveis
  optimizeImagesForMobile();
}

/**
 * Otimiza o carregamento de imagens para dispositivos móveis
 */
function optimizeImagesForMobile() {
  // Substitui imagens por versões otimizadas para mobile quando disponíveis
  const images = document.querySelectorAll('img[data-mobile-src]');
  images.forEach(img => {
    if (img.dataset.mobileSrc) {
      img.src = img.dataset.mobileSrc;
    }
  });
}

/**
 * Manipula o evento de redimensionamento da janela
 */
function handleResize() {
  adjustViewportHeight();
  
  // Atualiza estado do menu lateral se necessário
  if (window.innerWidth > 900) {
    // Em telas grandes, garante que o menu esteja visível
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.remove('open');
      document.body.style.overflow = '';
    }
    
    // Esconde o overlay de fundo
    const sidebarMobileBg = document.getElementById('sidebarMobileBg');
    if (sidebarMobileBg) {
      sidebarMobileBg.style.display = 'none';
    }
  }
  
  // Atualiza o tamanho da fonte baseado no tamanho da tela
  if (window.innerWidth <= 360) {
    document.documentElement.style.fontSize = '14px';
  } else if (window.innerWidth <= 480) {
    document.documentElement.style.fontSize = '15px';
  } else {
    document.documentElement.style.fontSize = '16px';
  }
}

/**
 * Manipula mudanças de orientação do dispositivo
 */
function handleOrientationChange() {
  // Recalcula a altura do viewport
  adjustViewportHeight();
  
  // Ajusta o layout baseado na orientação
  const isLandscape = window.innerWidth > window.innerHeight;
  
  if (isLandscape && isMobileDevice()) {
    // Aplica otimizações para modo paisagem em dispositivos móveis
    document.body.classList.add('landscape');
    document.body.classList.remove('portrait');
  } else {
    // Aplica otimizações para modo retrato
    document.body.classList.remove('landscape');
    document.body.classList.add('portrait');
  }
}

/**
 * Ajusta a altura do viewport para corrigir problema em dispositivos móveis
 */
function adjustViewportHeight() {
  // Define uma variável CSS que representa a altura real do viewport no dispositivo
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

/**
 * Verifica se o dispositivo atual é móvel
 * @returns {boolean} true se for um dispositivo móvel
 */
function isMobileDevice() {
  return (window.innerWidth <= 700) || 
         (navigator.userAgent.match(/Android/i) ||
          navigator.userAgent.match(/webOS/i) ||
          navigator.userAgent.match(/iPhone/i) ||
          navigator.userAgent.match(/iPod/i) ||
          navigator.userAgent.match(/BlackBerry/i) ||
          navigator.userAgent.match(/Windows Phone/i));
}
