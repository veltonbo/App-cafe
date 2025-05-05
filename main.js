// ===== MOSTRAR ABA =====
function mostrarAba(id) {
  const abas = document.querySelectorAll('.aba');
  abas.forEach(aba => aba.classList.remove('active'));

  const botoes = document.querySelectorAll('.menu-superior button');
  botoes.forEach(btn => btn.classList.remove('active'));

  document.getElementById(id).classList.add('active');
  document.getElementById(`btn-${id}`).classList.add('active');

// ===== INICIALIZAÇÃO PRINCIPAL =====
function inicializarApp() {
  carregarAplicacoes?.();
  carregarTarefas?.();
  carregarFinanceiro?.();
  carregarColheita?.();
  carregarConfiguracoes?.();
  mostrarAba('aplicacoes'); // inicia no menu aplicações
}

// ===== AJUDA NO PARCELAMENTO =====
function mostrarParcelas() {
  const checkbox = document.getElementById("parceladoFin");
  const campoParcelas = document.getElementById("parcelasFin");
  campoParcelas.style.display = checkbox.checked ? "inline-block" : "none";
}

// ===== TOGGLE DE FILTROS DO FINANCEIRO =====
function toggleFiltrosFinanceiro() {
  const filtros = document.getElementById("filtrosFinanceiro");
  filtros.style.display = filtros.style.display === "none" ? "block" : "none";
}

// ===== AJUSTAR CLASSE VISUAL DE BOTÕES =====
function ajustarEspacoTextoItemFinanceiro() {
  const itens = document.querySelectorAll("#financeiro .item");
  itens.forEach(item => {
    const botoes = item.querySelectorAll("button");
    const classe = botoes.length > 2 ? "botoes-3" : "botoes-2";
    item.classList.remove("botoes-2", "botoes-3");
    item.classList.add(classe);
  });
}
