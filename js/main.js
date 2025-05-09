// ===== MAIN.JS - Controle de Navegação e Funções Globais =====

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
    case 'aplicacao.html': configurarAplicacoes(); break;
    case 'tarefas.html': configurarTarefas(); break;
    case 'financeiro.html': configurarFinanceiro(); break;
    default: console.error("Aba desconhecida:", arquivo);
  }
}

// ===== FUNÇÃO: CONTROLAR BOTÃO FLUTUANTE =====
function controlarFormularioFlutuante() {
  const abaAtual = localStorage.getItem('aba');
  switch (abaAtual) {
    case 'aplicacao.html': alternarFormulario('formAplicacao'); break;
    case 'tarefas.html': alternarFormulario('formTarefa'); break;
    case 'financeiro.html': alternarFormulario('formFinanceiro'); break;
  }
}

// ===== FUNÇÃO: ALTERNAR FORMULÁRIO =====
function alternarFormulario(id) {
  const form = document.getElementById(id);
  if (form) {
    form.style.display = form.style.display === "none" ? "block" : "none";
  }
}

// ===== FUNÇÃO: EXIBIR OU OCULTAR BOTÃO FLUTUANTE =====
function exibirBotaoFlutuante() {
  const abaAtual = localStorage.getItem('aba');
  const botao = document.getElementById("botaoFlutuante");

  if (['aplicacao.html', 'tarefas.html', 'financeiro.html'].includes(abaAtual)) {
    botao.style.display = "flex";
  } else {
    botao.style.display = "none";
  }
}

// ===== CONFIGURAR FUNÇÕES DAS ABAS =====
function configurarAplicacoes() {
  document.getElementById('conteudoPrincipal').innerHTML += `
    <div id="formAplicacao" style="display: none;">
      <input type="date" id="dataApp">
      <input placeholder="Produto" id="produtoApp">
      <input placeholder="Dosagem" id="dosagemApp">
      <button onclick="adicionarAplicacao()">Salvar Aplicação</button>
    </div>
  `;
}

function configurarTarefas() {
  document.getElementById('conteudoPrincipal').innerHTML += `
    <div id="formTarefa" style="display: none;">
      <input placeholder="Descrição" id="descricaoTarefa">
      <button onclick="adicionarTarefa()">Salvar Tarefa</button>
    </div>
  `;
}

function configurarFinanceiro() {
  document.getElementById('conteudoPrincipal').innerHTML += `
    <div id="formFinanceiro" style="display: none;">
      <input placeholder="Descrição" id="descricaoFin">
      <input type="number" placeholder="Valor" id="valorFin">
      <button onclick="adicionarFinanceiro()">Salvar Gasto</button>
    </div>
  `;
}

// ===== FUNÇÃO: INICIAR COM A ABA PADRÃO =====
document.addEventListener('DOMContentLoaded', () => {
  const abaInicial = localStorage.getItem('aba') || 'aplicacao.html';
  carregarAba(abaInicial);
});
