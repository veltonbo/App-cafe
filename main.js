// ====== APLICAR PADRÃO DE EXIBIÇÃO DE BOTÕES DE EXPORTAÇÃO ======
document.addEventListener("DOMContentLoaded", () => {
  verificarBotoesExportacao();
});

// ====== FUNÇÃO PARA VERIFICAR OS BOTÕES DE EXPORTAÇÃO ======
function verificarBotoesExportacao() {
  verificarExportacaoAplicacoes();
  verificarExportacaoTarefas();
  verificarExportacaoFinanceiro();
  verificarExportacaoRelatorio();
}

// ====== VERIFICAR BOTÕES DE EXPORTAÇÃO (APLICAÇÕES) ======
function verificarExportacaoAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  const btnExportarCSV = document.querySelector("#aplicacoes .botao-exportar.csv");

  if (lista.children.length > 0) {
    btnExportarCSV.style.display = "inline-flex";
  } else {
    btnExportarCSV.style.display = "none";
  }
}

// ====== VERIFICAR BOTÕES DE EXPORTAÇÃO (TAREFAS) ======
function verificarExportacaoTarefas() {
  const lista = document.getElementById("listaTarefas");
  const btnExportarCSV = document.querySelector("#tarefas .botao-exportar.csv");

  if (lista.children.length > 0) {
    btnExportarCSV.style.display = "inline-flex";
  } else {
    btnExportarCSV.style.display = "none";
  }
}

// ====== VERIFICAR BOTÕES DE EXPORTAÇÃO (FINANCEIRO) ======
function verificarExportacaoFinanceiro() {
  const lista = document.getElementById("listaFinanceiro");
  const btnExportarCSV = document.querySelector("#financeiro .botao-exportar.csv");
  const btnExportarPDF = document.querySelector("#financeiro .botao-exportar.pdf");

  if (lista.children.length > 0) {
    btnExportarCSV.style.display = "inline-flex";
    btnExportarPDF.style.display = "inline-flex";
  } else {
    btnExportarCSV.style.display = "none";
    btnExportarPDF.style.display = "none";
  }
}

// ====== VERIFICAR BOTÕES DE EXPORTAÇÃO (RELATÓRIO) ======
function verificarExportacaoRelatorio() {
  const relatorio = document.getElementById("conteudoRelatorio");
  const btnExportarCSV = document.querySelector("#relatorio .botao-exportar.csv");
  const btnExportarPDF = document.querySelector("#relatorio .botao-exportar.pdf");

  if (relatorio.innerHTML.trim().length > 0) {
    btnExportarCSV.style.display = "inline-flex";
    btnExportarPDF.style.display = "inline-flex";
  } else {
    btnExportarCSV.style.display = "none";
    btnExportarPDF.style.display = "none";
  }
}

// ====== CHAMAR A VERIFICAÇÃO QUANDO OS DADOS FOREM ATUALIZADOS ======
function atualizarAplicacoes() {
  // Sua lógica para atualizar a lista de aplicações
  verificarExportacaoAplicacoes();
}

function atualizarTarefas() {
  // Sua lógica para atualizar a lista de tarefas
  verificarExportacaoTarefas();
}

function atualizarFinanceiro() {
  // Sua lógica para atualizar a lista de financeiro
  verificarExportacaoFinanceiro();
}

function gerarRelatorio() {
  // Sua lógica para gerar o relatório
  verificarExportacaoRelatorio();
}
