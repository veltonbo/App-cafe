// ===== INICIALIZAR A TELA DE INÍCIO =====
// (Removido código antigo que acessava elementos não existentes)

// ===== ATUALIZAR RESUMO DA TELA DE INÍCIO =====
// (Função de dashboard já está implementada no novo padrão)
function atualizarResumoInicio() {
  // ===== TAREFAS DO DIA =====
  const listaTarefasDia = document.getElementById('listaTarefasDia');
  if (listaTarefasDia) {
    const hoje = new Date();
    const dataHoje = hoje.toISOString().slice(0, 10);
    let tarefas = window.tarefas || [];
    const tarefasHoje = tarefas.filter(t => t.data === dataHoje && !t.feita);
    listaTarefasDia.innerHTML = tarefasHoje.length
      ? tarefasHoje.map(t => `<li>${t.descricao} <span style='color:#aaa;font-size:0.95em;'>(${t.prioridade}, ${t.setor})</span></li>`).join('')
      : '<li style="color:#888;">Nenhuma tarefa para hoje.</li>';
  }

  // ===== TOTAL A PAGAR DO DIA =====
  const totalAPagarDiaEl = document.getElementById('totalAPagarDia');
  if (totalAPagarDiaEl) {
    const hoje = new Date();
    const dataHoje = hoje.toISOString().slice(0, 10);
    let gastos = window.gastos || [];
    const aPagarHoje = gastos.filter(g => g.data === dataHoje && !g.pago && !(g.descricao && g.descricao.toLowerCase().includes('pago')));
    const total = aPagarHoje.reduce((s,v) => s+(v.valor||0),0);
    totalAPagarDiaEl.textContent = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // ===== GRÁFICO DE GASTOS POR CATEGORIA =====
  const ctx = document.getElementById('graficoGastosInicio');
  if (ctx) {
    let gastos = window.gastos || [];
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = (hoje.getMonth()+1).toString().padStart(2,'0');
    // Filtrar mês atual e ano atual
    const gastosMes = gastos.filter(g => g.data && g.data.startsWith(`${anoAtual}-${mesAtual}`));
    const gastosAno = gastos.filter(g => g.data && g.data.startsWith(`${anoAtual}-`));
    // Agrupar por categoria (tipo)
    function agruparPorTipo(lista) {
      const map = {};
      lista.forEach(g => {
        if (!g.tipo) return;
        map[g.tipo] = (map[g.tipo]||0) + (g.valor||0);
      });
      return map;
    }
    const porTipoMes = agruparPorTipo(gastosMes);
    const porTipoAno = agruparPorTipo(gastosAno);
    // Montar dados para Chart.js
    const categorias = Array.from(new Set([...Object.keys(porTipoMes), ...Object.keys(porTipoAno)]));
    const dadosMes = categorias.map(cat => porTipoMes[cat]||0);
    const dadosAno = categorias.map(cat => porTipoAno[cat]||0);
    // Destruir gráfico anterior se existir
    if (window._graficoGastosInicio) window._graficoGastosInicio.destroy();
    window._graficoGastosInicio = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: categorias,
        datasets: [
          { label: 'Mês', data: dadosMes, backgroundColor: 'rgba(33,150,243,0.7)' },
          { label: 'Ano', data: dadosAno, backgroundColor: 'rgba(76,175,80,0.7)' }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top', labels: { color: '#fff' } },
          title: { display: false }
        },
        scales: {
          x: { ticks: { color: '#fff' }, grid: { color: '#333' } },
          y: { ticks: { color: '#fff' }, grid: { color: '#333' } }
        }
      }
    });
  }
}
