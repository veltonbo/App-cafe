// ===== IMPORTAÇÕES =====
import { auth } from './firebase-config.js';
import { initDB } from './offline-db.js';

// ===== FUNÇÃO PARA TROCAR ABAS =====
function mostrarAba(abaId) {
  document.querySelectorAll('.aba').forEach(aba => {
    aba.style.display = 'none';
  });

  const abaSelecionada = document.getElementById(abaId);
  if (abaSelecionada) abaSelecionada.style.display = 'block';

  document.querySelectorAll('.menu-superior button').forEach(btn => {
    btn.classList.remove('active');
  });

  const btnId = 'btn-' + abaId;
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.add('active');

  localStorage.setItem('aba', abaId);

  // Disparar evento para atualizar gráficos se for a aba de relatório
  if (abaId === 'relatorio') {
    document.dispatchEvent(new CustomEvent('abaRelatorioAberta'));
  }
}

// No arquivo main.js, substitua o código de inicialização por:
function inicializarApp() {
  mostrarAba('aplicacoes'); // Ignora login
  document.body.style.display = 'block'; // Mostra todo o app
}

  // Eventos customizados para garantir que as funções carreguem corretamente
  document.addEventListener('dadosCarregados', () => {
    if (typeof carregarAplicacoes === "function") carregarAplicacoes();
    if (typeof carregarTarefas === "function") carregarTarefas();
    if (typeof carregarFinanceiro === "function") carregarFinanceiro();
    if (typeof carregarColheita === "function") carregarColheita();
    if (typeof carregarValorLata === "function") carregarValorLata();
    if (typeof carregarAnoSafra === "function") carregarAnoSafra();
    if (typeof carregarSafrasDisponiveis === "function") carregarSafrasDisponiveis();
  });

  // Disparar o evento após garantir que o DOM está pronto
  document.dispatchEvent(new Event('dadosCarregados'));
}

// ===== VERIFICAR AUTENTICAÇÃO =====
auth.onAuthStateChanged(user => {
  if (user) {
    // Usuário autenticado - inicializar app
    inicializarApp();
    document.getElementById('appContainer').style.display = 'block';
    document.getElementById('authContainer').style.display = 'none';
  } else {
    // Usuário não autenticado - mostrar tela de login
    document.getElementById('appContainer').style.display = 'none';
    document.getElementById('authContainer').style.display = 'block';
  }
});

// ===== INICIALIZAR BANCO DE DADOS OFFLINE =====
initDB().catch(error => {
  console.error('Erro ao inicializar banco de dados offline:', error);
});

// Executa ao carregar a página
window.addEventListener('DOMContentLoaded', () => {
  // Inicialização básica mesmo sem auth para carregar elementos do login
  document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
      alert('Erro no login: ' + error.message);
    }
  });

  document.getElementById('logoutButton')?.addEventListener('click', () => {
    auth.signOut();
  });
});

// Permissão temporária (remova após resolver o acesso)
firebase.auth().signInWithEmailAndPassword("admin@temp.com", "senhatemporaria")
  .catch(error => {
    console.error("Falha no login temporário:", error);
    window.location.href = "/login.html"; // Redireciona para tela de login
  });
