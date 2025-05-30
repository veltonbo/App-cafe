/**
 * ARQUIVO DESATIVADO - Mantido apenas como backup
 * 
 * Este script foi substituído pelo botao-flutuante-fix.js
 * Ele não será executado automaticamente, mas está mantido como referência
 * e pode ser ativado manualmente em caso de necessidade.
 */

// Variável de controle para evitar execução automática
const POSITION_FIXES_DESATIVADO = true;

// Esta função só será executada se chamada manualmente
function ativarPositionFixes() {
  console.log('Position fixes ativado manualmente');
  
  // Função para garantir posição fixa do botão adicionar
  function posicionarBotaoFlutuante() {
    // Seleciona todos os botões flutuantes
    const addButtons = document.querySelectorAll('.botao-flutuante:not(.botao-flutuante-fixado)');
    
    // Se não encontrou botões, não faz nada
    if (addButtons.length === 0) return;
    
    console.log('Position fixes: encontrados ' + addButtons.length + ' botões para ajustar');
    
    // Para cada botão encontrado
    addButtons.forEach(function(addButton) {
      // Move o botão para fora de qualquer container com position: relative
      // Movemos para o final do body para garantir que ele esteja no nível mais alto do DOM
      document.body.appendChild(addButton);
      
      // Configura o estilo inline com !important para sobrescrever qualquer estilo
      addButton.style.cssText = `
        position: fixed !important;
        bottom: ${window.innerWidth <= 700 ? '16px' : '32px'} !important;
        right: ${window.innerWidth <= 700 ? '16px' : '32px'} !important;
        z-index: 9999 !important;
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        transform: none !important;
        margin: 0 !important;
        box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4) !important;
        width: ${window.innerWidth <= 700 ? '48px' : '60px'} !important;
        height: ${window.innerWidth <= 700 ? '48px' : '60px'} !important;
        border-radius: 50% !important;
      `;
    });
  }
    // Não executar automaticamente
  if (!POSITION_FIXES_DESATIVADO) {
    // Executar imediatamente para configurar o botão
    posicionarBotaoFlutuante();
    
    // Reconfigurar quando a janela for redimensionada
    window.addEventListener('resize', function() {
      // Reposicionar o botão flutuante
      posicionarBotaoFlutuante();
      
      // Handle option menus for responsiveness
      const allMenus = document.querySelectorAll('.menu-opcoes-padrao-lista');
      allMenus.forEach(menu => {
        // Close menus when window is resized to prevent UI issues
        menu.style.display = 'none';
        menu.classList.remove('aberta');
      });
    });
    
    // Verificar a posição após carregar completamente
    window.addEventListener('load', posicionarBotaoFlutuante);
  }
  
  // Função para emergências (pode ser chamada do console)
  window.corrigirBotoesEmergencia = function() {
    console.log("Iniciando correção de emergência para botões flutuantes");
    posicionarBotaoFlutuante();
    return "Correção de emergência aplicada aos botões flutuantes";
  };
}

// Expor a função de ativação globalmente para uso em emergências
window.ativarPositionFixes = ativarPositionFixes;

// Este script não executa nada automaticamente - precisa ser chamado manualmente
