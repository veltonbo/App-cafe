const database = window.firebaseDB;
const { ref, onValue, set, push, remove, update } = window.firebaseModules;

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

  function getCurrentUser() {
    return localStorage.getItem("gm_cafe_current_user");
  }

  function carregarDados() {
    const user = getCurrentUser();
    if (!user) return;

    db.ref(`usuarios/${user}/financeiro`).on('value', snapFin => {
      dadosFinanceiro = [];
      snapFin.forEach(child => {
        const lanc = child.val();
        dadosFinanceiro.push(lanc);
      });
      atualizarRelatorio();
    });

    db.ref(`usuarios/${user}/colheita`).on('value', snapCol => {
      dadosColheita = [];
      snapCol.forEach(child => {
        const reg = child.val();
        dadosColheita.push(reg);
      });
      atualizarRelatorio();
    });
  }

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

  function atualizarRelatorio() {
    const dadosFinFiltrado = filtrarPorPeriodo(dadosFinanceiro, 'data');
    const dadosColFiltrado = filtrarPorPeriodo(dadosColheita, 'data');
    gerarGraficos(dadosFinFiltrado, dadosColFiltrado);
    if (btnExportarPDF) {
      btnExportarPDF.dadosFin = dadosFinFiltrado;
      btnExportarPDF.dadosCol = dadosColFiltrado;
    }
    if (btnExportarCSV) {
      btnExportarCSV.dadosFin = dadosFinFiltrado;
      btnExportarCSV.dadosCol = dadosColFiltrado;
    }
  }

  function gerarGraficos(financeiro, colheita) {
    if (!graficosDiv) return;

    graficosDiv.innerHTML = `
      <div style="max-width:600px;margin:auto;">
        <canvas id="graficoFinanceiro"></canvas>
      </div>
      <div style="max-width:600px;margin:auto;">
        <canvas id="graficoColheita"></canvas>
      </div>
    `;

    const meses = Array.from({ length: 12 }, (_, i) => i);
    const receitasPorMes = Array(12).fill(0);
    const gastosPorMes = Array(12).fill(0);

    financeiro.forEach(lanc => {
      if (!lanc.data) return;
      const mes = parseInt(lanc.data.split('-')[1], 10) - 1;
      if (mes >= 0 && mes < 12) {
        if (lanc.tipo === 'receita' || lanc.tipo === 'entrada') receitasPorMes[mes] += Number(lanc.valor);
        else gastosPorMes[mes] += Number(lanc.valor);
      }
    });

    if (chartFinanceiro) chartFinanceiro.destroy();
    const ctxFin = document.getElementById('graficoFinanceiro')?.getContext('2d');
    if (ctxFin) {
      chartFinanceiro = new Chart(ctxFin, {
        type: 'bar',
        data: {
          labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
          datasets: [
            { label: 'Receitas', data: receitasPorMes, backgroundColor: '#4caf50' },
            { label: 'Gastos', data: gastosPorMes, backgroundColor: '#f44336' }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'Receitas e Gastos por Mês' }
          }
        }
      });
    }

    const latasPorMes = Array(12).fill(0);
    colheita.forEach(reg => {
      if (!reg.data) return;
      const mes = parseInt(reg.data.split('-')[1], 10) - 1;
      if (mes >= 0 && mes < 12) {
        latasPorMes[mes] += Number(reg.quantidadeLatas || reg.quantidade || 0);
      }
    });

    if (chartColheita) chartColheita.destroy();
    const ctxCol = document.getElementById('graficoColheita')?.getContext('2d');
    if (ctxCol) {
      chartColheita = new Chart(ctxCol, {
        type: 'line',
        data: {
          labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
          datasets: [
            {
              label: 'Latas Colhidas',
              data: latasPorMes,
              borderColor: '#2196f3',
              backgroundColor: 'rgba(33,150,243,0.2)',
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'Colheita por Mês' }
          }
        }
      });
    }
  }

  if (btnExportarPDF) {
    btnExportarPDF.addEventListener('click', () => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      doc.text('Relatório Financeiro', 14, 16);
      const finRows = (btnExportarPDF.dadosFin || []).map(lanc => [
        lanc.data,
        lanc.tipo,
        lanc.descricao || lanc.desc || '',
        lanc.categoria || '-',
        Number(lanc.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
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
        reg.data,
        reg.colhedor || '-',
        reg.quantidadeLatas || reg.quantidade || 0,
        reg.pago ? 'Pago' : 'Pendente'
      ]);
      doc.autoTable({
        head: [['Data', 'Colhedor', 'Latas', 'Status']],
        body: colRows,
        startY: y + 4,
        theme: 'striped'
      });

      doc.save('relatorio-manejo-cafe.pdf');
    });
  }

  if (btnExportarCSV) {
    btnExportarCSV.addEventListener('click', () => {
      let csv = 'Data,Tipo,Descrição,Categoria,Valor (R$)\n';
      (btnExportarCSV.dadosFin || []).forEach(lanc => {
        csv += `"${lanc.data}","${lanc.tipo}","${lanc.descricao || lanc.desc || ''}","${lanc.categoria || '-'}","${Number(lanc.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}"\n`;
      });
      csv += '\nData,Colhedor,Latas,Status\n';
      (btnExportarCSV.dadosCol || []).forEach(reg => {
        csv += `"${reg.data}","${reg.colhedor || '-'}","${reg.quantidadeLatas || reg.quantidade || 0}","${reg.pago ? 'Pago' : 'Pendente'}"\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'relatorio-manejo-cafe.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  }

  if (btnFiltrarPeriodo && periodoInicio && periodoFim) {
    btnFiltrarPeriodo.addEventListener('click', atualizarRelatorio);
  }

  carregarDados();
});