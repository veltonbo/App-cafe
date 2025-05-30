/**
 * Correção para o problema do menu de opções em lançamentos financeiros
 * Este script corrige o problema onde todos os modais são abertos ao clicar em qualquer botão de opção
 * Versão 2.0: Utiliza um MutationObserver para corrigir os menus após eles serem criados
 */

(function() {
  console.log('Inicializando fix avançado para menus financeiros v2.0');
  
  // Função que corrige o comportamento dos menus de opções em cards financeiros
  function corrigirMenusOpcoes() {
    // Seleciona todos os cards financeiros que têm menus de opções
    const cards = document.querySelectorAll('.financeiro-card .opcoes-wrapper');
    console.log(`Encontrados ${cards.length} cards financeiros para corrigir`);
    
    cards.forEach((opcoesWrapper, idx) => {
      // Verificar se já foi corrigido
      if (opcoesWrapper.hasAttribute('data-fixed')) return;
      
      // Marca como corrigido
      opcoesWrapper.setAttribute('data-fixed', 'true');
      
      // Encontrar elementos do menu
      const seta = opcoesWrapper.querySelector('.seta-menu-opcoes-padrao');
      const menu = opcoesWrapper.querySelector('.menu-opcoes-padrao-lista');
      const card = opcoesWrapper.closest('.financeiro-card');
      
      if (!seta || !menu || !card) {
        console.warn('Elementos de menu incompletos em um card financeiro');
        return;
      }
      
      // Obter índice do registro a partir do dataset do card
      const index = card.dataset.index;
      
      // Remover o handler de evento antigo
      seta.onclick = null;
      
      // Adicionar novo handler com escopo correto
      seta.onclick = (e) => {
        e.stopPropagation();
        
        // Fechar todos os outros menus abertos
        document.querySelectorAll('.menu-opcoes-padrao-lista').forEach(m => {
          if (m !== menu) {
            m.classList.remove('aberta');
            m.style.display = 'none';
            const s = m.closest('.opcoes-wrapper')?.querySelector('.seta-menu-opcoes-padrao');
            if (s) s.setAttribute('aria-expanded', 'false');
          }
        });
        
        // Alternar este menu
        const aberto = menu.classList.contains('aberta');
        if (aberto) {
          menu.classList.remove('aberta');
          menu.style.display = 'none';
          seta.setAttribute('aria-expanded', 'false');
        } else {
          menu.classList.add('aberta');
          menu.style.display = 'block';
          seta.setAttribute('aria-expanded', 'true');
        }
      };
      
      // Corrigir handlers de opções de menu
      menu.querySelectorAll('.opcao-menu-padrao').forEach(opcao => {
        // Remover handlers antigos
        opcao.onclick = null;
        
        // Novo handler com captura do índice correto
        opcao.onclick = (e) => {
          e.stopPropagation();
          menu.classList.remove('aberta');
          menu.style.display = 'none';
          seta.setAttribute('aria-expanded', 'false');
          
          // Preserva o índice usando dataset para ação
          const acao = opcao.dataset.acao;
          const currentIndex = index;
          
          console.log(`Executando ação ${acao} para índice ${currentIndex}`);
          
          if (acao === 'editar' && typeof editarFinanceiro === 'function') {
            editarFinanceiro(currentIndex);
          } else if (acao === 'deletar' && typeof excluirFinanceiro === 'function') {
            excluirFinanceiro(currentIndex);
          } else if (acao === 'estornar' && typeof estornarFinanceiro === 'function') {
            estornarFinanceiro(currentIndex);
          }
        };
      });
      
      console.log(`Card financeiro #${idx} corrigido com sucesso`);
    });
  }

  // Patch na função original para adicionar o data-index necessário
  const originalFunc = window.renderizarCardFinanceiro;
  if (originalFunc) {
    console.log('Função renderizarCardFinanceiro encontrada, aplicando patch');
    window.renderizarCardFinanceiro = function(gasto, lista) {
      const result = originalFunc.apply(this, arguments);
      // Executar correções após renderização
      setTimeout(corrigirMenusOpcoes, 0);
      return result;
    };
  } else {
    console.log('Função renderizarCardFinanceiro não encontrada, preparando observador');
    
    // Configurar MutationObserver para detectar quando novos cards financeiros são adicionados
    const config = { childList: true, subtree: true };
    const observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          const hasNewCards = Array.from(mutation.addedNodes).some(node => 
            node.nodeType === Node.ELEMENT_NODE && 
            (node.classList?.contains('financeiro-card') || 
             node.querySelector?.('.financeiro-card'))
          );
          
          if (hasNewCards) {
            console.log('Novos cards financeiros detectados, aplicando correção');
            corrigirMenusOpcoes();
            break;
          }
        }
      }
    });

    // Inicializa o observer
    const targetNode = document.body;
    if (targetNode) {
      observer.observe(targetNode, config);
      console.log('Observer iniciado no body');
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, config);
        console.log('Observer iniciado após DOMContentLoaded');
      });
    }
  }

  // Aplicar correção inicial para quaisquer cards já presentes no DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', corrigirMenusOpcoes);
  } else {
    corrigirMenusOpcoes();
  }
})();
