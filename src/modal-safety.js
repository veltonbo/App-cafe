/**
 * Script de segurança para modais
 * Este script é carregado antes de qualquer outro JavaScript
 * para prevenir erros nos modais antes que outros scripts sejam carregados
 */

// Auto-executa imediatamente para prevenir erros
(function() {
  // Função que será executada assim que o DOM estiver disponível
  function aplicarCorrecaoPreventiva() {
    try {
      console.log('Aplicando correção preventiva para modais');
      
      // Verifica se existem elementos com erro no DOM
      function verificarElementosComErro() {
        try {
          // Lista conhecida de IDs de modais para verificação proativa
          const idsConhecidos = [
            'modalAplicacaoBg',
            'modalTarefaBg', 
            'modalFinanceiroBg',
            'modalColheitaBg',
            'modalNotificacoesBg'
          ];
          
          // Verificar cada ID conhecido
          idsConhecidos.forEach(function(id) {
            const elemento = document.getElementById(id);
            if (elemento) {
              // Garantir que esteja escondido
              elemento.style.display = 'none';
              elemento.style.opacity = '0';
              elemento.style.visibility = 'hidden';
              
              // Adicionar classe modal-oculto em qualquer elemento conhecido
              if (!elemento.classList.contains('modal-oculto')) {
                elemento.classList.add('modal-oculto');
              }
              
              console.log(`Modal preventivamente ocultado: ${id}`);
            }
          });
        } catch (e) {
          console.error('Erro na verificação preventiva:', e);
        }
      }
      
      // Executar verificação imediatamente e em intervalos
      verificarElementosComErro();
      
      // Também configurar para corrigir qualquer modal que apareça erroneamente
      document.addEventListener('DOMContentLoaded', function() {
        verificarElementosComErro();
        
        // Adicionar um observador de mutação para detectar mudanças nos modais
        try {
          const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
              if (mutation.type === 'attributes' && 
                  mutation.target.classList && 
                  mutation.target.classList.contains('modal-flutuante-bg') &&
                  !mutation.target.classList.contains('modal-oculto') &&
                  (mutation.target.style.display !== 'none' || 
                   mutation.target.style.opacity !== '0')) {
                
                console.log('Modal detectado sendo exibido inesperadamente:', mutation.target.id);
                
                // Verificar se o modal está sendo mostrado propositalmente
                const isBeingOpenedProperly = document.body.classList.contains('modal-open');
                
                if (!isBeingOpenedProperly) {
                  console.log('Corrigindo exibição inesperada de modal:', mutation.target.id);
                  mutation.target.style.display = 'none';
                  mutation.target.style.opacity = '0';
                  mutation.target.style.visibility = 'hidden';
                  
                  if (!mutation.target.classList.contains('modal-oculto')) {
                    mutation.target.classList.add('modal-oculto');
                  }
                }
              }
            });
          });
          
          // Observar mudanças em attributes de modais
          document.querySelectorAll('.modal-flutuante-bg').forEach(function(modal) {
            observer.observe(modal, { 
              attributes: true, 
              attributeFilter: ['style', 'class', 'display'] 
            });
          });
        } catch (err) {
          console.error('Erro ao configurar observador de modais:', err);
        }
      });
    } catch (error) {
      console.error('Erro na correção preventiva:', error);
    }
  }
  
  // Adicionar como primeiro listener quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', aplicarCorrecaoPreventiva);
  } else {
    // DOM já está pronto, executar imediatamente
    aplicarCorrecaoPreventiva();
  }
})();
