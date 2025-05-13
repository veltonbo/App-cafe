// ====== VARIÁVEIS GLOBAIS ======
let relatorioAplicacoes = [];
let relatorioTarefas = [];
let relatorioFinanceiro = [];
let relatorioColheita = [];

// ====== ATUALIZAR RELATÓRIO COMPLETO ======
function atualizarRelatorioCompleto() {
  atualizarRelatorioAplicacoes();
  atualizarRelatorioTarefas();
  atualizarRelatorioFinanceiro();
  atualizarRelatorioColheita();
}

// ====== ATUALIZAR RELATÓRIO COMPLETO ======
function atualizarRelatorioCompleto() {
  if (document.getElementById("resumoRelAplicacoes")) atualizarRelatorioAplicacoes();
  if (document.getElementById("resumoRelTarefas")) atualizarRelatorioTarefas();
  if (document.getElementById("resumoRelFinanceiro")) atualizarRelatorioFinanceiro();
  if (document.getElementById("resumoRelColheita")) atualizarRelatorioColheita();
}

// ====== ATUALIZAR RELATÓRIO APLICAÇÕES ======
function atualizarRelatorioAplicacoes() {
  relatorioAplicacoes = aplicacoes || [];
  document.getElementById("resumoRelAplicacoes").innerHTML = relatorioAplicacoes.length
    ? relatorioAplicacoes.map(app => `${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}`).join('<br>')
    : "Nenhuma aplicação registrada.";
}

// ====== ATUALIZAR RELATÓRIO TAREFAS ======
function atualizarRelatorioTarefas() {
  relatorioTarefas = (tarefas || []).concat(tarefasFeitas || []);
  document.getElementById("resumoRelTarefas").innerHTML = relatorioTarefas.length
    ? relatorioTarefas.map(t => `${t.data} - ${t.descricao} (${t.prioridade}) - ${t.setor}`).join('<br>')
    : "Nenhuma tarefa registrada.";
}

// ====== ATUALIZAR RELATÓRIO FINANCEIRO ======
function atualizarRelatorioFinanceiro() {
  relatorioFinanceiro = gastos || [];
  document.getElementById("resumoRelFinanceiro").innerHTML = relatorioFinanceiro.length
    ? relatorioFinanceiro.map(g => `${g.data} - ${g.produto} - R$ ${g.valor.toFixed(2)} (${g.tipo})`).join('<br>')
    : "Nenhum lançamento financeiro registrado.";
}

// ====== ATUALIZAR RELATÓRIO COLHEITA ======
function atualizarRelatorioColheita() {
  relatorioColheita = colheita || [];
  document.getElementById("resumoRelColheita").innerHTML = relatorioColheita.length
    ? relatorioColheita.map(c => `${c.data} - ${c.colhedor} - ${c.quantidade.toFixed(2)} latas`).join('<br>')
    : "Nenhum registro de colheita.";
}

// ====== EXPORTAR RELATÓRIO COMPLETO EM PDF ======
function exportarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 20;

  doc.setFontSize(16);
  doc.text("Relatório Geral - Manejo Café", 20, y);
  y += 10;

  doc.setFontSize(12);
  adicionarTextoPDF(doc, "Aplicações:", relatorioAplicacoes, y);
  adicionarTextoPDF(doc, "Tarefas:", relatorioTarefas, y);
  adicionarTextoPDF(doc, "Financeiro:", relatorioFinanceiro, y);
  adicionarTextoPDF(doc, "Colheita:", relatorioColheita, y);

  const hoje = new Date().toISOString().split("T")[0];
  doc.save(`relatorio_manejo_cafe_${hoje}.pdf`);
}

function adicionarTextoPDF(doc, titulo, dados, y) {
  doc.text(titulo, 20, y);
  y += 8;
  dados.forEach(dado => {
    doc.text(dado, 20, y);
    y += 6;
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  });
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

  gastos.forEach(g => {
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

// ====== INICIALIZAR RELATÓRIO ======
document.addEventListener("dadosCarregados", atualizarRelatorioCompleto);
