// js/relatorio.js - Versão Melhorada

// ====== VARIÁVEIS GLOBAIS ======
let relatorioAplicacoes = [];
let relatorioTarefas = [];
let relatorioFinanceiro = [];
let relatorioColheita = [];

// ====== ATUALIZAR RELATÓRIO COMPLETO ======
function atualizarRelatorioCompleto() {
  if (document.getElementById("resumoRelAplicacoes")) atualizarRelatorioAplicacoes();
  if (document.getElementById("resumoRelTarefas")) atualizarRelatorioTarefas();
  if (document.getElementById("resumoRelFinanceiro")) atualizarRelatorioFinanceiro();
  if (document.getElementById("resumoRelColheita")) atualizarRelatorioColheita();
}

// ====== RESUMO DE APLICAÇÕES ======
function atualizarRelatorioAplicacoes() {
  relatorioAplicacoes = window.aplicacoesCache || [];
  const el = document.getElementById("resumoRelAplicacoes");
  if (!el) return;
  if (relatorioAplicacoes.length === 0) {
    el.innerHTML = "Nenhuma aplicação registrada.";
    return;
  }
  el.innerHTML = `
    <div><strong>Total:</strong> ${relatorioAplicacoes.length}</div>
    <ul>
      ${relatorioAplicacoes.map(app =>
        `<li>${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}</li>`
      ).join('')}
    </ul>
  `;
}

// ====== RESUMO DE TAREFAS ======
function atualizarRelatorioTarefas() {
  relatorioTarefas = (window.tarefasCache || []);
  const el = document.getElementById("resumoRelTarefas");
  if (!el) return;
  if (relatorioTarefas.length === 0) {
    el.innerHTML = "Nenhuma tarefa registrada.";
    return;
  }
  el.innerHTML = `
    <div><strong>Total:</strong> ${relatorioTarefas.length}</div>
    <ul>
      ${relatorioTarefas.map(t =>
        `<li>${t.data} - ${t.descricao} (${t.prioridade}) - ${t.setor}</li>`
      ).join('')}
    </ul>
  `;
}

// ====== RESUMO DE FINANCEIRO ======
function atualizarRelatorioFinanceiro() {
  relatorioFinanceiro = window.financeiroCache || [];
  const el = document.getElementById("resumoRelFinanceiro");
  if (!el) return;
  if (relatorioFinanceiro.length === 0) {
    el.innerHTML = "Nenhum lançamento financeiro registrado.";
    return;
  }
  el.innerHTML = `
    <div><strong>Total:</strong> ${relatorioFinanceiro.length}</div>
    <ul>
      ${relatorioFinanceiro.map(g =>
        `<li>${g.data} - ${g.descricao} - R$ ${Number(g.valor).toFixed(2)} (${g.tipo})</li>`
      ).join('')}
    </ul>
  `;
}

// ====== RESUMO DE COLHEITA ======
function atualizarRelatorioColheita() {
  relatorioColheita = window.colheita || [];
  const el = document.getElementById("resumoRelColheita");
  if (!el) return;
  if (relatorioColheita.length === 0) {
    el.innerHTML = "Nenhum registro de colheita.";
    return;
  }
  el.innerHTML = `
    <div><strong>Total:</strong> ${relatorioColheita.length}</div>
    <ul>
      ${relatorioColheita.map(c =>
        `<li>${c.data} - ${c.colhedor} - ${Number(c.quantidade).toFixed(2)} latas</li>`
      ).join('')}
    </ul>
  `;
}

// ====== EXPORTAR RELATÓRIO COMPLETO EM PDF ======
function exportarPDF() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    mostrarToast("jsPDF não carregado!", "erro");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 20;

  doc.setFontSize(16);
  doc.text("Relatório Geral - Manejo Café", 20, y);
  y += 10;

  doc.setFontSize(12);
  y = adicionarTextoPDF(doc, "Aplicações:", relatorioAplicacoes.map(app =>
    `${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}`), y);
  y = adicionarTextoPDF(doc, "Tarefas:", relatorioTarefas.map(t =>
    `${t.data} - ${t.descricao} (${t.prioridade}) - ${t.setor}`), y);
  y = adicionarTextoPDF(doc, "Financeiro:", relatorioFinanceiro.map(g =>
    `${g.data} - ${g.descricao} - R$ ${Number(g.valor).toFixed(2)} (${g.tipo})`), y);
  y = adicionarTextoPDF(doc, "Colheita:", relatorioColheita.map(c =>
    `${c.data} - ${c.colhedor} - ${Number(c.quantidade).toFixed(2)} latas`), y);

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
  y += 4;
  return y;
}

// ====== EXPORTAR RELATÓRIO EM CSV ======
function exportarRelatorioCSV() {
  let csv = "Tipo,Data,Descrição,Setor,Valor\n";

  relatorioAplicacoes.forEach(a => {
    csv += `Aplicação,${a.data},"${a.produto} (${a.dosagem})",${a.setor},\n`;
  });

  relatorioTarefas.forEach(t => {
    csv += `Tarefa,${t.data},"${t.descricao} (${t.prioridade})",${t.setor},\n`;
  });

  relatorioFinanceiro.forEach(g => {
    csv += `Financeiro,${g.data},"${g.descricao}",,${Number(g.valor).toFixed(2)}\n`;
  });

  relatorioColheita.forEach(c => {
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

// ====== TOAST DE FEEDBACK ======
function mostrarToast(msg, tipo = 'info', tempo = 2500) {
  if (window.mostrarToast) {
    window.mostrarToast(msg, tipo, tempo);
    return;
  }
  // Fallback simples
  alert(msg);
}

// ====== INICIALIZAR RELATÓRIO ======
document.addEventListener("dadosCarregados", atualizarRelatorioCompleto);

// ====== BOTÕES DE EXPORTAÇÃO (adicione no HTML) ======
// <button onclick="exportarPDF()">Exportar PDF</button>
// <button onclick="exportarRelatorioCSV()">Exportar CSV</button>
