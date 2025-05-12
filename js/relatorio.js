// ===== IMPORTAÇÕES =====
import { db } from './firebase-config.js';
import { loadDataOffline } from './offline-db.js';

// ===== VARIÁVEIS GLOBAIS =====
let relatorioAplicacoes = [];
let relatorioTarefas = [];
let relatorioFinanceiro = [];
let relatorioColheita = [];

// ===== ATUALIZAR RELATÓRIO COMPLETO =====
async function atualizarRelatorioCompleto() {
  try {
    // Carregar dados
    await Promise.all([
      atualizarRelatorioAplicacoes(),
      atualizarRelatorioTarefas(),
      atualizarRelatorioFinanceiro(),
      atualizarRelatorioColheita()
    ]);

    // Gerar gráficos se estiver na aba de relatório
    if (document.getElementById('relatorio').style.display === 'block') {
      gerarGraficos();
    }
  } catch (error) {
    console.error('Erro ao atualizar relatório:', error);
    mostrarNotificacao('Erro ao atualizar relatório', 'error');
  }
}

// ===== ATUALIZAR RELATÓRIO APLICAÇÕES =====
async function atualizarRelatorioAplicacoes() {
  try {
    if (navigator.onLine) {
      const snapshot = await db.ref('Aplicacoes').once('value');
      relatorioAplicacoes = snapshot.val() || [];
    } else {
      relatorioAplicacoes = await loadDataOffline('aplicacoes') || [];
    }

    const resumo = document.getElementById("resumoRelAplicacoes");
    if (resumo) {
      resumo.innerHTML = relatorioAplicacoes.length
        ? relatorioAplicacoes.map(app => 
            `${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}`
          ).join('<br>')
        : "Nenhuma aplicação registrada.";
    }
  } catch (error) {
    console.error('Erro ao carregar aplicações para relatório:', error);
    throw error;
  }
}

// ===== ATUALIZAR RELATÓRIO TAREFAS =====
async function atualizarRelatorioTarefas() {
  try {
    if (navigator.onLine) {
      const snapshot = await db.ref('Tarefas').once('value');
      relatorioTarefas = snapshot.val() || [];
    } else {
      relatorioTarefas = await loadDataOffline('tarefas') || [];
    }

    const resumo = document.getElementById("resumoRelTarefas");
    if (resumo) {
      resumo.innerHTML = relatorioTarefas.length
        ? relatorioTarefas.map(t => 
            `${t.data} - ${t.descricao} (${t.prioridade}) - ${t.setor} ${t.feita ? '- CONCLUÍDA' : ''}`
          ).join('<br>')
        : "Nenhuma tarefa registrada.";
    }
  } catch (error) {
    console.error('Erro ao carregar tarefas para relatório:', error);
    throw error;
  }
}

// ===== ATUALIZAR RELATÓRIO FINANCEIRO =====
async function atualizarRelatorioFinanceiro() {
  try {
    if (navigator.onLine) {
      const snapshot = await db.ref('Financeiro').once('value');
      relatorioFinanceiro = snapshot.val() || [];
    } else {
      relatorioFinanceiro = await loadDataOffline('financeiro') || [];
    }

    const resumo = document.getElementById("resumoRelFinanceiro");
    if (resumo) {
      resumo.innerHTML = relatorioFinanceiro.length
        ? relatorioFinanceiro.map(g => 
            `${g.data} - ${g.produto} - R$ ${g.valor.toFixed(2)} (${g.tipo}) ${g.parcelado ? `(${g.parcelas}x)` : ''}`
          ).join('<br>')
        : "Nenhum lançamento financeiro registrado.";
    }
  } catch (error) {
    console.error('Erro ao carregar financeiro para relatório:', error);
    throw error;
  }
}

// ===== ATUALIZAR RELATÓRIO COLHEITA =====
async function atualizarRelatorioColheita() {
  try {
    if (navigator.onLine) {
      const snapshot = await db.ref('Colheita').once('value');
      relatorioColheita = snapshot.val() || [];
    } else {
      relatorioColheita = await loadDataOffline('colheita') || [];
    }

    const resumo = document.getElementById("resumoRelColheita");
    if (resumo) {
      resumo.innerHTML = relatorioColheita.length
        ? relatorioColheita.map(c => 
            `${c.data} - ${c.colhedor} - ${c.quantidade.toFixed(2)} latas (R$ ${(c.quantidade * (c.valorLata || valorLataGlobal)).toFixed(2)}) ${c.pago ? '- PAGO' : '- PENDENTE'}`
          ).join('<br>')
        : "Nenhum registro de colheita.";
    }
  } catch (error) {
    console.error('Erro ao carregar colheita para relatório:', error);
    throw error;
  }
}

// ===== GERAR GRÁFICOS =====
function gerarGraficos() {
  gerarGraficoAplicacoes();
  gerarGraficoFinanceiro();
  gerarGraficoColheita();
}

// ===== GERAR GRÁFICO APLICAÇÕES =====
function gerarGraficoAplicacoes() {
  const ctx = document.getElementById('graficoAplicacoes')?.getContext('2d');
  if (!ctx) return;

  // Destruir gráfico anterior se existir
  if (window.graficoAplicacoes) {
    window.graficoAplicacoes.destroy();
  }

  const tipos = [...new Set(relatorioAplicacoes.map(a => a.tipo))];
  const dados = tipos.map(tipo => 
    relatorioAplicacoes.filter(a => a.tipo === tipo).length
  );

  window.graficoAplicacoes = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: tipos,
      datasets: [{
        data: dados,
        backgroundColor: [
          '#4CAF50', '#2196F3', '#FFC107', '#FF5722', '#9C27B0',
          '#00BCD4', '#673AB7', '#E91E63', '#8BC34A', '#3F51B5'
        ]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Distribuição de Aplicações por Tipo'
        }
      }
    }
  });
}

// ===== GERAR GRÁFICO FINANCEIRO =====
function gerarGraficoFinanceiro() {
  const ctx = document.getElementById('graficoFinanceiro')?.getContext('2d');
  if (!ctx) return;

  // Destruir gráfico anterior se existir
  if (window.graficoFinanceiro) {
    window.graficoFinanceiro.destroy();
  }

  const meses = [...Array(12).keys()].map(i => {
    const date = new Date();
    date.setMonth(i);
    return date.toLocaleString('default', { month: 'short' });
  });

  const dados = meses.map((_, i) => {
    return relatorioFinanceiro
      .filter(g => new Date(g.data).getMonth() === i)
      .reduce((sum, g) => sum + g.valor, 0);
  });

  window.graficoFinanceiro = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: meses,
      datasets: [{
        label: 'Gastos por Mês (R$)',
        data: dados,
        backgroundColor: '#4CAF50'
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return 'R$ ' + value.toLocaleString('pt-BR');
            }
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              return 'R$ ' + context.raw.toLocaleString('pt-BR');
            }
          }
        }
      }
    }
  });
}

// ===== GERAR GRÁFICO COLHEITA =====
function gerarGraficoColheita() {
  const ctx = document.getElementById('graficoColheita')?.getContext('2d');
  if (!ctx) return;

  // Destruir gráfico anterior se existir
  if (window.graficoColheita) {
    window.graficoColheita.destroy();
  }

  const colhedores = [...new Set(relatorioColheita.map(c => c.colhedor))];
  const dados = colhedores.map(colhedor =>
    relatorioColheita
      .filter(c => c.colhedor === colhedor)
      .reduce((sum, c) => sum + c.quantidade, 0)
  );

  window.graficoColheita = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: colhedores,
      datasets: [{
        data: dados,
        backgroundColor: colhedores.map((_, i) => 
          `hsl(${(i * 360 / colhedores.length)}, 70%, 50%)`
        )
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Colheita por Colhedor'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.label}: ${context.raw.toFixed(2)} latas`;
            }
          }
        }
      }
    }
  });
}

// ===== EXPORTAR RELATÓRIO COMPLETO EM PDF =====
function exportarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 20;

  // Configurações do PDF
  doc.setProperties({
    title: 'Relatório Manejo Café',
    subject: 'Relatório completo do sistema Manejo Café',
    author: 'Sistema Manejo Café',
    keywords: 'relatório, manejo, café',
    creator: 'Sistema Manejo Café'
  });

  // Cabeçalho
  doc.setFontSize(16);
  doc.setTextColor(40, 167, 69); // Verde
  doc.text("Relatório Geral - Manejo Café", 105, y, { align: 'center' });
  y += 10;

  const hoje = new Date();
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${hoje.toLocaleDateString()} às ${hoje.toLocaleTimeString()}`, 105, y, { align: 'center' });
  y += 15;

  // Seção de Aplicações
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text("Aplicações:", 20, y);
  y += 8;

  if (relatorioAplicacoes.length > 0) {
    doc.setFontSize(10);
    relatorioAplicacoes.forEach(app => {
      const text = `${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}`;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(text, 20, y);
      y += 6;
    });
  } else {
    doc.text("Nenhuma aplicação registrada.", 20, y);
    y += 6;
  }

  y += 10;

  // Seção de Tarefas
  doc.setFontSize(12);
  doc.text("Tarefas:", 20, y);
  y += 8;

  if (relatorioTarefas.length > 0) {
    doc.setFontSize(10);
    relatorioTarefas.forEach(t => {
      const text = `${t.data} - ${t.descricao} (${t.prioridade}) - ${t.setor} ${t.feita ? '- CONCLUÍDA' : ''}`;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(text, 20, y);
      y += 6;
    });
  } else {
    doc.text("Nenhuma tarefa registrada.", 20, y);
    y += 6;
  }

  y += 10;

  // Seção Financeira
  doc.setFontSize(12);
  doc.text("Financeiro:", 20, y);
  y += 8;

  if (relatorioFinanceiro.length > 0) {
    doc.setFontSize(10);
    relatorioFinanceiro.forEach(g => {
      const text = `${g.data} - ${g.produto} - R$ ${g.valor.toFixed(2)} (${g.tipo}) ${g.parcelado ? `(${g.parcelas}x)` : ''}`;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(text, 20, y);
      y += 6;
    });

    // Total gasto
    const totalGasto = relatorioFinanceiro.reduce((sum, g) => sum + g.valor, 0);
    y += 6;
    doc.setFontSize(12);
    doc.text(`Total Gasto: R$ ${totalGasto.toFixed(2)}`, 20, y);
    y += 8;
  } else {
    doc.text("Nenhum lançamento financeiro registrado.", 20, y);
    y += 6;
  }

  y += 10;

  // Seção de Colheita
  doc.setFontSize(12);
  doc.text("Colheita:", 20, y);
  y += 8;

  if (relatorioColheita.length > 0) {
    doc.setFontSize(10);
    relatorioColheita.forEach(c => {
      const text = `${c.data} - ${c.colhedor} - ${c.quantidade.toFixed(2)} latas (R$ ${(c.quantidade * (c.valorLata || valorLataGlobal)).toFixed(2)}) ${c.pago ? '- PAGO' : '- PENDENTE'}`;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(text, 20, y);
      y += 6;
    });

    // Totais
    const totalLatas = relatorioColheita.reduce((soma, c) => soma + c.quantidade, 0);
    const totalPago = relatorioColheita.reduce((soma, c) => soma + ((c.pagoParcial || 0) * (c.valorLata || valorLataGlobal)), 0);
    const totalPendente = relatorioColheita.reduce((soma, c) => soma + ((c.quantidade - (c.pagoParcial || 0)) * (c.valorLata || valorLataGlobal)), 0);

    y += 6;
    doc.setFontSize(12);
    doc.text(`Total de Latas: ${totalLatas.toFixed(2)}`, 20, y);
    y += 6;
    doc.text(`Total Pago: R$ ${totalPago.toFixed(2)}`, 20, y);
    y += 6;
    doc.text(`Total Pendente: R$ ${totalPendente.toFixed(2)}`, 20, y);
    y += 6;
    doc.text(`Valor da Lata Atual: R$ ${valorLataGlobal.toFixed(2)}`, 20, y);
    y += 8;
  } else {
    doc.text("Nenhum registro de colheita.", 20, y);
    y += 6;
  }

  // Rodapé
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text("Sistema Manejo Café - Relatório gerado automaticamente", 105, 285, { align: 'center' });

  // Salvar PDF
  doc.save(`relatorio_manejo_cafe_${hoje.toISOString().split("T")[0]}.pdf`);
}

// ===== EXPORTAR RELATÓRIO EM CSV =====
function exportarRelatorioCSV() {
  let csv = "Tipo,Data,Descrição,Detalhes,Valor,Status\n";

  // Aplicações
  relatorioAplicacoes.forEach(a => {
    csv += `Aplicação,${a.data},"${a.produto}","${a.tipo} - ${a.dosagem} - ${a.setor}",,\n`;
  });

  // Tarefas
  relatorioTarefas.forEach(t => {
    csv += `Tarefa,${t.data},"${t.descricao}","${t.prioridade} - ${t.setor}",,${t.feita ? 'Concluída' : 'Pendente'}\n`;
  });

  // Financeiro
  relatorioFinanceiro.forEach(g => {
    csv += `Financeiro,${g.data},"${g.produto}","${g.tipo} ${g.parcelado ? `(${g.parcelas}x)` : ''}",${g.valor.toFixed(2)},\n`;
  });

  // Colheita
  relatorioColheita.forEach(c => {
    const total = (c.quantidade * (c.valorLata || valorLataGlobal)).toFixed(2);
    csv += `Colheita,${c.data},"${c.colhedor}",${c.quantidade.toFixed(2)} latas,${total},${c.pago ? 'Pago' : 'Pendente'}\n`;
  });

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio_manejo_cafe_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
}

// ===== INICIALIZAR RELATÓRIO =====
document.addEventListener("dadosCarregados", atualizarRelatorioCompleto);
document.addEventListener("abaRelatorioAberta", atualizarRelatorioCompleto);

// Exportar funções para uso no HTML
window.exportarPDF = exportarPDF;
window.exportarRelatorioCSV = exportarRelatorioCSV;
