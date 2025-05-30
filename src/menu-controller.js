/**
 * menu-controller.js
 * Controlador dedicado para o menu lateral
 * Este script centraliza todas as operações relacionadas ao menu para evitar conflitos
 */

// Executar imediatamente
(function() {
  // Aguardar o DOM estar completamente carregado
  document.addEventListener('DOMContentLoaded', initMenu);
  
  // Garantir que o menu seja inicializado mesmo que o DOMContentLoaded já tenha passado
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    initMenu();
  }
  
  /**
   * Inicializa o menu lateral
   */
  function initMenu() {
    console.log('Inicializando controlador do menu');
    
    // Elementos do DOM
    const hamburgerButton = document.getElementById('hamburger-button');
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarMobileBg = document.getElementById('sidebarMobileBg');
    const navButtons = document.querySelectorAll('.sidebar-nav button');
    
    // Garantir que o menu comece fechado
    closeMenu(false);
    
    // Configurar eventos
    setupEvents();
    
    /**
     * Configura eventos para os elementos do menu
     */
    function setupEvents() {
      // Remover eventos existentes para evitar duplicação
      clearExistingEvents();
      
      // Botão hamburger para abrir o menu
      hamburgerButton.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        openMenu();
      });
      
      // Botão para fechar o menu
      sidebarToggle.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
      });
      
      // Background escuro para fechar o menu
      sidebarMobileBg.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
      });
      
      // Botões de navegação
      navButtons.forEach(function(button) {
        button.addEventListener('click', function() {
          if (isMobile()) {
            // Fechar o menu em dispositivos móveis após selecionar uma opção
            closeMenu();
          }
        });
      });
      
      // Ajustar quando a janela for redimensionada
      window.addEventListener('resize', function() {
        if (!isMobile() && sidebar.classList.contains('open')) {
          // Em telas grandes, se o menu estiver aberto, fechá-lo
          closeMenu(false);
        }
      });
    }
    
    /**
     * Abre o menu lateral
     */
    function openMenu() {
      console.log('Abrindo menu');
      
      sidebar.classList.remove('closed');
      sidebar.classList.add('open');
      document.body.classList.add('sidebar-open');
      
      // Impedir rolagem
      if (isMobile()) {
        document.body.style.overflow = 'hidden';
      }
      
      // Mostrar overlay com fade
      sidebarMobileBg.style.display = 'block';
      requestAnimationFrame(() => {
        sidebarMobileBg.style.opacity = '1';
      });
    }
    
    /**
     * Fecha o menu lateral
     * @param {boolean} animate - Se true, aplica animação
     */
    function closeMenu(animate = true) {
      console.log('Fechando menu');
      
      sidebar.classList.remove('open');
      sidebar.classList.add('closed');
      document.body.classList.remove('sidebar-open');
      document.body.style.overflow = '';
      
      if (animate) {
        // Esconder overlay com fade
        sidebarMobileBg.style.opacity = '0';
        setTimeout(() => {
          sidebarMobileBg.style.display = 'none';
        }, 300);
      } else {
        // Esconder overlay imediatamente
        sidebarMobileBg.style.opacity = '0';
        sidebarMobileBg.style.display = 'none';
      }
    }
    
    /**
     * Limpa eventos existentes para evitar duplicação
     */
    function clearExistingEvents() {
      // Clonar e substituir elementos para remover todos os eventos
      if (hamburgerButton) replaceElement(hamburgerButton);
      if (sidebarToggle) replaceElement(sidebarToggle);
      if (sidebarMobileBg) replaceElement(sidebarMobileBg);
      
      navButtons.forEach(function(button) {
        // Preservar o onclick original
        const originalOnclick = button.getAttribute('onclick');
        const clone = replaceElement(button);
        if (originalOnclick) {
          clone.setAttribute('onclick', originalOnclick);
        }
      });
    }
    
    /**
     * Substitui um elemento por sua cópia para remover eventos
     * @param {HTMLElement} el - Elemento a ser substituído
     * @returns {HTMLElement} O novo elemento
     */
    function replaceElement(el) {
      const clone = el.cloneNode(true);
      el.parentNode.replaceChild(clone, el);
      return clone;
    }
    
    /**
     * Verifica se é um dispositivo móvel
     * @returns {boolean} true se for mobile
     */
    function isMobile() {
      return window.innerWidth <= 700;
    }
  }
})();
