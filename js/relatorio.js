// relatorio.js

document.addEventListener('DOMContentLoaded', () => {
  const graficosDiv = document.getElementById('relatorioGraficos');
  const btnExportarPDF = document.getElementById('btnExportarPDF');
  const btnExportarCSV = document.getElementById('btnExportarCSV');
  const periodoInicio = document.getElementById('periodoRelatorioInicio');
  const periodoFim = document.getElementById('periodoRelatorioFim');
  const btnFiltrarPeriodo = document.getElementById('btnFiltrarPeriodoRelatorio');

  let dadosFinanceiro = [];
  let dadosColheita = [];
  let chartFinanceiro = null;
  let chartColheita = null;

  // --- Carregar dados e gerar gráficos ---
  function carregarDados() {
    // Listeners em tempo real
    getRef('financeiro').on('value', snapFin => {
      dadosFinanceiro = [];
      snapFin.forEach(child => {
        const lanc = child.val();
        dadosFinanceiro.push(lanc);
      });
      atualizarRelatorio();
    });
    getRef('colheita').on('value', snapCol => {
      dadosColheita = [];
      snapCol.forEach(child => {
        const reg = child.val();
        dadosColheita.push(reg);
      });
      atualizarRelatorio();
    });
  }

  // --- Filtro de período ---
  function filtrarPorPeriodo(arr, campoData) {
    if (!periodoInicio || !periodoFim) return arr;
    const inicio = periodoInicio.value ? new Date(periodoInicio.value) : null;
    const fim = periodoFim.value ? new Date(periodoFim.value) : null;
    return arr.filter(item => {
      if (!item[campoData]) return false;
      const dataItem = new Date(item[campoData]);
      if (inicio && dataItem < inicio) return false;
      if (fim && dataItem > fim) return false;
      return true;
    });
  }

  // --- Atualizar relatório (gráficos e exportação) ---
  function atualizarRelatorio() {
    const dadosFinFiltrado = filtrarPorPeriodo(dadosFinanceiro, 'data');
    const dadosColFiltrado = filtrarPorPeriodo(dadosColheita, 'data');
    gerarGraficos(dadosFinFiltrado, dadosColFiltrado);
    // Salva para exportação
    btnExportarPDF.dadosFin = dadosFinFiltrado;
    btnExportarPDF.dadosCol = dadosColFiltrado;
    btnExportarCSV.dadosFin = dadosFinFiltrado;
    btnExportarCSV.dadosCol = dadosColFiltrado;
  }

  // --- Gerar gráficos com Chart.js ---
  function gerarGraficos(financeiro, colheita) {
    graficosDiv.innerHTML = `
      <div style="max-width:600px;margin:auto;">
        <canvas id="graficoFinanceiro"></canvas>
      </div>
      <div style="max-width:600px;margin:auto;">
        <canvas id="graficoColheita"></canvas>
      </div>
    `;

    // Gráfico Financeiro: Receitas e Gastos por mês
    const meses = Array.from({length: 12}, (_, i) => i + 1);
    const receitasPorMes = Array(12).fill(0);
    const gastosPorMes = Array(12).fill(0);

    financeiro.forEach(lanc => {
      if (!lanc.data) return;
      const mes = parseInt(lanc.data.split('-')[1], 10) - 1;
      if (mes >= 0 && mes < 12) {
        if (lanc.tipo === 'receita') receitasPorMes[mes] += Number(lanc.valor);
        else gastosPorMes[mes] += Number(lanc.valor);
      }
    });

    if (chartFinanceiro) chartFinanceiro.destroy();
    const ctxFin = document.getElementById('graficoFinanceiro').getContext('2d');
    chartFinanceiro = new Chart(ctxFin, {
      type: 'bar',
      data: {
        labels: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'],
        datasets: [
          { label: 'Receitas', data: receitasPorMes, backgroundColor: '#4caf50' },
          { label: 'Gastos', data: gastosPorMes, backgroundColor: '#f44336' }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'top' }, title: { display: true, text: 'Receitas e Gastos por Mês' } }
      }
    });

    // Gráfico Colheita: Latas por mês
    const latasPorMes = Array(12).fill(0);
    colheita.forEach(reg => {
      if (!reg.data) return;
      const mes = parseInt(reg.data.split('-')[1], 10) - 1;
      if (mes >= 0 && mes < 12) {
        latasPorMes[mes] += Number(reg.quantidadeLatas);
      }
    });

    if (chartColheita) chartColheita.destroy();
    const ctxCol = document.getElementById('graficoColheita').getContext('2d');
    chartColheita = new Chart(ctxCol, {
      type: 'line',
      data: {
        labels: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'],
        datasets: [
          { label: 'Latas Colhidas', data: latasPorMes, borderColor: '#2196f3', backgroundColor: 'rgba(33,150,243,0.2)', fill: true }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'top' }, title: { display: true, text: 'Colheita por Mês' } }
      }
    });
  }

  // --- Exportar PDF ---
  btnExportarPDF.addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.text('Relatório Financeiro', 14, 16);
    const finRows = (btnExportarPDF.dadosFin || []).map(lanc => [
      lanc.data, lanc.tipo === 'receita' ? 'Receita' : 'Gasto', lanc.descricao, lanc.categoria || '-', Number(lanc.valor).toLocaleString('pt-BR', {minimumFractionDigits:2})
    ]);
    doc.autoTable({
      head: [['Data', 'Tipo', 'Descrição', 'Categoria', 'Valor (R$)']],
      body: finRows,
      startY: 20,
      theme: 'striped'
    });

    let y = doc.lastAutoTable.finalY + 10;
    doc.text('Relatório de Colheita', 14, y);
    const colRows = (btnExportarPDF.dadosCol || []).map(reg => [
      reg.data, reg.colhedor, reg.quantidadeLatas, reg.pago ? 'Pago' : 'Pendente'
    ]);
    doc.autoTable({
      head: [['Data', 'Colhedor', 'Latas', 'Status']],
      body: colRows,
      startY: y + 4,
      theme: 'striped'
    });

    doc.save('relatorio-manejo-cafe.pdf');
    mostrarToast('PDF exportado!', 'sucesso');
  });

  // --- Exportar CSV ---
  btnExportarCSV.addEventListener('click', () => {
    let csv = 'Data,Tipo,Descrição,Categoria,Valor (R$)\n';
    (btnExportarCSV.dadosFin || []).forEach(lanc => {
      csv += `"${lanc.data}","${lanc.tipo === 'receita' ? 'Receita' : 'Gasto'}","${lanc.descricao}","${lanc.categoria || '-'}","${Number(lanc.valor).toLocaleString('pt-BR', {minimumFractionDigits:2})}"\n`;
    });
    csv += '\nData,Colhedor,Latas,Status\n';
    (btnExportarCSV.dadosCol || []).forEach(reg => {
      csv += `"${reg.data}","${reg.colhedor}","${reg.quantidadeLatas}","${reg.pago ? 'Pago' : 'Pendente'}"\n`;
    });

    const blob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'relatorio-manejo-cafe.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    mostrarToast('CSV exportado!', 'sucesso');
  });

  // --- Filtro de período (opcional, adicione ao HTML) ---
  if (btnFiltrarPeriodo && periodoInicio && periodoFim) {
    btnFiltrarPeriodo.addEventListener('click', atualizarRelatorio);
  }

  // Inicialização
  carregarDados();
});
