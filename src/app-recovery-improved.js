/**
 * Script de recuperação melhorado para o App Café
 * Este script corrige problemas de travamento e garante o funcionamento adequado da aplicação
 */

// Variável para controlar se a recuperação já foi aplicada
let recuperacaoAplicada = false;

// Função de recuperação principal
function aplicarRecuperacao(nivel = 1) {
  // Evitar aplicar a recuperação múltiplas vezes
  if (recuperacaoAplicada) return;
  recuperacaoAplicada = true;
  
  console.log(`Detectado possível travamento. Iniciando recuperação nível ${nivel}...`);
  
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
    
    // Buscar botões flutuantes e garantir visibilidade
    corrigirBotoesFlutuantes(nivel);
    
    // Nível 2 ou maior: reparar completamente o DOM
    if (nivel >= 2) {
      repararDOM();
    }
    
    console.log(`Recuperação nível ${nivel} aplicada com sucesso`);
    
    // Alertar o usuário de forma discreta
    mostrarMensagemRecuperacao(nivel);
  } catch (error) {
    console.error(`Erro durante a recuperação nível ${nivel}:`, error);
  }
}

// Função para corrigir botões flutuantes
function corrigirBotoesFlutuantes(nivel) {
  try {
    // Substituir quaisquer botões flutuantes problemáticos
    document.querySelectorAll('.botao-flutuante').forEach(function(btn) {
      // Preservar os atributos importantes
      const id = btn.id;
      const title = btn.title || '';
      const onclick = btn.getAttribute('onclick') || '';
      const innerHTML = btn.innerHTML;
      const abaId = btn.closest('.aba')?.id || '';
      
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
        transform: none !important;
      `;
      
      // Se for nível 2 ou 3, reativar o onclick
      if (nivel >= 2 && onclick) {
        try {
          if (onclick.includes('(') && onclick.includes(')')) {
            const funcNameMatch = onclick.match(/^([^\(]+)\(/);
            if (funcNameMatch && funcNameMatch[1]) {
              const funcName = funcNameMatch[1].trim();
              if (window[funcName] && typeof window[funcName] === 'function') {
                btn.onclick = function() {
                  window[funcName]();
                };
              }
            }
          }
        } catch (e) {
          console.error('Erro ao reativar onclick:', e);
        }
      }
    });
    
    // Verificar se há botões fixados, caso contrário aplicar o fix
    const botoesFixados = document.querySelectorAll('.botao-flutuante-fixado');
    if (botoesFixados.length === 0 && typeof window.fixarBotoesFlutuantes === 'function') {
      window.fixarBotoesFlutuantes();
    }
  } catch (e) {
    console.error('Erro ao corrigir botões:', e);
  }
}

// Função para reparar o DOM em níveis mais avançados de recuperação
function repararDOM() {
  // Limpar event listeners problemáticos
  try {
    const novoBody = document.body.cloneNode(true);
    const oldBody = document.body;
    document.documentElement.replaceChild(novoBody, oldBody);
    console.log('DOM reconstruído com sucesso');
  } catch (e) {
    console.error('Erro ao reconstruir DOM:', e);
  }
}

// Função para mostrar mensagem de recuperação
function mostrarMensagemRecuperacao(nivel) {
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
  
  if (nivel === 1) {
    mensagem.textContent = 'O aplicativo foi recuperado após um pequeno problema.';
  } else if (nivel === 2) {
    mensagem.textContent = 'O aplicativo foi recuperado. Considere recarregar a página.';
  } else {
    mensagem.textContent = 'Recuperação de emergência aplicada. Recomendamos recarregar a página.';
  }
  
  document.body.appendChild(mensagem);
  
  // Remover a mensagem após alguns segundos
  setTimeout(() => {
    mensagem.style.opacity = '0';
    mensagem.style.transition = 'opacity 0.5s ease';
    setTimeout(() => mensagem.remove(), 500);
  }, 6000);
}

// Verificar se o app já está funcionando normalmente
function appEstaFuncionando() {
  try {
    // Verificar se alguma aba está visível
    const abasVisiveis = Array.from(document.querySelectorAll('.aba')).some(aba => 
      aba.style.display === 'block' && aba.style.opacity === '1'
    );
    
    // Verificar se carregamento foi concluído
    const carregamentoConcluido = !document.documentElement.classList.contains('loading');
    
    // Verificar se existem botões flutuantes visíveis
    const botoesFlutuantesVisiveis = Array.from(document.querySelectorAll('.botao-flutuante-fixado, .botao-flutuante')).some(btn => 
      btn.style.opacity === '1' && btn.style.visibility === 'visible'
    );
    
    console.log(`Status do app: abas=${abasVisiveis}, carregamento=${carregamentoConcluido}, botões=${botoesFlutuantesVisiveis}`);
    
    // Se pelo menos duas dessas condições forem verdadeiras, o app está funcionando
    let condicoesAtendidas = 0;
    if (abasVisiveis) condicoesAtendidas++;
    if (carregamentoConcluido) condicoesAtendidas++;
    if (botoesFlutuantesVisiveis) condicoesAtendidas++;
    
    return condicoesAtendidas >= 2;
  } catch (e) {
    console.error('Erro ao verificar funcionamento do app:', e);
    return false;
  }
}

// Recuperação nível 1 após 5 segundos (se necessário)
setTimeout(function() {
  if (!appEstaFuncionando()) {
    console.log('App não está funcionando após 5s, tentando recuperação nível 1');
    aplicarRecuperacao(1);
  }
}, 5000);

// Recuperação nível 2 após 10 segundos (se necessário)
setTimeout(function() {
  if (!appEstaFuncionando()) {
    console.log('App não está funcionando após 10s, tentando recuperação nível 2');
    aplicarRecuperacao(2);
    
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
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    btnRecarregar.onclick = function() {
      window.location.reload();
    };
    document.body.appendChild(btnRecarregar);
  }
}, 10000);

// Recuperação nível 3 após 15 segundos (se necessário)
setTimeout(function() {
  if (!appEstaFuncionando()) {
    console.log('App não está funcionando após 15s, tentando recuperação nível 3');
    aplicarRecuperacao(3);
    
    // Usar confirm apenas se não estiver em mobile
    if (!(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))) {
      if (confirm('O aplicativo não está respondendo corretamente. Deseja recarregar a página?')) {
        window.location.reload();
      }
    }
  }
}, 15000);

// Verificação adicional após carregamento completo da página
window.addEventListener('load', function() {
  setTimeout(function() {
    if (!recuperacaoAplicada) {
      // Verificar e corrigir botões flutuantes mesmo que o app pareça estar funcionando
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
    }
  }, 2000);
});
