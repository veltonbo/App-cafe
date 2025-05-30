/**
 * Versão simplificada do script de botão flutuante
 * Foca apenas na funcionalidade essencial para evitar erros
 */

// Auto-executa para isolar o escopo
(function() {
  console.log('Iniciando script simplificado de botão flutuante');
  
  // Função para fixar botões quando o DOM estiver pronto
  function fixarBotoes() {
    try {
      // Encontrar todos os botões flutuantes originais
      const botoes = document.querySelectorAll('.botao-flutuante:not([data-fixed="true"])');
      console.log(`Encontrados ${botoes.length} botões para fixar`);
      
      // Para cada botão encontrado
      botoes.forEach(function(botao, index) {
        // Evitar processar um botão mais de uma vez
        if (botao.getAttribute('data-fixed') === 'true') return;
        
        // Capturar atributos importantes
        const id = botao.id || '';
        const title = botao.title || '';
        const onclick = botao.getAttribute('onclick') || '';
        const html = botao.innerHTML || '';
        const abaId = botao.closest('.aba') ? botao.closest('.aba').id : '';
        
        // Criar novo botão
        const novoBotao = document.createElement('button');
        novoBotao.id = id ? `${id}_fixed` : `botao_${index}_fixed`;
        novoBotao.className = 'botao-flutuante botao-flutuante-fixado';
        novoBotao.title = title;
        novoBotao.innerHTML = html;
        novoBotao.setAttribute('data-aba', abaId);
        
        // Estilizar o botão para garantir posição fixa
        novoBotao.style.cssText = `
          position: fixed !important;
          bottom: ${window.innerWidth <= 700 ? '16px' : '32px'} !important;
          right: ${window.innerWidth <= 700 ? '16px' : '32px'} !important;
          z-index: 9999 !important;
          display: flex !important;
          visibility: hidden;
          opacity: 0;
          width: ${window.innerWidth <= 700 ? '48px' : '60px'} !important;
          height: ${window.innerWidth <= 700 ? '48px' : '60px'} !important;
          border-radius: 50% !important;
          background: linear-gradient(120deg, #4f46e5 0%, #6366f1 100%) !important;
          color: #fff !important;
          align-items: center !important;
          justify-content: center !important;
          box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4) !important;
        `;
        
        // Adicionar evento de clique
        if (onclick) {
          novoBotao.addEventListener('click', function() {
            try {
              // Verificar se é uma função existente
              const funcMatch = onclick.match(/^([^\(]+)\(/);
              if (funcMatch && funcMatch[1]) {
                const funcName = funcMatch[1].trim();
                if (window[funcName] && typeof window[funcName] === 'function') {
                  window[funcName]();
                  return;
                }
              }
              
              // Se não for uma função existente, tentar usar Function
              new Function(onclick)();
            } catch (e) {
              console.error('Erro ao executar onclick:', e);
            }
          });
        }
        
        // Esconder o botão original
        botao.style.visibility = 'hidden';
        botao.style.opacity = '0';
        botao.style.pointerEvents = 'none';
        botao.setAttribute('data-fixed', 'true');
        
        // Adicionar o novo botão ao body
        document.body.appendChild(novoBotao);
      });
      
      // Mostrar os botões corretos para a aba atual
      atualizarVisibilidadeBotoes();
    } catch (error) {
      console.error('Erro ao fixar botões:', error);
    }
  }
  
  // Função para atualizar a visibilidade dos botões
  function atualizarVisibilidadeBotoes() {
    try {
      // Verificar se há modais abertos
      const modaisAbertos = document.body.classList.contains('modal-open');
      
      if (modaisAbertos) {
        // Esconder todos os botões se houver modais abertos
        ocultarTodosBotoes();
        return;
      }
      
      // Encontrar a aba ativa
      let abaAtiva = null;
      document.querySelectorAll('.aba').forEach(function(aba) {
        if (aba.style.display !== 'none') {
          abaAtiva = aba.id;
        }
      });
      
      if (!abaAtiva) return;
      
      // Ocultar todos os botões primeiro
      ocultarTodosBotoes();
      
      // Mostrar apenas o botão da aba ativa
      const botaoAba = document.querySelector(`.botao-flutuante-fixado[data-aba="${abaAtiva}"]`);
      if (botaoAba) {
        botaoAba.style.visibility = 'visible';
        botaoAba.style.opacity = '1';
      } else {
        // Se não tiver botão específico, mostrar o primeiro
        const primeiroBotao = document.querySelector('.botao-flutuante-fixado');
        if (primeiroBotao) {
          primeiroBotao.style.visibility = 'visible';
          primeiroBotao.style.opacity = '1';
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar visibilidade:', error);
    }
  }
  
  // Função para esconder todos os botões
  function ocultarTodosBotoes() {
    document.querySelectorAll('.botao-flutuante-fixado').forEach(function(btn) {
      btn.style.visibility = 'hidden';
      btn.style.opacity = '0';
    });
  }
  
  // Executar quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(fixarBotoes, 300);
    });
  } else {
    // DOM já carregado
    setTimeout(fixarBotoes, 300);
  }
  
  // Atualizar quando mudar de aba
  document.addEventListener('click', function(e) {
    if (e.target.closest('.sidebar-nav button')) {
      setTimeout(atualizarVisibilidadeBotoes, 300);
    }
  });
  
  // Observar mudanças de estilo nas abas
  try {
    const observer = new MutationObserver(function() {
      atualizarVisibilidadeBotoes();
    });
    
    // Observar quando o DOM estiver pronto
    window.addEventListener('load', function() {
      document.querySelectorAll('.aba').forEach(function(aba) {
        observer.observe(aba, { attributes: true, attributeFilter: ['style'] });
      });
    });
  } catch (error) {
    console.error('Erro ao configurar observer:', error);
  }
  
  // Verificar após o carregamento completo
  window.addEventListener('load', function() {
    setTimeout(fixarBotoes, 500);
    setTimeout(atualizarVisibilidadeBotoes, 600);
  });
})();
