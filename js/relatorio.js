// relatorio.js - versão atualizada
// ====== GERAR GRÁFICOS ======
function gerarGraficos() {
  gerarGraficoAplicacoes();
  gerarGraficoFinanceiro();
  gerarGraficoColheita();
}

function gerarGraficoAplicacoes() {
  const ctx = document.getElementById('graficoAplicacoes').getContext('2d');
  const tipos = [...new Set(relatorioAplicacoes.map(a => a.tipo))];
  const dados = tipos.map(tipo => 
    relatorioAplicacoes.filter(a => a.tipo === tipo).length
  );

  new Chart(ctx, {
    type: 'pie',
    data: {
      labels: tipos,
      datasets: [{
        data: dados,
        backgroundColor: [
          '#4CAF50', '#2196F3', '#FFC107', '#FF5722', '#9C27B0'
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

function gerarGraficoFinanceiro() {
  const ctx = document.getElementById('graficoFinanceiro').getContext('2d');
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

  new Chart(ctx, {
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
          beginAtZero: true
        }
      }
    }
  });
}

function gerarGraficoColheita() {
  const ctx = document.getElementById('graficoColheita').getContext('2d');
  const colhedores = [...new Set(relatorioColheita.map(c => c.colhedor))];
  const dados = colhedores.map(colhedor =>
    relatorioColheita
      .filter(c => c.colhedor === colhedor)
      .reduce((sum, c) => sum + c.quantidade, 0)
  );

  new Chart(ctx, {
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
        }
      }
    }
  });
}

// Atualizar função atualizarRelatorioCompleto
function atualizarRelatorioCompleto() {
  if (document.getElementById("resumoRelAplicacoes")) atualizarRelatorioAplicacoes();
  if (document.getElementById("resumoRelTarefas")) atualizarRelatorioTarefas();
  if (document.getElementById("resumoRelFinanceiro")) atualizarRelatorioFinanceiro();
  if (document.getElementById("resumoRelColheita")) atualizarRelatorioColheita();
  
  // Gerar gráficos se a aba de relatório estiver visível
  if (document.getElementById('relatorio').style.display === 'block') {
    gerarGraficos();
  }
}
