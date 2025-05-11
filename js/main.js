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

// ===== VARIÁVEIS GLOBAIS =====
let telaAtual = "inicio";

// ===== FUNÇÃO PARA INICIAR A TELA =====
document.addEventListener("DOMContentLoaded", () => {
  carregarTelaInicio();
});

// ===== CARREGAR TELA DE INÍCIO =====
function carregarTelaInicio() {
  document.querySelectorAll(".aba").forEach(aba => aba.style.display = "none");
  document.getElementById("telaInicio").style.display = "block";
  atualizarResumoInicio();
  atualizarIconeMenu();
}

// ===== ATUALIZAR RESUMO DA TELA DE INÍCIO =====
function atualizarResumoInicio() {
  const totalLatas = colheita.reduce((soma, c) => soma + c.quantidade, 0);
  const totalPago = colheita.reduce((soma, c) => soma + (c.pagoParcial * c.valorLata), 0);
  const totalPendente = colheita.reduce((soma, c) => soma + ((c.quantidade - c.pagoParcial) * c.valorLata), 0);

  document.getElementById("totalLatasInicio").innerText = totalLatas.toFixed(2);
  document.getElementById("totalPagoInicio").innerText = totalPago.toFixed(2);
  document.getElementById("totalPendenteInicio").innerText = totalPendente.toFixed(2);
}

// ===== ALTERNAR ENTRE MENU E INÍCIO =====
function alternarMenuInicio() {
  if (telaAtual === "inicio") {
    irParaMenu();
  } else {
    carregarTelaInicio();
  }
}

// ===== IR PARA MENU =====
function irParaMenu() {
  document.querySelectorAll(".aba").forEach(aba => aba.style.display = "none");
  document.getElementById("colheita").style.display = "block";
  telaAtual = "menu";
  atualizarIconeMenu();
}

// ===== ATUALIZAR ÍCONE DO BOTÃO =====
function atualizarIconeMenu() {
  const icone = document.getElementById("iconeMenu");
  if (telaAtual === "inicio") {
    icone.className = "fas fa-bars";
  } else {
    icone.className = "fas fa-home";
  }
}

// Executa ao carregar a página
window.addEventListener('DOMContentLoaded', inicializarApp);

