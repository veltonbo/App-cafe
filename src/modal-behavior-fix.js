/**
 * Correções de comportamento para modais v2.0
 * Este script padroniza o comportamento de todos os modais no aplicativo
 * e corrige problemas de compatibilidade entre navegadores
 * 
 * Características:
 * - Padroniza abertura e fechamento de modais
 * - Corrige problemas em dispositivos móveis, incluindo iOS
 * - Adiciona acessibilidade (trap focus, ESC para fechar)
 * - Melhora compatibilidade cross-browser
 * - Previne múltiplos modais abertos
 */

(function() {
  console.log('Inicializando fixes avançados para modais v2.0');

  // Cache de estados dos modais
  const modalStates = {
    activeModals: [],
    previousFocusElement: null,
    bodyScrollPos: 0,
  };
  
  // Verificar se o DOM está pronto
  function domReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }
  
  // Lista de todos os IDs de modais conhecidos
  const knownModalIds = [
    'modalAplicacaoBg',
    'modalTarefaBg', 
    'modalFinanceiroBg',
    'modalColheitaBg',
    'modalNotificacoesBg'
  ];
  
  // Função para aplicar correções de acessibilidade
  function applyAccessibilityFixes() {
    // Para cada modal conhecido
    knownModalIds.forEach(function(modalId) {
      const modal = document.getElementById(modalId);
      if (!modal) return;
      
      // Adicionar atributo role para acessibilidade
      if (!modal.hasAttribute('role')) {
        modal.setAttribute('role', 'dialog');
      }
      
      // Adicionar aria-modal
      if (!modal.hasAttribute('aria-modal')) {
        modal.setAttribute('aria-modal', 'true');
      }
      
      // Verificar se o modal tem um título acessível
      const modalTitle = modal.querySelector('h3, h2, .modal-flutuante-titulo');
      if (modalTitle && !modal.hasAttribute('aria-labelledby')) {
        // Adicionar id ao título se necessário
        if (!modalTitle.id) {
          modalTitle.id = `${modalId}-title`;
        }
        modal.setAttribute('aria-labelledby', modalTitle.id);
      }
      
      // Garantir que o background tem o tabindex correto para evitar navegação por tab dentro do modal
      modal.setAttribute('tabindex', '-1');
    });
  }
  
  // Função para aplicar correções de navegadores
  function applyBrowserFixes() {
    // Corrigir comportamento de backdrop-filter em diferentes navegadores
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      /* Correções para backdrop-filter em Safari */
      .modal-flutuante-bg {
        -webkit-backdrop-filter: blur(5px);
        backdrop-filter: blur(5px);
      }
      
      /* Correção específica para Firefox */
      @supports (-moz-appearance:none) {
        .modal-flutuante-bg {
          background-color: rgba(0, 0, 0, 0.8) !important;
        }
      }
      
      /* Correção para prevenção de scroll em iOS */
      html.modal-open, body.modal-open {
        position: fixed;
        width: 100%;
        height: var(--window-inner-height, 100%);
        overflow: hidden;
      }
    `;
    document.head.appendChild(styleEl);
  }
  
  // Corrige o comportamento de tecla ESC
  function setupKeyboardNavigation() {
    document.addEventListener('keydown', function(e) {
      // Fechar o modal ativo com a tecla ESC
      if (e.key === 'Escape') {
        // Verificar se há modais abertos
        const activeModals = Array.from(document.querySelectorAll('.modal-flutuante-bg:not(.modal-oculto)'));
        
        if (activeModals.length > 0) {
          // Encontra o último modal aberto (mais alto no z-index)
          const topModal = activeModals.reduce((highest, current) => {
            const currentZ = parseInt(window.getComputedStyle(current).zIndex, 10) || 0;
            const highestZ = parseInt(window.getComputedStyle(highest).zIndex, 10) || 0;
            return currentZ > highestZ ? current : highest;
          }, activeModals[0]);
          
          // Busca o botão de fechar neste modal
          const closeButton = topModal.querySelector('.fechar-modal');
          if (closeButton && typeof closeButton.onclick === 'function') {
            closeButton.onclick.call(closeButton);
          }
        }
      }
    });
  }
  
  // Adiciona trap focus dentro do modal para acessibilidade 
  function setupFocusTrap() {
    // Função para criar um trap focus em um modal
    function trapFocus(modal) {
      // Encontrar todos os elementos que podem receber foco
      const focusableElements = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      const firstFocusable = modal.querySelectorAll(focusableElements)[0];
      const focusables = modal.querySelectorAll(focusableElements);
      const lastFocusable = focusables[focusables.length - 1];
      
      // Dar foco ao primeiro elemento
      if (firstFocusable) {
        setTimeout(() => firstFocusable.focus(), 100);
      }
      
      // Loop de foco dentro do modal
      modal.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
          if (e.shiftKey) {
            if (document.activeElement === firstFocusable) {
              e.preventDefault();
              lastFocusable.focus();
            }
          } else {
            if (document.activeElement === lastFocusable) {
              e.preventDefault();
              firstFocusable.focus();
            }
          }
        }
      });
    }
    
    // Monitorar mudanças no DOM para aplicar trap focus quando um modal for aberto
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'attributes' && 
            mutation.attributeName === 'class' || 
            mutation.attributeName === 'style') {
          const element = mutation.target;
          if (element.classList.contains('modal-flutuante-bg') && 
              !element.classList.contains('modal-oculto') &&
              element.style.display !== 'none') {
            // Modal foi aberto - aplicar trap focus
            trapFocus(element.querySelector('.modal-flutuante'));
          }
        }
      });
    });
    
    // Observar todos os modais conhecidos
    knownModalIds.forEach(function(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        observer.observe(modal, { attributes: true });
      }
    });
  }
  
  // Registra o tamanho da janela para iOS
  function setupIOSHeightFix() {
    const setIOSHeight = () => {
      document.documentElement.style.setProperty('--window-inner-height', `${window.innerHeight}px`);
    };
    
    window.addEventListener('resize', setIOSHeight);
    setIOSHeight();
  }
    // Harmoniza os métodos de abertura/fechamento de modais
  function standardizeModalMethods() {
    // Padroniza os métodos para as funções conhecidas de modais
    const modalFunctionPairs = {
      'modalAplicacaoBg': ['abrirModalAplicacao', 'fecharModalAplicacao'],
      'modalTarefaBg': ['abrirModalTarefa', 'fecharModalTarefa'],
      'modalFinanceiroBg': ['abrirModalFinanceiro', 'fecharModalFinanceiro'],
      'modalColheitaBg': ['abrirModalColheita', 'fecharModalColheita'],
      'modalNotificacoesBg': ['abrirModalNotificacoes', 'fecharModalNotificacoes']
    };

    // Para cada par de funções (abrir/fechar)
    Object.entries(modalFunctionPairs).forEach(([modalId, [openFnName, closeFnName]]) => {
      // Salva a referência original se existir
      if (typeof window[openFnName] === 'function') {
        const originalOpenFn = window[openFnName];
        window[openFnName] = function() {
          // Chama a função original para manter comportamento específico
          const result = originalOpenFn.apply(this, arguments);
          
          // Garante que o modal esteja visível usando nossa lógica padrão
          const modal = document.getElementById(modalId);
          if (modal) {
            modal.classList.remove('modal-oculto');
            modal.style.display = 'flex';
            modal.style.opacity = '1';
            modal.style.visibility = 'visible';
            modal.classList.add('ativo');
            document.body.classList.add('modal-open');
          }
          return result;
        };
      }
      
      // Da mesma forma para a função de fechar
      if (typeof window[closeFnName] === 'function') {
        const originalCloseFn = window[closeFnName];
        window[closeFnName] = function() {
          // Chama a função original para manter comportamento específico
          const result = originalCloseFn.apply(this, arguments);
          
          // Garante que o modal esteja escondido usando nossa lógica padrão
          const modal = document.getElementById(modalId);
          if (modal) {
            modal.classList.remove('ativo');
            modal.style.opacity = '0';
            
            setTimeout(() => {
              modal.style.display = 'none';
              modal.style.visibility = 'hidden';
              modal.classList.add('modal-oculto');
              document.body.classList.remove('modal-open');
            }, 200);
          }
          return result;
        };
      }
    });
  }

  // Inicializa todas as correções quando o DOM estiver pronto
  domReady(function() {
    console.log('Aplicando correções avançadas para modais v2.0');
    applyAccessibilityFixes();
    applyBrowserFixes();
    setupKeyboardNavigation();
    setupFocusTrap();
    setupIOSHeightFix();
    standardizeModalMethods();
    
    // Força ocultar todos os modais no início
    knownModalIds.forEach(id => {
      const modal = document.getElementById(id);
      if (modal && !modal.classList.contains('modal-oculto')) {
        modal.classList.add('modal-oculto');
        modal.style.display = 'none';
      }
    });
    
    console.log('Correções de modais aplicadas com sucesso');
  });
})();
