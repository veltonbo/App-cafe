function mostrarAba(abaId) {
  document.querySelectorAll('.aba').forEach(aba => aba.classList.remove('active'));
  document.getElementById(abaId).classList.add('active');

  document.querySelectorAll('.menu-superior button').forEach(btn => btn.classList.remove('active'));
  const btnId = 'btn-' + abaId;
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.add('active');

  localStorage.setItem('aba', abaId);
}

window.onload = function inicializarApp() {
  mostrarAba(localStorage.getItem('aba') || 'aplicacoes');

  if (localStorage.getItem('tema') === 'claro') {
    document.body.classList.add('claro');
  }

  carregarAplicacoes?.();
  carregarTarefas?.();
  carregarFinanceiro?.();
  carregarColheita?.();
  carregarValorLata?.();
  carregarAnoSafra?.();
  carregarSafrasDisponiveis?.();
}
