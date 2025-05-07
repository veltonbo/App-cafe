// ===== INICIALIZAR RELATÓRIO =====
function inicializarRelatorio() {
  document.getElementById("relatorioGerado").innerHTML = "<p>Nenhum relatório gerado.</p>";
}

// ===== GERAR RELATÓRIO =====
function gerarRelatorio() {
  const dataInicio = dataInicioRelatorio.value;
  const dataFim = dataFimRelatorio.value;

  if (!dataInicio || !dataFim) {
    alert("Selecione o intervalo de datas.");
    return;
  }

  const relatorio = [
    { data: "2025-05-01", descricao: "Aplicação de Fertilizante", valor: 150.00 },
    { data: "2025-05-03", descricao: "Colheita - Café 1", valor: 1200.00 },
    { data: "2025-05-05", descricao: "Venda de Café", valor: 3000.00 }
  ];

  const filtrado = relatorio.filter(item => item.data >= dataInicio && item.data <= dataFim);
  exibirRelatorio(filtrado);
}

// ===== EXIBIR RELATÓRIO GERADO =====
function exibirRelatorio(dados) {
  const container = document.getElementById("relatorioGerado");
  container.innerHTML = "";

  if (dados.length === 0) {
    container.innerHTML = "<p>Nenhum dado encontrado.</p>";
    return;
  }

  dados.forEach(item => {
    const div = document.createElement("div");
    div.className = "item-relatorio";
    div.innerHTML = `
      <strong>${item.data}</strong> - ${item.descricao} - R$ ${item.valor.toFixed(2)}
    `;
    container.appendChild(div);
  });
}

// ===== EXPORTAR RELATÓRIO COMO CSV =====
function exportarRelatorioCSV() {
  const dados = document.querySelectorAll(".item-relatorio");
  if (!dados.length) {
    alert("Nenhum dado para exportar.");
    return;
  }

  let csv = "Data,Descrição,Valor\n";
  dados.forEach(item => {
    const texto = item.textContent.split(" - ");
    csv += `${texto[0]},${texto[1]},${texto[2].replace("R$ ", "")}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "relatorio_financeiro.csv";
  link.click();
}

// ===== EXPORTAR RELATÓRIO COMO PDF =====
function exportarRelatorioPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("Relatório Financeiro", 20, 20);
  let y = 40;

  const dados = document.querySelectorAll(".item-relatorio");
  if (!dados.length) {
    alert("Nenhum dado para exportar.");
    return;
  }

  dados.forEach(item => {
    doc.text(item.textContent, 20, y);
    y += 10;
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  });

  doc.save("relatorio_financeiro.pdf");
}
