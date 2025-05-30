/**
 * Correção para o problema do menu de opções em lançamentos financeiros
 * Este script corrige o problema onde todos os modais são abertos ao clicar em qualquer botão de opção
 */

// Solução direta - substitui completamente a função renderizarCardFinanceiro no financeiro.js
document.addEventListener('DOMContentLoaded', function() {
  console.log('Aplicando correção para botões de opções de lançamentos');

  // Patch direto na função renderizarCardFinanceiro
  window.renderizarCardFinanceiro = function(gasto, lista) {
    const i = gasto._index;
    const card = document.createElement("div");
    card.className = "financeiro-card" + (gasto.pago ? " pago" : "");
    card.dataset.index = i; // Importante: adicionar índice como data-attribute
    
    card.innerHTML = `
      <div class="financeiro-card-top">
        <span class="financeiro-card-produto">${gasto.produto}</span>
        <span class="financeiro-card-valor">${formatarValorBR(gasto.valor)}</span>
      </div>
      <div class="financeiro-card-desc">${gasto.descricao ? gasto.descricao : "&nbsp;"}</div>
      <div class="financeiro-card-data">${formatarDataBR(gasto.data)}</div>
      <div class="financeiro-card-tipo">${gasto.tipo}</div>
      <div class="opcoes-wrapper">
        <button class="seta-menu-opcoes-padrao" aria-label="Abrir opções">&#8250;</button>
        <ul class="menu-opcoes-padrao-lista" style="display:none;">
          ${!gasto.pago ? "<li class='opcao-menu-padrao' data-acao='editar'>Editar</li>" : ''}
          <li class='opcao-menu-padrao' data-acao='deletar'>Deletar</li>
          <li class='opcao-menu-padrao' data-acao='estornar'>Estornar</li>
        </ul>
      </div>
    `;
    
    // Captura elementos do menu
    const seta = card.querySelector('.seta-menu-opcoes-padrao');
    const menu = card.querySelector('.menu-opcoes-padrao-lista');
    
    // Importante: criar closure com o índice correto
    const currentIndex = i;
    
    // Adiciona evento de clique no botão de opções (com índice preservado no escopo)
    seta.addEventListener('click', function(e) {
      e.stopPropagation();
      
      // Fechar todos os outros menus abertos
      document.querySelectorAll('.menu-opcoes-padrao-lista').forEach(function(m) {
        if (m !== menu) {
          m.classList.remove('aberta');
          m.style.display = 'none';
        }
      });
      
      // Alternar este menu
      const aberto = menu.classList.contains('aberta');
      if (aberto) {
        menu.classList.remove('aberta');
        menu.style.display = 'none';
      } else {
        menu.classList.add('aberta');
        menu.style.display = 'block';
      }
    });
    
    // Adiciona eventos para as opções do menu (usando o currentIndex correto)
    menu.querySelectorAll('.opcao-menu-padrao').forEach(function(opcao) {
      opcao.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        
        // Fecha o menu
        menu.classList.remove('aberta');
        menu.style.display = 'none';
        
        // Executa a ação com o índice capturado no closure
        const acao = opcao.dataset.acao;
        console.log('Ação clicada:', acao, 'para índice:', currentIndex);
        
        if (acao === 'editar') {
          editarFinanceiro(currentIndex);
        } else if (acao === 'deletar') {
          excluirFinanceiro(currentIndex);
        } else if (acao === 'estornar') {
          estornarFinanceiro(currentIndex);
        }
      });
    });
    
    // Marcar como pago ao clicar no card (se não pago)
    if (!gasto.pago) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', (e) => {
        if (e.target.closest('.seta-menu-opcoes-padrao') || e.target.closest('.menu-opcoes-padrao-lista')) return;
        marcarFinanceiroPago(currentIndex);
      });
    }
    
    lista.appendChild(card);
    return card;
  };
  
  // Patch na função atualizarFinanceiro para garantir que os menus sejam fechados
  const originalAtualizarFinanceiro = window.atualizarFinanceiro;
  window.atualizarFinanceiro = function() {
    // Fecha todos os menus antes de atualizar
    document.querySelectorAll('.menu-opcoes-padrao-lista').forEach(menu => {
      menu.classList.remove('aberta');
      menu.style.display = 'none';
    });
    
    // Continua com a função original
    return originalAtualizarFinanceiro.apply(this, arguments);
  };

  // Fecha menus ao clicar fora
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.opcoes-wrapper')) {
      document.querySelectorAll('.menu-opcoes-padrao-lista').forEach(menu => {
        menu.classList.remove('aberta');
        menu.style.display = 'none';
      });
    }
  });
});
