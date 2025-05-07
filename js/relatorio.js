// ===== GERAR RELATÓRIO =====
function gerarRelatorio() {
  const dataInicio = document.getElementById("dataInicioRel").value;
  const dataFim = document.getElementById("dataFimRel").value;
  const resultado = document.getElementById("resultadoRelatorio");
  resultado.innerHTML = "";

  if (!dataInicio || !dataFim) {
    alert("Selecione o período para o relatório.");
    return;
  }

  // Exemplo de dados combinados (Aplicações, Tarefas, Financeiro, Colheita)
  const relatorio = [...aplicacoes, ...tarefas, ...movimentos, ...colheitas]
    .filter(item => item.data >= dataInicio && item.data <= dataFim);

  if (relatorio.length === 0) {
    resultado.innerHTML = "<p>Nenhum dado encontrado para o período selecionado.</p>";
    return;
  }

  relatorio.forEach(item => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerText = `${item.data} - ${item.produto || item.descricao || item.quantidade || ''}`;
    resultado.appendChild(div);
  });
}

// ===== EXPORTAR RELATÓRIO COMO PDF =====
function exportarRelatorioPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("Relatório Manejo Café", 20, 20);

  let y = 40;
  document.querySelectorAll("#resultadoRelatorio .item").forEach((item) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(item.textContent, 20, y);
    y += 10;
  });

  doc.save("relatorio_manejo_cafe.pdf");
}

// ===== EXPORTAR RELATÓRIO COMO CSV =====
function exportarRelatorioCSV() {
  const linhas = ["Data,Descrição"];
  document.querySelectorAll("#resultadoRelatorio .item").forEach((item) => {
    linhas.push(item.textContent);
  });

  const csvContent = "data:text/csv;charset=utf-8," + linhas.join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "relatorio_manejo_cafe.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
