// ===== MAIN.JS - Controle de Navegação e Funções Globais =====

// ===== VARIÁVEIS GLOBAIS =====
let aplicacoes = [];
let tarefas = [];
let tarefasFeitas = [];
let financeiro = [];
let financeiroPago = [];
let colheitas = [];
let colheitasPagas = [];

// ===== FUNÇÃO: CARREGAR ABA DE FORMA DINÂMICA =====
function carregarAba(arquivo) {
  fetch(arquivo)
    .then(response => response.text())
    .then(html => {
      document.getElementById('conteudoPrincipal').innerHTML = html;
      inicializarAba(arquivo);
    })
    .catch(error => console.error("Erro ao carregar a aba:", error));
  
  localStorage.setItem('aba', arquivo);
}

// ===== FUNÇÃO: INICIALIZAR A ABA CARREGADA =====
function inicializarAba(arquivo) {
  switch (arquivo) {
    case 'aplicacao.html':
      carregarAplicacoes();
      break;
    case 'tarefas.html':
      carregarTarefas();
      break;
    case 'financeiro.html':
      carregarFinanceiro();
      break;
    case 'colheita.html':
      carregarColheita();
      break;
    case 'relatorio.html':
      gerarRelatorioCompleto();
      break;
    case 'configuracoes.html':
      carregarConfiguracoes();
      break;
  }
}

// ===== FUNÇÃO: CARREGAR APLICAÇÕES =====
function carregarAplicacoes() {
  const listaAplicacoes = document.getElementById("listaAplicacoes");
  if (!listaAplicacoes) return;
  listaAplicacoes.innerHTML = aplicacoes.map((app, index) => `
    <div>${app.data} - ${app.produto} (${app.dosagem}) 
      <button onclick="excluirAplicacao(${index})">Excluir</button>
    </div>
  `).join("");
}

function adicionarAplicacao() {
  const nova = {
    data: document.getElementById("dataApp").value,
    produto: document.getElementById("produtoApp").value,
    dosagem: document.getElementById("dosagemApp").value
  };
  aplicacoes.push(nova);
  carregarAplicacoes();
}

function excluirAplicacao(index) {
  aplicacoes.splice(index, 1);
  carregarAplicacoes();
}

// ===== FUNÇÃO: CARREGAR TAREFAS =====
function carregarTarefas() {
  const listaTarefas = document.getElementById("listaTarefas");
  if (!listaTarefas) return;
  listaTarefas.innerHTML = tarefas.map((tarefa, index) => `
    <div>${tarefa.descricao} 
      <button onclick="marcarFeita(${index})">Feita</button>
    </div>
  `).join("");
}

function adicionarTarefa() {
  const nova = {
    descricao: document.getElementById("descricaoTarefa").value
  };
  tarefas.push(nova);
  carregarTarefas();
}

function marcarFeita(index) {
  const tarefa = tarefas.splice(index, 1)[0];
  tarefasFeitas.push(tarefa);
  carregarTarefas();
}

// ===== FUNÇÃO: CARREGAR FINANCEIRO =====
function carregarFinanceiro() {
  const listaFinanceiro = document.getElementById("listaFinanceiro");
  if (!listaFinanceiro) return;
  listaFinanceiro.innerHTML = financeiro.map((fin, index) => `
    <div>${fin.descricao} - R$ ${fin.valor} 
      <button onclick="pagarFinanceiro(${index})">Pagar</button>
    </div>
  `).join("");
}

function adicionarFinanceiro() {
  const novo = {
    descricao: document.getElementById("descricaoFin").value,
    valor: document.getElementById("valorFin").value
  };
  financeiro.push(novo);
  carregarFinanceiro();
}

function pagarFinanceiro(index) {
  const item = financeiro.splice(index, 1)[0];
  financeiroPago.push(item);
  carregarFinanceiro();
}

// ===== FUNÇÃO: CARREGAR COLHEITAS =====
function carregarColheita() {
  const listaColheitas = document.getElementById("listaColheitas");
  if (!listaColheitas) return;
  listaColheitas.innerHTML = colheitas.map((colheita, index) => `
    <div>${colheita.colhedor} - ${colheita.quantidade} Latas 
      <button onclick="excluirColheita(${index})">Excluir</button>
    </div>
  `).join("");
}

function adicionarColheita() {
  const nova = {
    colhedor: document.getElementById("colhedor").value,
    quantidade: document.getElementById("quantidadeLatas").value
  };
  colheitas.push(nova);
  carregarColheita();
}

function excluirColheita(index) {
  colheitas.splice(index, 1);
  carregarColheita();
}

// ===== FUNÇÃO: GERAR RELATÓRIO =====
function gerarRelatorioCompleto() {
  console.log("Relatório Gerado");
}

// ===== FUNÇÃO: CONFIGURAÇÕES =====
function carregarConfiguracoes() {
  if (localStorage.getItem("tema") === "claro") {
    document.body.classList.add("claro");
  }
}

// ===== EVENTO: INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
  const abaInicial = localStorage.getItem('aba') || 'aplicacao.html';
  carregarAba(abaInicial);
});

// ===== FUNÇÃO: ALTERNAR FORMULÁRIO DE APLICAÇÃO =====
function alternarFormularioAplicacao() {
  const form = document.getElementById("formAplicacao");
  form.style.display = form.style.display === "none" ? "block" : "none";
}

// ===== FUNÇÃO: ADICIONAR APLICAÇÃO (com fechamento automático) =====
function adicionarAplicacao() {
  const nova = {
    data: document.getElementById("dataApp").value,
    produto: document.getElementById("produtoApp").value.trim(),
    dosagem: document.getElementById("dosagemApp").value.trim()
  };

  if (!nova.data || !nova.produto || !nova.dosagem) {
    alert("Preencha todos os campos.");
    return;
  }

  aplicacoes.push(nova);
  carregarAplicacoes();
  salvarDadosFirebase("aplicacoes", aplicacoes);

  // Limpar e fechar formulário
  document.getElementById("dataApp").value = "";
  document.getElementById("produtoApp").value = "";
  document.getElementById("dosagemApp").value = "";
  document.getElementById("formAplicacao").style.display = "none";
}

// ===== FUNÇÃO: ALTERNAR FORMULÁRIO DE TAREFA =====
function alternarFormularioTarefa() {
  const form = document.getElementById("formTarefa");
  form.style.display = form.style.display === "none" ? "block" : "none";
}

// ===== FUNÇÃO: ADICIONAR TAREFA (com fechamento automático) =====
function adicionarTarefa() {
  const descricao = document.getElementById("descricaoTarefa").value.trim();
  if (!descricao) {
    alert("Preencha a descrição.");
    return;
  }

  tarefas.push({ descricao });
  carregarTarefas();
  salvarDadosFirebase("tarefas", { tarefas, tarefasFeitas });

  // Limpar e fechar formulário
  document.getElementById("descricaoTarefa").value = "";
  document.getElementById("formTarefa").style.display = "none";
}

// ===== FUNÇÃO: ALTERNAR FORMULÁRIO FINANCEIRO =====
function alternarFormularioFinanceiro() {
  const form = document.getElementById("formFinanceiro");
  form.style.display = form.style.display === "none" ? "block" : "none";
}

// ===== FUNÇÃO: ADICIONAR FINANCEIRO (com fechamento automático) =====
function adicionarFinanceiro() {
  const novo = {
    descricao: document.getElementById("descricaoFin").value.trim(),
    valor: parseFloat(document.getElementById("valorFin").value)
  };

  if (!novo.descricao || isNaN(novo.valor)) {
    alert("Preencha todos os campos.");
    return;
  }

  financeiro.push(novo);
  carregarFinanceiro();
  salvarDadosFirebase("financeiro", { financeiro, financeiroPago });

  // Limpar e fechar formulário
  document.getElementById("descricaoFin").value = "";
  document.getElementById("valorFin").value = "";
  document.getElementById("formFinanceiro").style.display = "none";
}

// ===== FUNÇÃO: CONTROLAR EXIBIÇÃO DO BOTÃO FLUTUANTE =====
document.addEventListener('DOMContentLoaded', () => {
  const botoesFlutuantes = document.querySelectorAll(".botao-flutuante");
  botoesFlutuantes.forEach(botao => {
    botao.classList.add("mostrar");
  });
});

// ===== FUNÇÃO: ALTERNAR FORMULÁRIO DE APLICAÇÃO =====
function alternarFormularioAplicacao() {
  const form = document.getElementById("formAplicacao");
  form.style.display = form.style.display === "none" ? "block" : "none";
}

// ===== FUNÇÃO: ADICIONAR APLICAÇÃO (com fechamento automático) =====
function adicionarAplicacao() {
  const nova = {
    data: document.getElementById("dataApp").value,
    produto: document.getElementById("produtoApp").value.trim(),
    dosagem: document.getElementById("dosagemApp").value.trim()
  };

  if (!nova.data || !nova.produto || !nova.dosagem) {
    alert("Preencha todos os campos.");
    return;
  }

  aplicacoes.push(nova);
  carregarAplicacoes();
  salvarDadosFirebase("aplicacoes", aplicacoes);

  document.getElementById("dataApp").value = "";
  document.getElementById("produtoApp").value = "";
  document.getElementById("dosagemApp").value = "";
  document.getElementById("formAplicacao").style.display = "none";
}

// ===== FUNÇÃO: ALTERNAR FORMULÁRIO DE TAREFA =====
function alternarFormularioTarefa() {
  const form = document.getElementById("formTarefa");
  form.style.display = form.style.display === "none" ? "block" : "none";
}

// ===== FUNÇÃO: ADICIONAR TAREFA (com fechamento automático) =====
function adicionarTarefa() {
  const descricao = document.getElementById("descricaoTarefa").value.trim();
  if (!descricao) {
    alert("Preencha a descrição.");
    return;
  }

  tarefas.push({ descricao });
  carregarTarefas();
  salvarDadosFirebase("tarefas", { tarefas, tarefasFeitas });

  document.getElementById("descricaoTarefa").value = "";
  document.getElementById("formTarefa").style.display = "none";
}

// ===== FUNÇÃO: ALTERNAR FORMULÁRIO FINANCEIRO =====
function alternarFormularioFinanceiro() {
  const form = document.getElementById("formFinanceiro");
  form.style.display = form.style.display === "none" ? "block" : "none";
}

// ===== FUNÇÃO: ADICIONAR FINANCEIRO (com fechamento automático) =====
function adicionarFinanceiro() {
  const novo = {
    descricao: document.getElementById("descricaoFin").value.trim(),
    valor: parseFloat(document.getElementById("valorFin").value)
  };

  if (!novo.descricao || isNaN(novo.valor)) {
    alert("Preencha todos os campos.");
    return;
  }

  financeiro.push(novo);
  carregarFinanceiro();
  salvarDadosFirebase("financeiro", { financeiro, financeiroPago });

  document.getElementById("descricaoFin").value = "";
  document.getElementById("valorFin").value = "";
  document.getElementById("formFinanceiro").style.display = "none";
}
