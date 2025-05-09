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
      exibirBotaoFlutuante();
    })
    .catch(error => console.error("Erro ao carregar a aba:", error));
  
  localStorage.setItem('aba', arquivo);
}

// ===== FUNÇÃO: INICIALIZAR A ABA CARREGADA =====
function inicializarAba(arquivo) {
  switch (arquivo) {
    case 'aplicacao.html': carregarAplicacoes(); break;
    case 'tarefas.html': carregarTarefas(); break;
    case 'financeiro.html': carregarFinanceiro(); break;
    case 'colheita.html': carregarColheita(); break;
    case 'relatorio.html': gerarRelatorioCompleto(); break;
    case 'configuracoes.html': carregarConfiguracoes(); break;
  }
}

// ===== FUNÇÃO: CARREGAR APLICAÇÕES =====
function carregarAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  if (!lista) return;
  lista.innerHTML = aplicacoes.map((app, index) => `
    <div>${app.data} - ${app.produto} (${app.dosagem}) 
      <button onclick="excluirAplicacao(${index})">Excluir</button>
    </div>
  `).join("");
}

function adicionarAplicacao() {
  const nova = {
    data: document.getElementById("dataApp").value.trim(),
    produto: document.getElementById("produtoApp").value.trim(),
    dosagem: document.getElementById("dosagemApp").value.trim()
  };

  if (!nova.data || !nova.produto || !nova.dosagem) {
    alert("Preencha todos os campos.");
    return;
  }

  aplicacoes.push(nova);
  carregarAplicacoes();
  limparFormulario('formAplicacao');
}

// ===== FUNÇÃO: CARREGAR TAREFAS =====
function carregarTarefas() {
  const lista = document.getElementById("listaTarefas");
  if (!lista) return;
  lista.innerHTML = tarefas.map((tarefa, index) => `
    <div>${tarefa.descricao} 
      <button onclick="marcarFeita(${index})">Feita</button>
    </div>
  `).join("");
}

function adicionarTarefa() {
  const descricao = document.getElementById("descricaoTarefa").value.trim();
  if (!descricao) {
    alert("Preencha a descrição.");
    return;
  }

  tarefas.push({ descricao });
  carregarTarefas();
  limparFormulario('formTarefa');
}

// ===== FUNÇÃO: CARREGAR FINANCEIRO =====
function carregarFinanceiro() {
  const lista = document.getElementById("listaFinanceiro");
  if (!lista) return;
  lista.innerHTML = financeiro.map((fin, index) => `
    <div>${fin.descricao} - R$ ${parseFloat(fin.valor).toFixed(2)} 
      <button onclick="pagarFinanceiro(${index})">Pagar</button>
    </div>
  `).join("");
}

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
  limparFormulario('formFinanceiro');
}

// ===== FUNÇÃO: LIMPAR E OCULTAR FORMULÁRIO =====
function limparFormulario(formId) {
  const form = document.getElementById(formId);
  if (form) {
    form.querySelectorAll("input").forEach(input => input.value = "");
    form.classList.remove("mostrar");
  }
}

// ===== FUNÇÃO: ALTERNAR FORMULÁRIO COM ANIMAÇÃO =====
function alternarFormulario(id) {
  const form = document.getElementById(id);
  if (!form) return;

  form.classList.toggle("mostrar");
}

// ===== FUNÇÃO: CONTROLAR BOTÃO FLUTUANTE =====
function controlarFormularioFlutuante() {
  const abaAtual = localStorage.getItem('aba');
  switch (abaAtual) {
    case 'aplicacao.html': alternarFormulario('formAplicacao'); break;
    case 'tarefas.html': alternarFormulario('formTarefa'); break;
    case 'financeiro.html': alternarFormulario('formFinanceiro'); break;
    default: alert("Este menu não tem formulário flutuante.");
  }
}

// ===== FUNÇÃO: EXIBIR OU OCULTAR BOTÃO FLUTUANTE =====
function exibirBotaoFlutuante() {
  const abaAtual = localStorage.getItem('aba');
  const botao = document.getElementById("botaoFlutuante");
  botao.style.display = ['aplicacao.html', 'tarefas.html', 'financeiro.html'].includes(abaAtual) ? "flex" : "none";
}

// ===== CHAMAR A EXIBIÇÃO AUTOMÁTICA DO BOTÃO =====
document.addEventListener('DOMContentLoaded', () => {
  exibirBotaoFlutuante();
});

// ===== FUNÇÃO: SALVAR DADOS (FAKE) =====
function salvarDadosFirebase(caminho, dados) {
  console.log(`Salvando em ${caminho}:`, JSON.stringify(dados));
}
