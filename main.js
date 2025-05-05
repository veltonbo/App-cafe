// ===== INICIALIZAÇÃO DO SISTEMA =====
function inicializarApp() {
  carregarAplicacoes();
  carregarTarefas();
  carregarFinanceiro(); // chamada correta para carregar financeiro
  carregarColheita();
  carregarConfiguracoes();
  aplicarTemaSalvo();
}

// ===== TROCAR ENTRE ABAS =====
function mostrarAba(id) {
  document.querySelectorAll(".aba").forEach(aba => aba.classList.remove("active"));
  const abaSelecionada = document.getElementById(id);
  if (abaSelecionada) {
    abaSelecionada.classList.add("active");
  }

  // Atualiza botões do menu superior
  document.querySelectorAll(".menu-superior button").forEach(btn => btn.classList.remove("active"));
  const btnSelecionado = document.getElementById("btn-" + id);
  if (btnSelecionado) {
    btnSelecionado.classList.add("active");
  }
}

// ===== ALTERNAR TEMA CLARO/ESCURO =====
function alternarTema() {
  document.documentElement.classList.toggle("claro");
  const modoAtual = document.documentElement.classList.contains("claro") ? "claro" : "escuro";
  localStorage.setItem("tema", modoAtual);
}

// ===== APLICAR TEMA SALVO NO INÍCIO =====
function aplicarTemaSalvo() {
  const temaSalvo = localStorage.getItem("tema");
  if (temaSalvo === "claro") {
    document.documentElement.classList.add("claro");
  }
}

// ===== MOSTRAR/OCULTAR CAMPOS DE APLICAÇÃO NAS TAREFAS =====
function mostrarCamposAplicacao() {
  const checkbox = document.getElementById("eAplicacaoCheckbox");
  const campos = document.getElementById("camposAplicacao");
  campos.style.display = checkbox.checked ? "block" : "none";
}

// ===== TOGGLE DE FILTROS NO MENU FINANCEIRO =====
function toggleFiltrosFinanceiro() {
  const filtros = document.getElementById("filtrosFinanceiro");
  filtros.style.display = filtros.style.display === "none" ? "block" : "none";
}
