/**
 * Script para fixar botão flutuante fora de qualquer container relativo
 * Este script garante que o botão "adicionar" fique sempre fixo no canto inferior direito
 * da janela, independentemente da estrutura do DOM
 */

// Auto-executa para encapsular o código
(function() {
  // Variável para controlar se o script já foi executado
  var botaoFlutuanteFixAplicado = false;

  // Função para garantir que o botão flutuante esteja sempre no lugar certo
  function fixarBotoesFlutuantes() {
    // Evitar execução repetida
    if (botaoFlutuanteFixAplicado) return;
    
    console.log('Aplicando fix para botão flutuante');
    
    try {
      // Encontrar todos os botões flutuantes (originais)
      const botoesFlutuantes = document.querySelectorAll('.botao-flutuante:not([data-fixed="true"])');
      
      if (botoesFlutuantes.length === 0) {
        console.log('Nenhum botão flutuante encontrado');
        return;
      }
      
      console.log(`Encontrados ${botoesFlutuantes.length} botões flutuantes`);
      
      // Para cada botão encontrado
      botoesFlutuantes.forEach(function(botao, index) {
        // Verificar se já foi tratado para evitar duplicatas
        if (botao.getAttribute('data-fixed') === 'true') return;
        
        console.log(`Tratando botão ${index+1}: ${botao.id || 'sem id'}`);
        
        // Preservar os atributos originais do botão
        const id = botao.id;
        const title = botao.title || '';
        const onclick = botao.getAttribute('onclick') || '';
        const innerHTML = botao.innerHTML;
        const abaId = botao.closest('.aba')?.id || '';
        
        // Criar um botão clone simplificado
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
              
              // Verificar se é uma chamada de função simples (comum em HTML)
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
              
              // Se não for uma chamada simples, usar Function constructor é mais seguro que eval
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
        
        // Ocultar o botão original sem remover
        botao.style.visibility = 'hidden';
        botao.style.opacity = '0';
        botao.style.pointerEvents = 'none';
        botao.setAttribute('data-fixed', 'true');
        
        // Adicionar o novo botão ao body
        document.body.appendChild(novoBotao);
        
        console.log(`Botão ${novoBotao.id} criado e anexado ao body`);
      });
      
      // Após aplicar o fix, marcar como concluído
      botaoFlutuanteFixAplicado = true;
      
      // Configurar mostrar/ocultar de acordo com a aba ativa
      atualizarVisibilidadeBotoes();
    } catch (error) {
      console.error('Erro ao aplicar fix para botão flutuante:', error);
    }
  }

  // Função para atualizar a visibilidade dos botões de acordo com a aba ativa
  function atualizarVisibilidadeBotoes() {
    try {
      // Verificar se há modal aberto, nesse caso não mostramos os botões
      const modaisAbertos = Array.from(document.querySelectorAll('.modal-flutuante-bg')).some(
        modal => modal.style.display !== 'none' && modal.style.opacity !== '0'
      );
      
      if (modaisAbertos || document.body.classList.contains('modal-open')) {
        console.log('Modais abertos, ocultando botões flutuantes');
        document.querySelectorAll('.botao-flutuante-fixado').forEach(botao => {
          botao.style.visibility = 'hidden';
          botao.style.opacity = '0';
        });
        return;
      }
      
      // Determinar qual aba está ativa de forma mais precisa
      const abas = document.querySelectorAll('.aba');
      let abaAtiva = null;
      
      abas.forEach(function(aba) {
        if (aba.style.display !== 'none' && aba.style.opacity !== '0') {
          abaAtiva = aba.id;
        }
      });
      
      console.log('Aba ativa para botões flutuantes:', abaAtiva);
      
      if (!abaAtiva) {
        console.log('Nenhuma aba ativa encontrada');
        return; // Nenhuma aba ativa
      }
      
      // Ocultar todos os botões flutuantes fixados primeiro
      const botoesFixados = document.querySelectorAll('.botao-flutuante-fixado');
      botoesFixados.forEach(function(botao) {
        botao.style.visibility = 'hidden';
        botao.style.opacity = '0';
      });
      
      // Mostrar apenas o botão correspondente à aba ativa
      const botaoAbaAtiva = document.querySelector(`.botao-flutuante-fixado[data-aba="${abaAtiva}"]`);
      if (botaoAbaAtiva) {
        botaoAbaAtiva.style.visibility = 'visible';
        botaoAbaAtiva.style.opacity = '1';
        console.log(`Botão para aba ${abaAtiva} ativado`);
      } else {
        console.log(`Nenhum botão encontrado para aba ${abaAtiva}`);
        
        // Busca por correspondência parcial (fallback)
        const botaoCorrespondente = Array.from(botoesFixados).find(botao => {
          const abaId = botao.getAttribute('data-aba') || '';
          return abaId && abaAtiva.includes(abaId) || abaId.includes(abaAtiva);
        });
        
        if (botaoCorrespondente) {
          botaoCorrespondente.style.visibility = 'visible';
          botaoCorrespondente.style.opacity = '1';
          console.log(`Botão correspondente encontrado por correspondência parcial`);
        } else {
          // Se não houver botão específico, mostrar o primeiro botão (como fallback)
          const primeiroBotao = botoesFixados[0];
          if (primeiroBotao) {
            primeiroBotao.style.visibility = 'visible';
            primeiroBotao.style.opacity = '1';
            console.log('Primeiro botão mostrado como fallback');
          }
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar visibilidade dos botões:', error);
    }
  }

  // Função para configurar o observer de abas
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
      
      // Iniciar observação de mudanças nas abas
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
    
    // Atualizar posição para tela atual
    const botoesFixados = document.querySelectorAll('.botao-flutuante-fixado');
    botoesFixados.forEach(function(botao) {
      botao.style.bottom = window.innerWidth <= 700 ? '16px' : '32px';
      botao.style.right = window.innerWidth <= 700 ? '16px' : '32px';
      botao.style.width = window.innerWidth <= 700 ? '48px' : '60px';
      botao.style.height = window.innerWidth <= 700 ? '48px' : '60px';
    });
  });
  
  // Executar quando a página terminar de carregar
  window.addEventListener('load', function() {
    setTimeout(function() {
      if (!botaoFlutuanteFixAplicado) {
        fixarBotoesFlutuantes();
      }
      atualizarVisibilidadeBotoes();
    }, 500);
  });
  
  // Interceptar o switch de abas e atualizar botões de forma segura
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
      console.log('Função mostrarAba interceptada com sucesso');
    } else {
      // Se a função não estiver disponível agora, tentar novamente após a página carregar
      window.addEventListener('load', function() {
        if (window.mostrarAba && typeof window.mostrarAba === 'function') {
          const originalMostrarAba = window.mostrarAba;
          window.mostrarAba = function(abaId) {
            originalMostrarAba(abaId);
            setTimeout(atualizarVisibilidadeBotoes, 100);
          };
          console.log('Função mostrarAba interceptada após carregamento');
        }
      });
    }
  } catch (error) {
    console.error('Erro ao interceptar mostrarAba:', error);
  }
  
  // Inicializar após um pequeno atraso
  setTimeout(fixarBotoesFlutuantes, 300);
})();
