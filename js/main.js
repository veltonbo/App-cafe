// main.js - Versão Melhorada

document.addEventListener('DOMContentLoaded', () => {
  // --- Alternância de abas ---
  const abas = document.querySelectorAll('.aba');
  const menuButtons = document.querySelectorAll('.menu-superior button');

  function mostrarAba(idAba) {
    abas.forEach(aba => {
      if (aba.id === 'aba-' + idAba) {
        aba.style.display = 'block';
        aba.classList.add('fade-in');
        setTimeout(() => aba.classList.remove('fade-in'), 300);
        // Foco no primeiro input do formulário da aba ativa
        const primeiroInput = aba.querySelector('input, select, textarea');
        if (primeiroInput) primeiroInput.focus();
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
  });

  // Exibe a aba salva ou a primeira por padrão
  const abaSalva = localStorage.getItem('abaAtiva') || 'aplicacoes';
  mostrarAba(abaSalva);

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
  }

  // --- Toast simples para feedback visual ---
  function criarToastContainer() {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.style.position = 'fixed';
      toastContainer.style.bottom = '20px';
      toastContainer.style.right = '20px';
      toastContainer.style.zIndex = '9999';
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  window.mostrarToast = function(msg, tipo = 'info', tempo = 2500) {
    const toastContainer = criarToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.textContent = msg;
    toast.style.background = tipo === 'erro' ? '#f44336' : (tipo === 'sucesso' ? '#4caf50' : '#333');
    toast.style.color = '#fff';
    toast.style.padding = '12px 20px';
    toast.style.marginTop = '8px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    toastContainer.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '1'; }, 50);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, tempo);
  };

  // Exemplo de uso global:
  window.mostrarMensagem = window.mostrarToast;

  // --- Loader global (opcional, use quando necessário) ---
  window.mostrarLoader = function(msg = "Carregando...") {
    let loader = document.getElementById('loader-global');
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'loader-global';
      loader.innerHTML = `<div class="loader-bg"></div>
        <div class="loader-box">${msg}</div>`;
      loader.style.position = 'fixed';
      loader.style.top = 0;
      loader.style.left = 0;
      loader.style.width = '100vw';
      loader.style.height = '100vh';
      loader.style.display = 'flex';
      loader.style.alignItems = 'center';
      loader.style.justifyContent = 'center';
      loader.style.zIndex = 99999;
      document.body.appendChild(loader);
    }
    loader.style.display = 'flex';
  };
  window.esconderLoader = function() {
    const loader = document.getElementById('loader-global');
    if (loader) loader.style.display = 'none';
  };

  // --- SweetAlert2 para confirmações globais (opcional) ---
  window.confirmarAcao = function({title, text, confirmButtonText = "Confirmar", cancelButtonText = "Cancelar", onConfirm}) {
    if (window.Swal) {
      Swal.fire({
        title: title || "Confirmar ação?",
        text: text || "",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText,
        cancelButtonText
      }).then(result => {
        if (result.isConfirmed && typeof onConfirm === "function") onConfirm();
      });
    } else {
      if (confirm(text || title || "Confirmar?")) {
        if (typeof onConfirm === "function") onConfirm();
      }
    }
  };

  // --- Acessibilidade: permite navegação por Tab no menu ---
  menuButtons.forEach(btn => btn.setAttribute('tabindex', '0'));

  // --- Animação fade-in para abas (adicione ao seu CSS) ---
  // .fade-in { animation: fadeIn 0.3s; }
  // @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
});
