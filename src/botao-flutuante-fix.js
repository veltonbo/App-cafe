/**
 * Script para fixar botÃ£o flutuante fora de qualquer container relativo
 * Este script garante que o botÃ£o "adicionar" fique sempre fixo no canto inferior direito
 * da janela, independentemente da estrutura do DOM
 */

// Auto-executa para encapsular o cÃ³digo
(function() {
  // VariÃ¡vel para controlar se o script jÃ¡ foi executado
  var botaoFlutuanteFixAplicado = false;

  // FunÃ§Ã£o para garantir que o botÃ£o flutuante esteja sempre no lugar certo
  function fixarBotoesFlutuantes() {
    // Evitar execuÃ§Ã£o repetida
    if (botaoFlutuanteFixAplicado) return;
    
    console.log('Aplicando fix para botÃ£o flutuante');
    
    try {
      // Encontrar todos os botÃµes flutuantes (originais)
      const botoesFlutuantes = document.querySelectorAll('.botao-flutuante:not([data-fixed="true"])');
      
      if (botoesFlutuantes.length === 0) {
        console.log('Nenhum botÃ£o flutuante encontrado');
        return;
      }
      
      console.log(`Encontrados ${botoesFlutuantes.length} botÃµes flutuantes`);
      
      // Para cada botÃ£o encontrado
      botoesFlutuantes.forEach(function(botao, index) {
        // Verificar se jÃ¡ foi tratado para evitar duplicatas
        if (botao.getAttribute('data-fixed') === 'true') return;
        
        console.log(`Tratando botÃ£o ${index+1}: ${botao.id || 'sem id'}`);
        
        // Preservar os atributos originais do botÃ£o
        const id = botao.id;
        const title = botao.title || '';
        const onclick = botao.getAttribute('onclick') || '';
        const innerHTML = botao.innerHTML;
        const abaId = botao.closest('.aba')?.id || '';
        
        // Criar um botÃ£o clone simplificado
        const novoBotao = document.createElement('button');
        novoBotao.id = id ? `${id}_fixed` : `botao_flutuante_fixed_${index}`;
        novoBotao.className = 'botao-flutuante botao-flutuante-fixado';
        novoBotao.title = title;
        novoBotao.innerHTML = innerHTML;
        novoBotao.setAttribute('data-original-id', id || '');
        novoBotao.setAttribute('data-aba', abaId);
        
        // Aplicar o onclick sem usar eval diretamente
        if (onclick && onclick.trim() !== '') {
          novoBotao.addEventListener('click', function(e) {
            try {
              // Preservar o onclick original de forma mais segura
              const onclickAttr = onclick.trim();
              
              // Verificar se Ã© uma chamada de funÃ§Ã£o simples (comum em HTML)
              if (onclickAttr.includes('(') && onclickAttr.includes(')')) {
                const funcNameMatch = onclickAttr.match(/^([^\(]+)\(/);
                if (funcNameMatch && funcNameMatch[1]) {
                  const funcName = funcNameMatch[1].trim();
                  if (window[funcName] && typeof window[funcName] === 'function') {
                    window[funcName]();
                    return;
                  }
                }
              }
              
              // Se nÃ£o for uma chamada simples, usar Function constructor Ã© mais seguro que eval
              new Function(onclickAttr)();
            } catch (error) {
              console.error('Erro ao executar onclick:', error);
            }
          });
        }
        
        // Aplicar estilo inline diretamente
        novoBotao.style.cssText = `
          position: fixed !important;
          bottom: ${window.innerWidth <= 700 ? '16px' : '32px'} !important;
          right: ${window.innerWidth <= 700 ? '16px' : '32px'} !important;
          z-index: 9999 !important;
          display: flex !important;
          visibility: hidden !important;
          opacity: 0 !important;
          transform: none !important;
          margin: 0 !important;
          box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4) !important;
          align-items: center !important;
          justify-content: center !important;
          width: ${window.innerWidth <= 700 ? '48px' : '60px'} !important;
          height: ${window.innerWidth <= 700 ? '48px' : '60px'} !important;
          border-radius: 50% !important;
          background: linear-gradient(120deg, #4f46e5 0%, #6366f1 100%) !important;
          color: #fff !important;
        `;
        
        // Ocultar o botÃ£o original sem remover
        botao.style.visibility = 'hidden';
        botao.style.opacity = '0';
        botao.style.pointerEvents = 'none';
        botao.setAttribute('data-fixed', 'true');
        
        // Adicionar o novo botÃ£o ao body
        document.body.appendChild(novoBotao);
        
        console.log(`BotÃ£o ${novoBotao.id} criado e anexado ao body`);
      });
      
      // ApÃ³s aplicar o fix, marcar como concluÃ­do
      botaoFlutuanteFixAplicado = true;
      
      // Configurar mostrar/ocultar de acordo com a aba ativa
      atualizarVisibilidadeBotoes();
    } catch (error) {
      console.error('Erro ao aplicar fix para botÃ£o flutuante:', error);
    }
  }

  // FunÃ§Ã£o para atualizar a visibilidade dos botÃµes de acordo com a aba ativa
  function atualizarVisibilidadeBotoes() {
    try {
      // Verificar se hÃ¡ modal aberto, nesse caso nÃ£o mostramos os botÃµes
      const modaisAbertos = Array.from(document.querySelectorAll('.modal-flutuante-bg')).some(
        modal => modal.style.display !== 'none' && modal.style.opacity !== '0'
      );
      
      if (modaisAbertos || document.body.classList.contains('modal-open')) {
        console.log('Modais abertos, ocultando botÃµes flutuantes');
        document.querySelectorAll('.botao-flutuante-fixado').forEach(botao => {
          botao.style.visibility = 'hidden';
          botao.style.opacity = '0';
        });
        return;
      }
      
      // Determinar qual aba estÃ¡ ativa de forma mais precisa
      const abas = document.querySelectorAll('.aba');
      let abaAtiva = null;
      
      abas.forEach(function(aba) {
        if (aba.style.display !== 'none' && aba.style.opacity !== '0') {
          abaAtiva = aba.id;
        }
      });
      
      console.log('Aba ativa para botÃµes flutuantes:', abaAtiva);
      
      if (!abaAtiva) {
        console.log('Nenhuma aba ativa encontrada');
        return; // Nenhuma aba ativa
      }
      
      // Ocultar todos os botÃµes flutuantes fixados primeiro
      const botoesFixados = document.querySelectorAll('.botao-flutuante-fixado');
      botoesFixados.forEach(function(botao) {
        botao.style.visibility = 'hidden';
        botao.style.opacity = '0';
      });
      
      // Mostrar apenas o botÃ£o correspondente Ã  aba ativa
      const botaoAbaAtiva = document.querySelector(`.botao-flutuante-fixado[data-aba="${abaAtiva}"]`);
      if (botaoAbaAtiva) {
        botaoAbaAtiva.style.visibility = 'visible';
        botaoAbaAtiva.style.opacity = '1';
        console.log(`BotÃ£o para aba ${abaAtiva} ativado`);
      } else {
        console.log(`Nenhum botÃ£o encontrado para aba ${abaAtiva}`);
        
        // Busca por correspondÃªncia parcial (fallback)
        const botaoCorrespondente = Array.from(botoesFixados).find(botao => {
          const abaId = botao.getAttribute('data-aba') || '';
          return abaId && abaAtiva.includes(abaId) || abaId.includes(abaAtiva);
        });
        
        if (botaoCorrespondente) {
          botaoCorrespondente.style.visibility = 'visible';
          botaoCorrespondente.style.opacity = '1';
          console.log(`BotÃ£o correspondente encontrado por correspondÃªncia parcial`);
        } else {
          // Se nÃ£o houver botÃ£o especÃ­fico, mostrar o primeiro botÃ£o (como fallback)
          const primeiroBotao = botoesFixados[0];
          if (primeiroBotao) {
            primeiroBotao.style.visibility = 'visible';
            primeiroBotao.style.opacity = '1';
            console.log('Primeiro botÃ£o mostrado como fallback');
          }
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar visibilidade dos botÃµes:', error);
    }
  }

  // FunÃ§Ã£o para configurar o observer de abas
  function configurarObservador() {
    try {
      // Criar observer
      const abaSwitchObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if (mutation.type === 'attributes' && 
              mutation.attributeName === 'style' && 
              mutation.target.classList.contains('aba')) {
            atualizarVisibilidadeBotoes();
          }
        });
      });
      
      // Iniciar observaÃ§Ã£o de mudanÃ§as nas abas
      const abas = document.querySelectorAll('.aba');
      if (abas.length) {
        console.log(`Configurando observador para ${abas.length} abas`);
        abas.forEach(function(aba) {
          if (aba) {
            abaSwitchObserver.observe(aba, { attributes: true });
          }
        });
      } else {
        console.log('Nenhuma aba encontrada para observar');
        // Tentar novamente mais tarde
        setTimeout(configurarObservador, 500);
      }
    } catch (error) {
      console.error('Erro ao configurar observador de abas:', error);
    }
  }

  // Executar quando o DOM estiver pronto
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(fixarBotoesFlutuantes, 300);
    setTimeout(configurarObservador, 500);
  });
  
  // Executar quando a janela for redimensionada
  window.addEventListener('resize', function() {
    if (!botaoFlutuanteFixAplicado) {
      fixarBotoesFlutuantes();
    }
    
    // Atualizar posiÃ§Ã£o para tela atual
    const botoesFixados = document.querySelectorAll('.botao-flutuante-fixado');
    botoesFixados.forEach(function(botao) {
      botao.style.bottom = window.innerWidth <= 700 ? '16px' : '32px';
      botao.style.right = window.innerWidth <= 700 ? '16px' : '32px';
      botao.style.width = window.innerWidth <= 700 ? '48px' : '60px';
      botao.style.height = window.innerWidth <= 700 ? '48px' : '60px';
    });
  });
  
  // Executar quando a pÃ¡gina terminar de carregar
  window.addEventListener('load', function() {
    setTimeout(function() {
      if (!botaoFlutuanteFixAplicado) {
        fixarBotoesFlutuantes();
      }
      atualizarVisibilidadeBotoes();
    }, 500);
  });
  
  // Interceptar o switch de abas e atualizar botÃµes de forma segura
  try {
    if (window.mostrarAba && typeof window.mostrarAba === 'function') {
      const originalMostrarAba = window.mostrarAba;
      window.mostrarAba = function(abaId) {
        try {
          originalMostrarAba(abaId);
        } catch (e) {
          console.error('Erro ao executar mostrarAba original:', e);
        }
        setTimeout(atualizarVisibilidadeBotoes, 100);
      };
      console.log('FunÃ§Ã£o mostrarAba interceptada com sucesso');
    } else {
      // Se a funÃ§Ã£o nÃ£o estiver disponÃ­vel agora, tentar novamente apÃ³s a pÃ¡gina carregar
      window.addEventListener('load', function() {
        if (window.mostrarAba && typeof window.mostrarAba === 'function') {
          const originalMostrarAba = window.mostrarAba;
          window.mostrarAba = function(abaId) {
            originalMostrarAba(abaId);
            setTimeout(atualizarVisibilidadeBotoes, 100);
          };
          console.log('FunÃ§Ã£o mostrarAba interceptada apÃ³s carregamento');
        }
      });
    }
  } catch (error) {
    console.error('Erro ao interceptar mostrarAba:', error);
  }
  
  // Inicializar apÃ³s um pequeno atraso
  setTimeout(fixarBotoesFlutuantes, 300);
})();
