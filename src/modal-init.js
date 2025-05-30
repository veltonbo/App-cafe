/**
 * Modal Initialization Script
 * Este script garante que todos os modais estejam corretamente fechados ao carregar a página
 */

// Executa quando o DOM estiver pronto
(function() {
  console.log('Inicializando sistema de verificação de modais');
  
  // Função para garantir que todos os modais estão fechados corretamente
  function esconderTodosModais() {
    try {
      // Verificar se o body está disponível
      if (!document.body) {
        console.log('DOM ainda não está pronto para manipular modais');
        return; // Sair se o DOM não estiver pronto
      }
      
      // Encontrar todos os modais
      const modais = document.querySelectorAll('.modal-flutuante-bg');
      console.log(`Encontrados ${modais.length} modais para verificação`);
      
      // Esconder cada modal corretamente
      modais.forEach(function(modal) {
        if (!modal) return; // Pular se o modal for null
        
        try {
          // Aplicar estilo para garantir que o modal está invisível
          modal.style.display = 'none';
          modal.style.opacity = '0';
          modal.style.visibility = 'hidden';
          
          // Adicionar classe de oculto se não tiver e se classList existir
          if (modal.classList && !modal.classList.contains('modal-oculto')) {
            modal.classList.add('modal-oculto');
          }
          
          console.log(`Modal ${modal.id || 'sem-id'} forçado a fechar`);
        } catch (modalError) {
          console.error('Erro ao processar modal específico:', modalError);
        }
      });
      
      // Remover classe de body que indica modal aberto
      if (document.body.classList) {
        document.body.classList.remove('modal-open');
      }
      
      // Restaurar visibilidade dos botões flutuantes
      document.querySelectorAll('.botao-flutuante, .botao-flutuante-fixado').forEach(btn => {
        if (!btn) return; // Pular se o botão for null
        
        try {
          btn.style.display = '';
          btn.style.visibility = '';
          btn.style.opacity = '';
        } catch (btnError) {
          console.error('Erro ao restaurar botão flutuante:', btnError);
        }
      });
      
      // Se o modal manager estiver disponível, limpar registro de modais abertos
      if (window.modalManager && typeof window.modalManager.closeAll === 'function') {
        try {
          window.modalManager.closeAll();
        } catch (managerError) {
          console.error('Erro ao chamar modalManager.closeAll():', managerError);
        }
      }
    } catch (error) {
      console.error('Erro ao esconder modais:', error);
    }
  }
  
  // Executar apenas quando o DOM estiver carregado
  document.addEventListener('DOMContentLoaded', esconderTodosModais);
    // E mais uma vez após a página carregar completamente
  window.addEventListener('load', function() {
    // Pequeno atraso para garantir que outros scripts foram carregados
    setTimeout(function() {
      try {
        esconderTodosModais();
      } catch (error) {
        console.error('Erro ao esconder modais após carregamento:', error);
      }
    }, 100);
    
    // Verificação adicional para capturar modais persistentes
    setTimeout(function() {
      try {
        const modaisVisiveis = Array.from(document.querySelectorAll('.modal-flutuante-bg') || []).filter(
          modal => modal && modal.style && 
            (modal.style.display !== 'none' || modal.style.opacity !== '0')
        );
        
        if (modaisVisiveis && modaisVisiveis.length > 0) {
          console.warn(`Detectados ${modaisVisiveis.length} modais ainda visíveis após inicialização`);
          esconderTodosModais();
        }
      } catch (error) {
        console.error('Erro na verificação de modais persistentes:', error);
      }
    }, 500);
    
    // Verificação final após completo carregamento da página
    setTimeout(function() {
      try {
        esconderTodosModais();
        console.log('Verificação final de modais concluída');
      } catch (error) {
        console.error('Erro na verificação final de modais:', error);
      }
    }, 2000);
  });
})();
