function mostrarAba(abaId) {
  document.querySelectorAll('.aba').forEach(aba => aba.classList.remove('active'));
  const abaSelecionada = document.getElementById(abaId);
  if (abaSelecionada) abaSelecionada.classList.add('active');

  document.querySelectorAll('.menu-superior button').forEach(btn => btn.classList.remove('active'));
  const btnId = 'btn-' + abaId;
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.add('active');

  localStorage.setItem('aba', abaId);
}

function inicializarApp() {
  const abaInicial = localStorage.getItem('aba') || 'aplicacoes';
  mostrarAba(abaInicial);

  if (localStorage.getItem('tema') === 'claro') {
    document.body.classList.add('claro');
  }

  // Chama as funções de carregamento se estiverem disponíveis
  if (typeof carregarAplicacoes === "function") carregarAplicacoes();
  if (typeof carregarTarefas === "function") carregarTarefas();
  if (typeof carregarFinanceiro === "function") carregarFinanceiro();
  if (typeof carregarColheita === "function") carregarColheita();
  if (typeof carregarValorLata === "function") carregarValorLata();
  if (typeof carregarAnoSafra === "function") carregarAnoSafra();
  if (typeof carregarSafrasDisponiveis === "function") carregarSafrasDisponiveis();
}

// Executa ao carregar a página
window.addEventListener('DOMContentLoaded', inicializarApp);
