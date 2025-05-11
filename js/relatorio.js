// ===== GERAR RELATÓRIO EM PDF =====
async function exportarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("Relatório de Manejo Café", 10, 10);

  const aplicacoes = await carregarAplicacoesRelatorio();
  let y = 20;
  aplicacoes.forEach(app => {
    doc.text(`${app.data} - ${app.produto} - ${app.dosagem} - ${app.tipo}`, 10, y);
    y += 10;
  });

  doc.save("relatorio_manejo_cafe.pdf");
}

// ===== EXPORTAR RELATÓRIO EM CSV =====
async function exportarRelatorioCSV() {
  const aplicacoes = await carregarAplicacoesRelatorio();
  let csv = "Data,Produto,Dosagem,Tipo\n";
  aplicacoes.forEach(app => {
    csv += `${app.data},${app.produto},${app.dosagem},${app.tipo}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "relatorio_manejo_cafe.csv";
  a.click();
}

// ===== CARREGAR APLICAÇÕES PARA RELATÓRIO =====
function carregarAplicacoesRelatorio() {
  return firebase.database().ref('Aplicacoes').once('value').then(snapshot => {
    const aplicacoes = [];
    snapshot.forEach(snap => aplicacoes.push(snap.val()));
    return aplicacoes;
  });
}
