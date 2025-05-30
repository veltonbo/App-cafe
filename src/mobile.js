/**
 * Script específico para melhorar a experiência em dispositivos móveis
 * Manejo Café - Versão Mobile
 */

document.addEventListener('DOMContentLoaded', function() {
  initMobileUI();
  
  // Verifica se é um dispositivo móvel
  if (window.innerWidth <= 900) {
    setupMobileSpecificBehaviors();
  }
  
  // Atualiza quando a janela é redimensionada
  window.addEventListener('resize', function() {
    if (window.innerWidth <= 900) {
      setupMobileSpecificBehaviors();
    }
  });
});

/**
 * Inicializa a interface móvel
 */
function initMobileUI() {
  const hamburgerButton = document.getElementById('hamburger-button');
  const sidebarMobileBg = document.getElementById('sidebarMobileBg');
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const navButtons = document.querySelectorAll('.sidebar-nav button');
  
  // Remover todos os event listeners existentes
  const newHamburgerButton = hamburgerButton.cloneNode(true);
  hamburgerButton.parentNode.replaceChild(newHamburgerButton, hamburgerButton);
  
  const newSidebarToggle = sidebarToggle.cloneNode(true);
  sidebarToggle.parentNode.replaceChild(newSidebarToggle, sidebarToggle);
  
  const newSidebarMobileBg = sidebarMobileBg.cloneNode(true);
  sidebarMobileBg.parentNode.replaceChild(newSidebarMobileBg, sidebarMobileBg);
  
  // Evento para abrir a barra lateral
  newHamburgerButton.addEventListener('click', function(e) {
    e.preventDefault();
    console.log('Botão hamburger clicado');
    
    // Forçar abertura do menu
    sidebar.classList.remove('closed');
    sidebar.classList.add('open');
    document.body.classList.add('sidebar-open');
    document.body.style.overflow = 'hidden';
    
    // Mostrar fundo com animação
    newSidebarMobileBg.style.display = 'block';
    requestAnimationFrame(() => {
      newSidebarMobileBg.style.opacity = '1';
    });
  });
  
  // Evento para fechar a barra lateral ao clicar no botão de fechar
  newSidebarToggle.addEventListener('click', function(e) {
    e.preventDefault();
    console.log('Botão de fechar clicado');
    
    // Fechar o menu
    sidebar.classList.remove('open');
    sidebar.classList.add('closed');
    document.body.classList.remove('sidebar-open');
    document.body.style.overflow = '';
    
    // Esconder fundo com animação
    newSidebarMobileBg.style.opacity = '0';
    setTimeout(() => {
      newSidebarMobileBg.style.display = 'none';
    }, 300);
  });
  
  // Evento para fechar a barra lateral ao clicar no fundo sombreado
  newSidebarMobileBg.addEventListener('click', function(e) {
    e.preventDefault();
    console.log('Background clicado');
    
    // Fechar o menu
    sidebar.classList.remove('open');
    sidebar.classList.add('closed');
    document.body.classList.remove('sidebar-open');
    document.body.style.overflow = '';
    
    // Esconder fundo com animação
    newSidebarMobileBg.style.opacity = '0';
    setTimeout(() => {
      newSidebarMobileBg.style.display = 'none';
    }, 300);
  });
  
  // Fechar menu ao clicar em um item de navegação em dispositivos móveis
  navButtons.forEach(function(button) {
    // Remover evento existente e criar novo
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);
    
    // Recuperar o onclick original
    const originalOnClick = newButton.getAttribute('onclick');
    
    // Adicionar novo evento que fecha o menu e depois executa o onclick original
    newButton.removeAttribute('onclick');
    newButton.addEventListener('click', function(e) {
      console.log('Item de navegação clicado');
      
      if (window.innerWidth <= 900) {
        // Fechar menu
        sidebar.classList.remove('open');
        sidebar.classList.add('closed');
        document.body.classList.remove('sidebar-open');
        document.body.style.overflow = '';
        
        // Esconder fundo
        newSidebarMobileBg.style.opacity = '0';
        setTimeout(() => {
          newSidebarMobileBg.style.display = 'none';
        }, 300);
      }
      
      // Executar a ação original do botão (mostrar aba)
      if (originalOnClick) {
        setTimeout(() => {
          eval(originalOnClick);
        }, 10);
      }
    });
  });
}

/**
 * Configura comportamentos específicos para dispositivos móveis
 */
function setupMobileSpecificBehaviors() {
  // Nota: O posicionamento do botão flutuante agora é tratado pelo botao-flutuante-fix.js
  // então não precisamos mexer nele aqui para evitar conflitos
  // Verificar e esconder qualquer modal que possa estar mostrando incorretamente
  try {
    const modais = document.querySelectorAll('.modal-flutuante-bg');
    if (!modais || modais.length === 0) {
      console.log('Nenhum modal encontrado para verificar');
    } else {
      modais.forEach(function(modal) {
        try {
          if (!modal) return;
          
          // Verificar se o modal está visível de alguma forma
          const isVisible = 
            (modal.style && modal.style.display !== 'none') || 
            (modal.style && modal.style.opacity !== '0') || 
            (window.getComputedStyle && window.getComputedStyle(modal).display !== 'none');
            
          if (isVisible) {
            console.log(`Corrigindo modal visível incorretamente: ${modal.id || 'sem-id'}`);
            modal.style.display = 'none';
            modal.style.opacity = '0';
            modal.style.visibility = 'hidden';
            
            // Se o modal manager estiver disponível, usá-lo
            if (window.modalManager && typeof window.modalManager.close === 'function') {
              window.modalManager.close(modal.id);
            }
          }
        } catch (modalError) {
          console.error('Erro ao verificar modal específico:', modalError);
        }
      });
    }
  } catch (error) {
    console.error('Erro ao verificar modais em setupMobileSpecificBehaviors:', error);
  }

  // Adiciona toque duplo para zoom em elementos, se necessário
  const zoomElements = document.querySelectorAll('.zoom-on-touch');
  
  zoomElements.forEach(function(el) {
    el.addEventListener('dblclick', function(e) {
      if (this.classList.contains('zoomed')) {
        this.classList.remove('zoomed');
      } else {
        this.classList.add('zoomed');
      }
      e.preventDefault();
    });
  });
  
  // Ajusta a altura do viewport para dispositivos móveis (corrige problema de vh em mobile)
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
  
  // Ajusta scroll suave para navegação interna
  const contentLinks = document.querySelectorAll('.conteudo a[href^="#"]');
  
  contentLinks.forEach(function(link) {
    link.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      
      if (targetElement) {
        e.preventDefault();
        
        window.scrollTo({
          top: targetElement.offsetTop - 80,
          behavior: 'smooth'
        });
      }
    });
  });
}

/**
 * Função para verificar se o dispositivo é realmente móvel (smartphone)
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

// Ajusta o conteúdo ao girar a tela
window.addEventListener('orientationchange', function() {
  // Pequeno atraso para garantir que os cálculos ocorram após a rotação ser concluída
  setTimeout(function() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    
    // Ajusta o tamanho do conteúdo
    const conteudo = document.querySelector('.conteudo');
    if (conteudo) {
      conteudo.style.minHeight = `calc(var(--vh, 1vh) * 100)`;
    }
      // Nota: O reposicionamento do botão flutuante agora é tratado pelo script botao-flutuante-fix.js
  }, 200);
});

// Nota: O posicionamento do botão flutuante durante a rolagem agora é tratado 
// pelo script botao-flutuante-fix.js
