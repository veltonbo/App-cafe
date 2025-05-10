// ====== EXPORTAR RELATÓRIO COMPLETO EM PDF ======
function exportarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 20;

  doc.setFontSize(16);
  doc.text("Relatório Geral - Manejo Café", 20, y);
  y += 10;

  doc.setFontSize(12);
  doc.text("Aplicações:", 20, y); y += 8;
  aplicacoes.forEach(a => {
    doc.text(`${a.data} - ${a.produto} (${a.dosagem}) - ${a.tipo} - ${a.setor}`, 20, y);
    y += 6; if (y > 270) { doc.addPage(); y = 20; }
  });

  y += 8;
  doc.text("Tarefas:", 20, y); y += 8;
  tarefas.concat(tarefasFeitas).forEach(t => {
    doc.text(`${t.data} - ${t.descricao} (${t.prioridade}) - ${t.setor}`, 20, y);
    y += 6; if (y > 270) { doc.addPage(); y = 20; }
  });

  y += 8;
  doc.text("Financeiro (pagos):", 20, y); y += 8;
  gastos.filter(g => g.pago).forEach(g => {
    doc.text(`${g.data} - ${g.produto} - R$ ${g.valor.toFixed(2)} (${g.tipo})`, 20, y);
    y += 6; if (y > 270) { doc.addPage(); y = 20; }
  });

  y += 8;
  doc.text("Colheita:", 20, y); y += 8;
  colheita.forEach(c => {
    doc.text(`${c.data} - ${c.colhedor} - ${c.quantidade.toFixed(2)} latas`, 20, y);
    y += 6; if (y > 270) { doc.addPage(); y = 20; }
  });

  const hoje = new Date().toISOString().split("T")[0];
  doc.save(`relatorio_manejo_cafe_${hoje}.pdf`);
}

// ====== EXPORTAR RELATÓRIO EM CSV ======
function exportarRelatorioCSV() {
  let csv = "Tipo,Data,Descrição,Setor,Valor\n";

  aplicacoes.forEach(a => {
    csv += `Aplicação,${a.data},"${a.produto} (${a.dosagem})",${a.setor},\n`;
  });

  tarefas.concat(tarefasFeitas).forEach(t => {
    csv += `Tarefa,${t.data},"${t.descricao} (${t.prioridade})",${t.setor},\n`;
  });

  gastos.filter(g => g.pago).forEach(g => {
    csv += `Financeiro,${g.data},"${g.produto}",,${g.valor.toFixed(2)}\n`;
  });

  colheita.forEach(c => {
    const total = (c.quantidade * c.valorLata).toFixed(2);
    csv += `Colheita,${c.data},${c.colhedor},,${total}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio_manejo_cafe_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
}

// ====== ATUALIZAÇÃO INICIAL DO RELATÓRIO ======
function atualizarRelatorioCompleto() {
  atualizarRelatorioAplicacoes();
  atualizarRelatorioTarefas();
  atualizarRelatorioFinanceiro();
  atualizarRelatorioColheita();
}

// Aguarda os dados carregarem antes de gerar o relatório
function aguardarDadosCarregados(callback) {
  let tentativas = 0;
  const checar = setInterval(() => {
    tentativas++;
    if (
      aplicacoes.length > 0 ||
      tarefas.length > 0 ||
      tarefasFeitas.length > 0 ||
      gastos.length > 0 ||
      colheita.length > 0
    ) {
      clearInterval(checar);
      callback();
    } else if (tentativas > 50) {
      clearInterval(checar);
      alert("Não foi possível carregar os dados do relatório.");
    }
  }, 200);
}

// Substitui clique no botão de relatório para aguardar os dados
document.getElementById("btn-relatorio").addEventListener("click", () => {
  mostrarAba("relatorio");
  aguardarDadosCarregados(gerarRelatorioCompleto);
});
