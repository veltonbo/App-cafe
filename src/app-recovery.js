/**
 * Script de recuperação para o App Café
 * Este script deve ser carregado em caso de problemas para restaurar o funcionamento básico
 */

// Variável para controlar se a recuperação já foi aplicada
let recuperacaoAplicada = false;

// Função de recuperação principal
function aplicarRecuperacao() {
  // Evitar aplicar a recuperação múltiplas vezes
  if (recuperacaoAplicada) return;
  recuperacaoAplicada = true;
  
  console.log('Detectado possível travamento. Iniciando recuperação...');
  
  try {
    // Remover classe de loading para permitir interação
    document.documentElement.classList.remove('loading');
    
    // Mostrar a primeira aba ou a aba "inicio" se existir
    const abaInicio = document.getElementById('inicio');
    const primeiraAba = document.querySelector('.aba');
    
    document.querySelectorAll('.aba').forEach(function(aba) {
      aba.style.display = 'none';
      aba.style.opacity = '0';
    });
    
    if (abaInicio) {
      abaInicio.style.display = 'block';
      abaInicio.style.opacity = '1';
    } else if (primeiraAba) {
      primeiraAba.style.display = 'block';
      primeiraAba.style.opacity = '1';
    }
    
    // Corrigir o sidebar
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.remove('open');
      sidebar.classList.add('closed');
    }
    
    // Corrigir o background do sidebar
    const sidebarBg = document.getElementById('sidebarMobileBg');
    if (sidebarBg) {
      sidebarBg.style.display = 'none';
      sidebarBg.style.opacity = '0';
    }
    
    // Substituir quaisquer botões flutuantes problemáticos
    document.querySelectorAll('.botao-flutuante').forEach(function(btn) {
      // Preservar os atributos importantes
      const id = btn.id;
      const title = btn.title || '';
      const onclick = btn.getAttribute('onclick') || '';
      const innerHTML = btn.innerHTML;
      
      btn.style.cssText = `
        position: fixed !important;
        bottom: ${window.innerWidth <= 700 ? '16px' : '32px'} !important;
        right: ${window.innerWidth <= 700 ? '16px' : '32px'} !important;
        z-index: 9999 !important;
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        align-items: center !important;
        justify-content: center !important;
      `;
    });
    
    console.log('Recuperação aplicada com sucesso');
    
    // Alertar o usuário de forma mais discreta
    const mensagem = document.createElement('div');
    mensagem.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      z-index: 10000;
      font-size: 14px;
      text-align: center;
    `;
    mensagem.textContent = 'Aplicativo recuperado após problema de carregamento. Recomendamos recarregar a página.';
    document.body.appendChild(mensagem);
    
    // Remover a mensagem após 8 segundos
    setTimeout(() => {
      mensagem.style.opacity = '0';
      setTimeout(() => mensagem.remove(), 500);
    }, 8000);
  } catch (error) {
    console.error('Erro durante a recuperação:', error);
  }
}

// Verificar se a página está demorando muito para carregar
setTimeout(function() {
  // Se ainda estiver com classe loading após 5 segundos, provavelmente está travado
  if (document.documentElement.classList.contains('loading')) {
    aplicarRecuperacao();
  }
}, 5000);

// Verificar novamente após 10 segundos para casos mais graves
setTimeout(function() {
  if (document.documentElement.classList.contains('loading')) {
    if (!recuperacaoAplicada) {
      aplicarRecuperacao();
    }
    
    // Criar botão para recarregar a página
    const btnRecarregar = document.createElement('button');
    btnRecarregar.textContent = 'Recarregar Página';
    btnRecarregar.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      padding: 15px 30px;
      background: #4f46e5;
      color: white;
      border: none;
      border-radius: 5px;
      font-size: 16px;
      cursor: pointer;
      z-index: 10000;
    `;
    btnRecarregar.onclick = function() {
      window.location.reload();
    };
    document.body.appendChild(btnRecarregar);
  }
}, 10000);

// Último recurso - após 15 segundos, sugerir recarregar a página
setTimeout(function() {
  if (document.documentElement.classList.contains('loading')) {
    if (confirm('O aplicativo está demorando muito para carregar. Deseja recarregar a página?')) {
      window.location.reload();
    }
  }
}, 15000);

// Função para verificar e corrigir botões flutuantes
window.addEventListener('load', function() {
  setTimeout(function() {
    const botoesFlutuantes = document.querySelectorAll('.botao-flutuante');
    if (botoesFlutuantes.length > 0) {
      botoesFlutuantes.forEach(function(btn) {
        // Verificar se o botão está visível
        const computedStyle = window.getComputedStyle(btn);
        if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden' || computedStyle.opacity === '0') {
          console.log('Corrigindo botão flutuante invisível:', btn.id);
          btn.style.display = 'flex';
          btn.style.visibility = 'visible';
          btn.style.opacity = '1';
        }
      });
    }
  }, 2000);
});
