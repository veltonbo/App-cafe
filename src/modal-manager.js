/**
 * Modal Manager - Centraliza o gerenciamento de modais no app
 * Este script melhora o controle de modais e garante que não haja conflitos
 */

// Track open modals
const openModals = new Set();

// Verificar se o DOM está pronto
let isDOMReady = false;
document.addEventListener('DOMContentLoaded', function() {
  isDOMReady = true;
  console.log('Modal Manager: DOM pronto para uso');
});

// Modal manager functionality
const modalManager = {
  // Verifica se o DOM está pronto para manipulações
  _checkDOM: function() {
    if (!document.body || !isDOMReady) {
      console.warn('Modal Manager: DOM não está pronto');
      return false;
    }
    return true;
  },
  
  // Salva a posição de scroll para restaurar depois
  _saveScrollPosition: function() {
    if (document.body) {
      document.body.dataset.scrollY = window.scrollY || document.documentElement.scrollTop;
    }
  },
  
  // Restaura a posição de scroll salva
  _restoreScrollPosition: function() {
    if (document.body && document.body.dataset.scrollY) {
      window.scrollTo(0, parseInt(document.body.dataset.scrollY || '0'));
    }
  },
    // Open a modal and manage associated floating buttons
  open: function(modalId) {
    try {
      if (!this._checkDOM()) {
        console.error(`Modal Manager: Não é possível abrir ${modalId}, DOM não está pronto`);
        return false;
      }
      
      const modal = document.getElementById(modalId);
      if (!modal) {
        console.error(`Modal ${modalId} not found`);
        return false;
      }
      
      // Salvar elemento com foco antes de abrir o modal
      this._previousFocus = document.activeElement;
      
      // Salvar a posição de rolagem para restaurar quando fechar
      this._saveScrollPosition();
      
      // Remover classe de modal oculto se existir
      if (modal.classList && modal.classList.contains('modal-oculto')) {
        modal.classList.remove('modal-oculto');
      }
      
      // Marcar como ativo
      modal.classList.add('ativo');
      
      // Show modal with animation
      modal.style.display = 'flex';
      modal.style.opacity = '0';
      modal.style.visibility = 'visible';
      
      // Animar abertura
      requestAnimationFrame(() => {
        modal.style.opacity = '1';
      });
      
      // Track this modal as open
      openModals.add(modalId);
      
      // Hide floating buttons that might be behind the modal
      document.querySelectorAll('.botao-flutuante, .botao-flutuante-fixado').forEach(btn => {
        try {
          if (!btn) return;
          if (!btn.dataset) btn.dataset = {};
          if (!btn.dataset.originalDisplay) {
            btn.dataset.originalDisplay = btn.style.display || 'block';
          }
          btn.style.display = 'none';
        } catch (btnError) {
          console.error('Erro ao ocultar botão:', btnError);
        }
      });
      
      // Marca classe no body para controlar scroll
      document.body.classList.add('modal-open');
      document.documentElement.classList.add('modal-open');
      
      // Prevenir scroll em dispositivos móveis (especialmente iOS)
      if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        document.body.style.height = '100%';
        document.body.style.overflow = 'hidden';
      }
      
      return true;
    } catch (error) {
      console.error('Error opening modal:', error);
      return false;
    }
  },
    // Close a modal and restore associated floating buttons
  close: function(modalId) {
    try {
      const modal = document.getElementById(modalId);
      if (!modal) {
        console.error(`Modal ${modalId} not found`);
        return false;
      }
      
      // Remover classe ativo
      modal.classList.remove('ativo');
      
      // Hide with animation
      modal.style.opacity = '0';
      
      setTimeout(() => {
        modal.style.display = 'none';
        modal.style.visibility = 'hidden';
        modal.classList.add('modal-oculto');
        
        // Remove from tracking
        openModals.delete(modalId);
        
        // If no modals are open, restore floating buttons and scroll
        if (openModals.size === 0) {
          restoreFloatingButtons();
          document.body.classList.remove('modal-open');
          document.documentElement.classList.remove('modal-open');
          
          // Restaurar posição original de scroll
          this._restoreScrollPosition();
          
          // Restaurar scroll em dispositivos móveis
          if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
            document.body.style.position = '';
            document.body.style.width = '';
            document.body.style.height = '';
            document.body.style.overflow = '';
          }
          
          // Restaurar foco anterior
          if (this._previousFocus && typeof this._previousFocus.focus === 'function') {
            setTimeout(() => this._previousFocus.focus(), 200);
          }
        }
      }, 200);
      
      return true;
    } catch (error) {
      console.error('Error closing modal:', error);
      return false;
    }
  },
    // Close all open modals
  closeAll: function() {
    try {
      // Verificar se o DOM está pronto
      if (!this._checkDOM()) {
        console.warn('Modal Manager: DOM não está pronto para fechar todos os modais');
        return false;
      }
      
      // Copiar lista de modais abertos para evitar problemas durante iteração
      const modalsCopy = [...openModals];
      console.log(`Fechando ${modalsCopy.length} modais abertos`);
      
      // Fechar cada modal individualmente
      modalsCopy.forEach(modalId => {
        try {
          this.close(modalId);
        } catch (modalError) {
          console.error(`Erro ao fechar modal ${modalId}:`, modalError);
        }
      });
      
      // Limpar registro de modais abertos
      openModals.clear();
        // Esconder todos os modais para garantir (abordagem força bruta)
      try {
        document.querySelectorAll('.modal-flutuante-bg').forEach(modal => {
          if (modal) {
            modal.style.display = 'none';
            modal.style.opacity = '0';
            modal.style.visibility = 'hidden';
            modal.classList.remove('ativo');
            modal.classList.add('modal-oculto');
            
            // Adicionar classe modal-oculto para garantir
            if (modal.classList && !modal.classList.contains('modal-oculto')) {
              modal.classList.add('modal-oculto');
            }
          }
        });
      } catch (forcedCloseError) {
        console.error('Erro ao forçar fechamento de modais:', forcedCloseError);
      }
      
      // Force restore buttons
      try {
        setTimeout(restoreFloatingButtons, 300);
        if (document.body && document.body.classList) {
          document.body.classList.remove('modal-open');
        }
      } catch (restoreError) {
        console.error('Erro ao restaurar botões:', restoreError);
      }
      
      return true;
    } catch (error) {
      console.error('Erro crítico ao fechar todos os modais:', error);
      return false;
    }
  },
  
  // Check if specific modal is open
  isOpen: function(modalId) {
    return openModals.has(modalId);
  },
  
  // Check if any modal is open
  anyOpen: function() {
    return openModals.size > 0;
  }
};

// Helper to restore floating buttons visibility
function restoreFloatingButtons() {
  try {
    if (modalManager.anyOpen()) return;
    
    // Restore all original floating buttons based on current tab
    document.querySelectorAll('.botao-flutuante, .botao-flutuante-fixado').forEach(btn => {
      const abaId = btn.dataset.aba || '';
      const originalDisplay = btn.dataset.originalDisplay || 'block';
      
      // Get active tab
      const activeTab = Array.from(document.querySelectorAll('.aba')).find(aba => 
        aba.style.display !== 'none' && aba.style.opacity !== '0'
      );
      
      if (activeTab && activeTab.id === abaId) {
        btn.style.display = originalDisplay;
        btn.style.visibility = 'visible';
        btn.style.opacity = '1';
      } else if (!abaId) {
        // If button isn't associated with any tab, show it anyway
        btn.style.display = originalDisplay;
      }
    });
    
    // Update button visibility through the special handler if available
    if (typeof atualizarVisibilidadeBotoes === 'function') {
      atualizarVisibilidadeBotoes();
    }
  } catch (error) {
    console.error('Error restoring floating buttons:', error);
  }
}

// Add keyboard listener for ESC key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && modalManager.anyOpen()) {
    modalManager.closeAll();
  }
});

// Add click handler for closing when clicking background
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-flutuante-bg')) {
    const modalId = e.target.id;
    if (modalId) {
      modalManager.close(modalId);
    }
  }
});

// Initialize - add close buttons to modals if missing
document.addEventListener('DOMContentLoaded', function() {
  // Primeiro, garantir que todos os modais estejam fechados
  modalManager.closeAll();
  
  document.querySelectorAll('.modal-flutuante-bg').forEach(modal => {
    const modalId = modal.id;
    
    // Forçar o estado fechado para todos os modais
    modal.style.display = 'none';
    modal.style.opacity = '0';
    modal.style.visibility = 'hidden';
    
    // Garantir que o modal esteja oculto
    if (modal.classList.contains('modal-oculto')) {
      console.log(`Modal ${modalId} já está marcado como oculto`);
    } else {
      modal.classList.add('modal-oculto');
      console.log(`Modal ${modalId} marcado como oculto`);
    }
    
    const closeButtons = modal.querySelectorAll('.fechar-modal');
    
    // Add listeners to existing close buttons
    closeButtons.forEach(btn => {
      // Remove any existing onclick
      if (btn.hasAttribute('onclick')) {
        const originalOnclick = btn.getAttribute('onclick');
        btn.removeAttribute('onclick');
        
        // Add event listener with the same functionality plus modal manager
        btn.addEventListener('click', function() {
          try {
            if (originalOnclick && originalOnclick.includes('fecharModal')) {
              // Try to extract modal name from function call
              const match = originalOnclick.match(/fecharModal([A-Za-z]+)/);
              if (match && match[1]) {
                const modalName = match[1].charAt(0).toLowerCase() + match[1].slice(1);
                modalManager.close(modalName + 'Bg');
              } else {
                // Just close this modal if we can't extract the name
                modalManager.close(modalId);
              }
            } else {
              // Close this modal
              modalManager.close(modalId);
            }
          } catch (e) {
            console.error('Error in close button handler:', e);
            modalManager.close(modalId); // Fallback
          }
        });
      }
    });
  });
});

// Export modal manager to global scope
window.modalManager = modalManager;
