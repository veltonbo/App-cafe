// ===== VARIÁVEIS GLOBAIS =====
let relatorioAplicacoes = [];
let relatorioTarefas = [];
let relatorioFinanceiro = [];
let relatorioColheita = [];

// ===== CARREGAR RELATÓRIO =====
function carregarRelatorio() {
  atualizarRelatorioCompleto();
}

// ===== ATUALIZAR RELATÓRIO COMPLETO =====
function atualizarRelatorioCompleto() {
  atualizarRelatorioAplicacoes();
  atualizarRelatorioTarefas();
  atualizarRelatorioFinanceiro();
  atualizarRelatorioColheita();
}

// ===== FILTROS DO RELATÓRIO =====
function aplicarFiltrosRelatorio() {
  const dataInicio = document.getElementById("filtroDataInicio").value;
  const dataFim = document.getElementById("filtroDataFim").value;
  const tipo = document.getElementById("filtroTipo").value;

  atualizarRelatorioAplicacoes(dataInicio, dataFim, tipo);
  atualizarRelatorioFinanceiro(dataInicio, dataFim);
  atualizarRelatorioColheita(dataInicio, dataFim);
}

// ===== ATUALIZAR RELATÓRIO APLICAÇÕES =====
function atualizarRelatorioAplicacoes(dataInicio = "", dataFim = "", tipo = "") {
  relatorioAplicacoes = aplicacoes || [];

  const filtrado = relatorioAplicacoes.filter(app => {
    const data = new Date(app.data);
    return (!dataInicio || data >= new Date(dataInicio)) &&
           (!dataFim || data <= new Date(dataFim)) &&
           (!tipo || app.tipo === tipo);
  });

  document.getElementById("resumoRelAplicacoes").innerHTML = filtrado.length
    ? filtrado.map(app => `${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}`).join('<br>')
    : "Nenhuma aplicação registrada.";
}

// ===== ATUALIZAR RELATÓRIO FINANCEIRO =====
function atualizarRelatorioFinanceiro(dataInicio = "", dataFim = "") {
  relatorioFinanceiro = gastos || [];

  const filtrado = relatorioFinanceiro.filter(fin => {
    const data = new Date(fin.data);
    return (!dataInicio || data >= new Date(dataInicio)) &&
           (!dataFim || data <= new Date(dataFim));
  });

  document.getElementById("resumoRelFinanceiro").innerHTML = filtrado.length
    ? filtrado.map(g => `${g.data} - ${g.produto} - R$ ${g.valor.toFixed(2)} (${g.tipo})`).join('<br>')
    : "Nenhum lançamento financeiro registrado.";
}

// ===== ATUALIZAR RELATÓRIO COLHEITA =====
function atualizarRelatorioColheita(dataInicio = "", dataFim = "") {
  relatorioColheita = colheita || [];

  const filtrado = relatorioColheita.filter(c => {
    const data = new Date(c.data);
    return (!dataInicio || data >= new Date(dataInicio)) &&
           (!dataFim || data <= new Date(dataFim));
  });

  document.getElementById("resumoRelColheita").innerHTML = filtrado.length
    ? filtrado.map(c => `${c.data} - ${c.colhedor} - ${c.quantidade.toFixed(2)} latas`).join('<br>')
    : "Nenhum registro de colheita.";
}

// ===== EXPORTAR RELATÓRIO EM PDF =====
function exportarRelatorioPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Relatório Geral - Manejo Café", 20, 20);

  let y = 40;
  ["Aplicações", "Financeiro", "Colheita"].forEach((tipo) => {
    doc.text(tipo, 20, y);
    y += 10;
    document.getElementById(`resumoRel${tipo}`).innerText.split("\n").forEach(linha => {
      doc.text(linha, 20, y);
      y += 6;
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
    });
    y += 10;
  });

  doc.save(`relatorio_manejo_cafe_${new Date().toISOString().split("T")[0]}.pdf`);
}

// ===== EXPORTAR RELATÓRIO EM CSV =====
function exportarRelatorioCSV() {
  let csv = "Tipo,Data,Descrição,Valor\n";

  relatorioAplicacoes.forEach(app => {
    csv += `Aplicação,${app.data},"${app.produto} (${app.tipo})",,\n`;
  });

  relatorioFinanceiro.forEach(g => {
    csv += `Financeiro,${g.data},"${g.produto}",${g.valor.toFixed(2)}\n`;
  });

  relatorioColheita.forEach(c => {
    csv += `Colheita,${c.data},${c.colhedor},${c.quantidade} latas\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio_manejo_cafe_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
}

// ===== FEEDBACK VISUAL (SWEETALERT) =====
function mostrarSucesso(mensagem) {
  Swal.fire({
    icon: 'success',
    title: 'Sucesso!',
    text: mensagem,
    timer: 2000,
    showConfirmButton: false
  });
}

function mostrarErro(mensagem) {
  Swal.fire({
    icon: 'error',
    title: 'Erro!',
    text: mensagem,
    timer: 2000,
    showConfirmButton: false
  });
}

// ===== INICIALIZAR RELATÓRIO =====
document.addEventListener("dadosCarregados", carregarRelatorio);
