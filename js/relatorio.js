// ===== FUNÇÃO: GERAR RELATÓRIO COMPLETO =====
function gerarRelatorioCompleto() {
  gerarRelatorioAplicacoes();
  gerarRelatorioTarefas();
  gerarRelatorioFinanceiro();
  gerarRelatorioColheita();
}

// ===== FUNÇÃO: MOSTRAR SUB-RELATÓRIO =====
function mostrarRelatorio(relatorioId) {
  document.querySelectorAll('.relatorio-subaba').forEach(subaba => {
    subaba.style.display = 'none';
  });

  document.getElementById(relatorioId).style.display = 'block';
}

// ===== RELATÓRIO: APLICAÇÕES =====
function gerarRelatorioAplicacoes() {
  const resumo = document.getElementById("resumoRelAplicacoes");
  const ctx = document.getElementById("graficoRelAplicacoes").getContext("2d");
  resumo.textContent = "Total de Aplicações: " + aplicacoes.length;

  const produtos = aplicacoes.reduce((acc, app) => {
    acc[app.produto] = (acc[app.produto] || 0) + 1;
    return acc;
  }, {});

  new Chart(ctx, {
    type: "pie",
    data: {
      labels: Object.keys(produtos),
      datasets: [{
        data: Object.values(produtos),
        backgroundColor: ["#4caf50", "#2196f3", "#ff9800", "#f44336"]
      }]
    }
  });
}

// ===== RELATÓRIO: TAREFAS =====
function gerarRelatorioTarefas() {
  const resumo = document.getElementById("resumoRelTarefas");
  const ctx = document.getElementById("graficoRelTarefas").getContext("2d");
  resumo.textContent = "Total de Tarefas: " + (tarefas.length + tarefasFeitas.length);

  const status = {
    "A Fazer": tarefas.length,
    "Executadas": tarefasFeitas.length
  };

  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: Object.keys(status),
      datasets: [{
        data: Object.values(status),
        backgroundColor: ["#ff9800", "#4caf50"]
      }]
    }
  });
}

// ===== RELATÓRIO: FINANCEIRO =====
function gerarRelatorioFinanceiro() {
  const resumo = document.getElementById("resumoRelFinanceiro");
  const ctx = document.getElementById("graficoRelFinanceiro").getContext("2d");
  resumo.textContent = "Total de Lançamentos: " + (financeiro.length + financeiroPago.length);

  const valores = {
    "A Vencer": financeiro.length,
    "Pagos": financeiroPago.length
  };

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(valores),
      datasets: [{
        data: Object.values(valores),
        backgroundColor: ["#ff9800", "#4caf50"]
      }]
    }
  });
}

// ===== RELATÓRIO: COLHEITA =====
function gerarRelatorioColheita() {
  const resumo = document.getElementById("resumoRelColheita");
  const ctx = document.getElementById("graficoRelColheita").getContext("2d");
  resumo.textContent = "Total de Latas Colhidas: " + colheitas.reduce((acc, col) => acc + col.quantidade, 0);

  const colhedores = colheitas.reduce((acc, col) => {
    acc[col.colhedor] = (acc[col.colhedor] || 0) + col.quantidade;
    return acc;
  }, {});

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(colhedores),
      datasets: [{
        data: Object.values(colhedores),
        backgroundColor: "#66bb6a"
      }]
    }
  });
}
