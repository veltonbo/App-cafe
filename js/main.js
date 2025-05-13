// main.js

document.addEventListener('DOMContentLoaded', () => {
  // --- Alternância de abas ---
  const abas = document.querySelectorAll('.aba');
  const menuButtons = document.querySelectorAll('.menu-superior button');
  const abaIds = Array.from(menuButtons).map(btn => btn.dataset.aba);

  function mostrarAba(idAba, updateHash = true) {
    abas.forEach(aba => {
      if (aba.id === 'aba-' + idAba) {
        aba.style.display = 'block';
        aba.classList.add('fade-in');
        setTimeout(() => aba.classList.remove('fade-in'), 300);
        // Foco no primeiro input editável da aba ativa
        setTimeout(() => {
          const primeiroInput = aba.querySelector('input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])');
          if (primeiroInput) primeiroInput.focus();
        }, 100);
      } else {
        aba.style.display = 'none';
      }
    });
    menuButtons.forEach(btn => {
      if (btn.dataset.aba === idAba) {
        btn.classList.add('active');
        btn.setAttribute('aria-current', 'page');
      } else {
        btn.classList.remove('active');
        btn.removeAttribute('aria-current');
      }
    });
    localStorage.setItem('abaAtiva', idAba);
    if (updateHash) window.location.hash = idAba;
  }

  // Clique nos botões do menu
  menuButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      mostrarAba(btn.dataset.aba);
    });
    // Acessibilidade: navegação por teclado
    btn.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        mostrarAba(btn.dataset.aba);
      }
    });
    btn.setAttribute('tabindex', '0');
  });

  // Alternância de abas por hash na URL
  function abrirAbaPorHash() {
    const hash = window.location.hash.replace('#', '');
    if (abaIds.includes(hash)) {
      mostrarAba(hash, false);
    } else {
      const abaSalva = localStorage.getItem('abaAtiva') || abaIds[0];
      mostrarAba(abaSalva, false);
    }
  }
  window.addEventListener('hashchange', abrirAbaPorHash);
  abrirAbaPorHash();

  // --- Atalhos de teclado para abas (Ctrl+1, Ctrl+2, ...) ---
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
      const idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < abaIds.length) {
        mostrarAba(abaIds[idx]);
        e.preventDefault();
      }
    }
  });

  // --- Alternância de tema claro/escuro ---
  const btnAlternarTema = document.getElementById('btnAlternarTema');
  function aplicarTemaSalvo() {
    if (localStorage.getItem('tema') === 'claro') {
      document.body.classList.add('claro');
    } else {
      document.body.classList.remove('claro');
    }
  }
  if (btnAlternarTema) {
    btnAlternarTema.addEventListener('click', () => {
      document.body.classList.toggle('claro');
      localStorage.setItem('tema', document.body.classList.contains('claro') ? 'claro' : 'escuro');
      mostrarToast('Tema alterado!', 'info');
    });
    aplicarTemaSalvo();
  } else {
    aplicarTemaSalvo();
  }

  // --- Toasts empilháveis com animação e acessibilidade ---
  function criarToastContainer() {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.style.position = 'fixed';
      toastContainer.style.bottom = '20px';
      toastContainer.style.right = '20px';
      toastContainer.style.zIndex = '9999';
      toastContainer.style.maxWidth = '90vw';
      toastContainer.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  window.mostrarToast = function(msg, tipo = 'info', tempo = 2500) {
    const toastContainer = criarToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    let icone = '';
    if (tipo === 'erro') icone = '<i class="fas fa-times-circle" style="margin-right:8px"></i>';
    else if (tipo === 'sucesso') icone = '<i class="fas fa-check-circle" style="margin-right:8px"></i>';
    else if (tipo === 'aviso') icone = '<i class="fas fa-exclamation-triangle" style="margin-right:8px"></i>';
    else icone = '<i class="fas fa-info-circle" style="margin-right:8px"></i>';
    toast.innerHTML = `${icone}${msg}`;
    toast.style.background = tipo === 'erro' ? '#f44336' : (tipo === 'sucesso' ? '#4caf50' : (tipo === 'aviso' ? '#ff9800' : '#333'));
    toast.style.color = '#fff';
    toast.style.padding = '12px 20px';
    toast.style.marginTop = '8px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.fontSize = '1rem';
    toast.style.transform = 'translateY(20px)';
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    }, 50);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => toast.remove(), 300);
    }, tempo);
  };

  // Exemplo de uso global:
  window.mostrarMensagem = window.mostrarToast;

  // --- Animação fade-in para abas (adicione ao seu CSS) ---
  // .fade-in { animation: fadeIn 0.3s; }
  // @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
});
