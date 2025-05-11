// ===== FUNÇÃO PARA TROCAR ABAS =====
function mostrarAba(abaId) {
  document.querySelectorAll('.aba').forEach(aba => {
    aba.style.display = 'none';
  });

  const abaSelecionada = document.getElementById(abaId);
  if (abaSelecionada) {
    abaSelecionada.style.display = 'block';
    carregarAbaEspecifica(abaId);
  }

  document.querySelectorAll('.menu-superior button').forEach(btn => {
    btn.classList.remove('active');
  });

  const btnId = 'btn-' + abaId;
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.add('active');

  localStorage.setItem('aba', abaId);
}

// ===== FUNÇÃO PARA CARREGAR A ABA ESPECÍFICA =====
function carregarAbaEspecifica(abaId) {
  switch (abaId) {
    case 'inicio':
      if (typeof carregarInicio === "function") carregarInicio();
      break;
    case 'aplicacoes':
      if (typeof carregarAplicacoes === "function") carregarAplicacoes();
      break;
    case 'tarefas':
      if (typeof carregarTarefas === "function") carregarTarefas();
      break;
    case 'financeiro':
      if (typeof carregarFinanceiro === "function") carregarFinanceiro();
      break;
    case 'colheita':
      if (typeof carregarColheita === "function") carregarColheita();
      if (typeof carregarValorLata === "function") carregarValorLata();
      break;
    case 'configuracoes':
      if (typeof carregarAnoSafra === "function") carregarAnoSafra();
      if (typeof carregarSafrasDisponiveis === "function") carregarSafrasDisponiveis();
      break;
    default:
      console.warn("Aba não reconhecida:", abaId);
  }
}

// ===== INICIALIZAR O APLICATIVO =====
function inicializarApp() {
  const abaInicial = localStorage.getItem('aba') || 'inicio';
  mostrarAba(abaInicial);

  aplicarTemaLocalStorage();

  // Disparar o evento após garantir que o DOM está pronto
  document.dispatchEvent(new Event('dadosCarregados'));
}

// ===== APLICAR TEMA COM BASE NO LOCALSTORAGE =====
function aplicarTemaLocalStorage() {
  const temaSalvo = localStorage.getItem('tema');
  document.body.classList.toggle('claro', temaSalvo === 'claro');
}

// ===== TROCAR TEMA (CLARO/ESCURO) =====
function alternarTema() {
  const temaAtual = document.body.classList.contains('claro') ? 'escuro' : 'claro';
  document.body.classList.toggle('claro', temaAtual === 'claro');
  localStorage.setItem('tema', temaAtual);
}

// ===== FUNÇÃO PARA FORMATAR DATA (DD/MM/AAAA) =====
  function formatarDataBR(dataISO) {
    const [ano, mes, dia] = dataISO.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  // ===== FUNÇÃO PARA FORMATAR VALOR EM REAIS (R$) =====
  function formatarValorBR(valor) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  }

// ===== FORMULÁRIO DE APLICAÇÕES =====
function mostrarFormularioAplicacao() {
  document.getElementById("formularioAplicacoes").style.display = "block";
}

function salvarAplicacao() {
  // Sua lógica de salvar aplicação
  document.getElementById("formularioAplicacoes").style.display = "none";
}

function cancelarAplicacao() {
  document.getElementById("formularioAplicacoes").style.display = "none";
}

// ===== FORMULÁRIO DE TAREFAS =====
function mostrarFormularioTarefa() {
  document.getElementById("formularioTarefas").style.display = "block";
}

function salvarTarefa() {
  document.getElementById("formularioTarefas").style.display = "none";
}

function cancelarTarefa() {
  document.getElementById("formularioTarefas").style.display = "none";
}

// ===== FORMULÁRIO DE FINANCEIRO =====
function mostrarFormularioFinanceiro() {
  document.getElementById("formularioFinanceiro").style.display = "block";
}

function salvarFinanceiro() {
  document.getElementById("formularioFinanceiro").style.display = "none";
}

function cancelarFinanceiro() {
  document.getElementById("formularioFinanceiro").style.display = "none";
}

// ===== FORMULÁRIO DE COLHEITA =====
function mostrarFormularioColheita() {
  document.getElementById("formularioColheita").style.display = "block";
}

function salvarColheita() {
  document.getElementById("formularioColheita").style.display = "none";
}

function cancelarColheita() {
  document.getElementById("formularioColheita").style.display = "none";
}

// Executa ao carregar a página
window.addEventListener('DOMContentLoaded', inicializarApp);
