// main.js - versão atualizada
import { auth } from './firebase-config.js';
import './notificacoes.js';
import { initDB } from './offline-db.js';

// Inicializações
initDB().catch(console.error);

// Verificar autenticação antes de inicializar o app
auth.onAuthStateChanged(user => {
  if (user) {
    inicializarApp();
  }
});

// Restante do código permanece o mesmo...

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
}

// ===== INICIALIZAR O APLICATIVO =====
function inicializarApp() {
  const abaInicial = localStorage.getItem('aba') || 'aplicacoes';
  mostrarAba(abaInicial);

  if (localStorage.getItem('tema') === 'claro') {
    document.body.classList.add('claro');
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

// Executa ao carregar a página
window.addEventListener('DOMContentLoaded', inicializarApp);
