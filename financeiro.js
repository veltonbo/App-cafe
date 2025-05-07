// ===== VARIÁVEIS GLOBAIS =====
let gastos = [];
let indiceEdicaoGasto = null;
let editarTodasParcelas = false;
let graficoGastosChart = null;

// ===== INICIALIZAR MENU FINANCEIRO =====
function inicializarFinanceiro() {
  carregarFinanceiro();
  document.getElementById("btnCancelarFinanceiro").addEventListener("click", cancelarEdicaoFinanceiro);
}

// ===== CARREGAR FINANCEIRO (Firebase) =====
function carregarFinanceiro() {
  db.ref("Financeiro").on("value", (snapshot) => {
    const data = snapshot.val();
    gastos = Array.isArray(data) ? data : [];
    atualizarFinanceiro();
  });
}

// ===== TOGGLE FORMULÁRIO (Botão Flutuante) =====
function alternarFormularioFinanceiro() {
  const form = document.getElementById("formularioFinanceiro");
  form.style.display = form.style.display === "none" ? "block" : "none";
}

// ===== ADICIONAR OU EDITAR GASTO =====
function adicionarFinanceiro() {
  const data = dataFin.value;
  const produto = produtoFin.value.trim();
  const descricao = descricaoFin.value.trim();
  const valor = parseFloat(valorFin.value);
  const tipo = tipoFin.value;
  const parcelado = parceladoFin.checked;
  const numParcelas = parcelado ? parseInt(parcelasFin.value) || 1 : 1;

  if (!data || !produto || isNaN(valor)) {
    alert("Preencha todos os campos corretamente!");
    return;
  }

  if (indiceEdicaoGasto !== null) {
    // Editando Gasto Existente
    const gasto = gastos[indiceEdicaoGasto];

    if (parcelado) {
      // Editar todas as parcelas ou uma única parcela
      const valorParcela = parseFloat((valor / numParcelas).toFixed(2));
      const dataBase = new Date(data);
      const parcelas = Array.from({ length: numParcelas }, (_, i) => {
        const venc = new Date(dataBase);
        venc.setMonth(venc.getMonth() + i);
        return {
          numero: i + 1,
          valor: valorParcela,
          vencimento: venc.toISOString().split("T")[0],
          pago: false
        };
      });

      gasto.data = data;
      gasto.produto = produto;
      gasto.descricao = descricao;
      gasto.valor = valor;
      gasto.tipo = tipo;
      gasto.parcelasDetalhes = parcelas;
      gasto.parcelas = numParcelas;
    } else {
      // Editar Gasto Simples
      gasto.data = data;
      gasto.produto = produto;
      gasto.descricao = descricao;
      gasto.valor = valor;
      gasto.tipo = tipo;
      delete gasto.parcelasDetalhes;
      gasto.parcelas = 1;
    }

  } else {
    // Novo Gasto
    const novoGasto = {
      data,
      produto,
      descricao,
      valor,
      tipo,
      pago: false,
      parcelas: numParcelas
    };

    if (parcelado) {
      const valorParcela = parseFloat((valor / numParcelas).toFixed(2));
      const dataBase = new Date(data);
      novoGasto.parcelasDetalhes = Array.from({ length: numParcelas }, (_, i) => {
        const venc = new Date(dataBase);
        venc.setMonth(venc.getMonth() + i);
        return {
          numero: i + 1,
          valor: valorParcela,
          vencimento: venc.toISOString().split("T")[0],
          pago: false
        };
      });
    }

    gastos.push(novoGasto);
  }

  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();
  resetarFormularioFinanceiro();
}

// ===== RESETAR FORMULÁRIO =====
function resetarFormularioFinanceiro() {
  dataFin.value = "";
  produtoFin.value = "";
  descricaoFin.value = "";
  valorFin.value = "";
  tipoFin.value = "Adubo";
  parcelasFin.value = "";
  parceladoFin.checked = false;
  parcelasFin.style.display = "none";
  indiceEdicaoGasto = null;
  editarTodasParcelas = false;
  document.getElementById("formularioFinanceiro").style.display = "none";
  document.getElementById("btnSalvarFinanceiro").innerHTML = '<i class="fas fa-save"></i> Salvar Gasto';
  document.getElementById("btnCancelarFinanceiro").style.display = "none";
}

// ===== CANCELAR EDIÇÃO =====
function cancelarEdicaoFinanceiro() {
  resetarFormularioFinanceiro();
}

// ===== MARCAR COMO PAGO =====
function marcarPago(index, parcelaIndex = null) {
  const gasto = gastos[index];
  if (!gasto) return;

  if (parcelaIndex !== null && gasto.parcelasDetalhes) {
    // Marcar parcela específica como paga
    gasto.parcelasDetalhes[parcelaIndex].pago = true;
    gasto.pago = gasto.parcelasDetalhes.every(p => p.pago);
  } else {
    // Marcar gasto completo como pago
    gasto.pago = true;
    if (gasto.parcelasDetalhes) {
      gasto.parcelasDetalhes.forEach(p => p.pago = true);
    }
  }

  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();
}

// ===== ATUALIZAR LISTAGEM DE GASTOS =====
function atualizarFinanceiro() {
  const filtroTexto = pesquisaFinanceiro.value.toLowerCase();
  const tipoFiltro = filtroTipoFin.value;
  const statusFiltro = filtroStatusFin.value;
  const dataIni = filtroDataInicioFin.value;
  const dataFim = filtroDataFimFin.value;

  const venc = document.getElementById("financeiroVencer");
  const pagos = document.getElementById("financeiroPago");
  venc.innerHTML = "";
  pagos.innerHTML = "";

  const dadosVencer = {};
  const dadosPago = {};

  gastos.forEach((g, index) => {
    const txt = `${g.data} ${g.produto} ${g.descricao || ""} ${g.tipo}`.toLowerCase();
    if (!txt.includes(filtroTexto)) return;
    if (tipoFiltro && g.tipo !== tipoFiltro) return;

    if (g.parcelasDetalhes?.length) {
      g.parcelasDetalhes.forEach((p, parcelaIndex) => {
        const grupo = p.pago ? dadosPago : dadosVencer;
        if (statusFiltro === "pago" && !p.pago) return;
        if (statusFiltro === "vencer" && p.pago) return;
        if (dataIni && p.vencimento < dataIni) return;
        if (dataFim && p.vencimento > dataFim) return;

        const mes = p.vencimento.slice(0, 7);
        if (!grupo[mes]) grupo[mes] = [];
        grupo[mes].push({
          produto: `${g.produto} (Parcela ${p.numero})`,
          descricao: g.descricao,
          valor: p.valor,
          tipo: g.tipo,
          vencimento: p.vencimento,
          pago: p.pago,
          i: index,
          parcelaIndex,
          isParcela: true
        });
      });
    } else {
      if (statusFiltro === "pago" && !g.pago) return;
      if (statusFiltro === "vencer" && g.pago) return;
      if (dataIni && g.data < dataIni) return;
      if (dataFim && g.data > dataFim) return;

      const grupo = g.pago ? dadosPago : dadosVencer;
      const mes = g.data.slice(0, 7);
      if (!grupo[mes]) grupo[mes] = [];
      grupo[mes].push({ ...g, i: index, isParcela: false });
    }
  });

  renderizarFinanceiro(dadosVencer, venc, false);
  renderizarFinanceiro(dadosPago, pagos, true);
  gerarResumoFinanceiro();
  gerarGraficoFinanceiro();
}

// ===== RENDERIZAR GASTOS NA LISTAGEM =====
function renderizarFinanceiro(grupo, container, pago) {
  const mesesOrdenados = Object.keys(grupo).sort((a, b) => b.localeCompare(a));
  for (const mes of mesesOrdenados) {
    const titulo = document.createElement("div");
    titulo.className = "grupo-data";
    titulo.innerText = formatarMes(mes);
    container.appendChild(titulo);

    let totalMes = 0;

    grupo[mes].forEach(({ produto, descricao, valor, tipo, vencimento, i, parcelaIndex, isParcela }) => {
      totalMes += valor;
      const icone = obterIconeTipo(tipo);
      const div = document.createElement("div");
      div.className = `item ${isParcela ? 'botoes-3' : 'botoes-2'}`;
      
      div.innerHTML = `
        <span>
          <i class="fas fa-${icone}"></i> 
          <strong>${produto}</strong> - ${formatarReal(valor)} (${tipo}) 
          ${descricao ? `<br><small style="color:#ccc;">${descricao}</small>` : ''}
          ${isParcela ? `<br><small>Venc: ${vencimento}</small>` : ''}
        </span>
        <div class="botoes-tarefa">
          ${gerarBotoesFinanceiro(i, parcelaIndex, isParcela, pago)}
        </div>
      `;
      container.appendChild(div);
    });

    const totalDiv = document.createElement("div");
    totalDiv.className = "grupo-data";
    totalDiv.innerHTML = `<span style="font-size:14px;">Total: ${formatarReal(totalMes)}</span>`;
    container.appendChild(totalDiv);
  }
}

// ===== GERAR BOTÕES DINÂMICOS =====
function gerarBotoesFinanceiro(i, parcelaIndex, isParcela, pago) {
  if (isParcela) {
    return `
      <button class="botao-circular verde" onclick="alternarParcela(${i}, ${parcelaIndex})">
        <i class="fas ${pago ? 'fa-undo' : 'fa-check'}"></i>
      </button>
      ${!pago ? `<button class="botao-circular azul" onclick="editarFinanceiro(${i}, ${parcelaIndex})">
        <i class="fas fa-edit"></i>
      </button>` : ''}
      <button class="botao-circular vermelho" onclick="confirmarExclusaoParcela(${i}, ${parcelaIndex})">
        <i class="fas fa-trash"></i>
      </button>
    `;
  } else if (pago) {
    return `
      <button class="botao-circular laranja" onclick="desfazerPagamento(${i})">
        <i class="fas fa-undo"></i>
      </button>
      <button class="botao-circular vermelho" onclick="confirmarExclusaoParcela(${i}, null)">
        <i class="fas fa-trash"></i>
      </button>
    `;
  } else {
    return `
      <button class="botao-circular verde" onclick="marcarPago(${i})">
        <i class="fas fa-check"></i>
      </button>
      <button class="botao-circular azul" onclick="editarFinanceiro(${i})">
        <i class="fas fa-edit"></i>
      </button>
      <button class="botao-circular vermelho" onclick="confirmarExclusaoParcela(${i}, null)">
        <i class="fas fa-trash"></i>
      </button>
    `;
  }
}

// ===== OBTENÇÃO DO ÍCONE POR TIPO =====
function obterIconeTipo(tipo) {
  return tipo === "Adubo" ? "leaf" :
         tipo === "Fungicida" ? "bug" :
         tipo === "Inseticida" ? "spray-can" :
         tipo === "Herbicida" ? "recycle" : "tag";
}

// ===== FORMATAR MÊS PARA EXIBIÇÃO =====
function formatarMes(mes) {
  const [ano, mesNum] = mes.split("-");
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  return `${meses[parseInt(mesNum) - 1]} de ${ano}`;
}

// ===== FORMATAR VALOR EM REAL =====
function formatarReal(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ===== TOGGLE FILTROS (Mostrar/Ocultar) =====
function toggleFiltrosFinanceiro() {
  const filtros = document.getElementById("filtrosFinanceiro");
  filtros.style.display = filtros.style.display === "none" ? "block" : "none";
}

// ===== CONFIRMAR EXCLUSÃO DE PARCELA OU LANÇAMENTO =====
function confirmarExclusaoParcela(index, parcelaIndex) {
  if (gastos[index]?.parcelasDetalhes) {
    document.getElementById("modalConfirmarExclusaoParcela").style.display = "flex";
    modalConfirmarExclusaoParcela.dataset.index = index;
    modalConfirmarExclusaoParcela.dataset.parcelaIndex = parcelaIndex;
  } else {
    if (confirm("Deseja excluir esse lançamento financeiro?")) {
      gastos.splice(index, 1);
      db.ref("Financeiro").set(gastos);
      atualizarFinanceiro();
    }
  }
}

// ===== EXCLUIR APENAS UMA PARCELA =====
function excluirApenasParcela() {
  const index = parseInt(modalConfirmarExclusaoParcela.dataset.index);
  const parcelaIndex = parseInt(modalConfirmarExclusaoParcela.dataset.parcelaIndex);

  if (!isNaN(index) && !isNaN(parcelaIndex)) {
    gastos[index].parcelasDetalhes.splice(parcelaIndex, 1);
    if (gastos[index].parcelasDetalhes.length === 0) {
      gastos.splice(index, 1);
    }
    db.ref("Financeiro").set(gastos);
    atualizarFinanceiro();
  }
  fecharModalExcluirParcela();
}

// ===== EXCLUIR TODAS AS PARCELAS OU LANÇAMENTO =====
function excluirTodasParcelas() {
  const index = parseInt(modalConfirmarExclusaoParcela.dataset.index);
  if (!isNaN(index)) {
    gastos.splice(index, 1);
    db.ref("Financeiro").set(gastos);
    atualizarFinanceiro();
  }
  fecharModalExcluirParcela();
}

// ===== FECHAR MODAL DE EXCLUSÃO =====
function fecharModalExcluirParcela() {
  document.getElementById("modalConfirmarExclusaoParcela").style.display = "none";
}

// ===== GERAR RESUMO FINANCEIRO (TOPO) =====
function gerarResumoFinanceiro() {
  let totalPago = 0;
  let totalVencer = 0;

  gastos.forEach(g => {
    if (g.parcelasDetalhes?.length) {
      g.parcelasDetalhes.forEach(p => {
        if (p.pago) totalPago += p.valor;
        else totalVencer += p.valor;
      });
    } else {
      if (g.pago) totalPago += g.valor;
      else totalVencer += g.valor;
    }
  });

  document.getElementById("resumoFinanceiroMensal").innerHTML = `
    <div style="display:flex; gap:20px; margin-bottom:15px;">
      <div style="background:#4caf50; padding:10px 15px; border-radius:8px; color:white;">Pago: ${formatarReal(totalPago)}</div>
      <div style="background:#ff9800; padding:10px 15px; border-radius:8px; color:white;">A Vencer: ${formatarReal(totalVencer)}</div>
      <div style="background:#2196f3; padding:10px 15px; border-radius:8px; color:white;">Total: ${formatarReal(totalPago + totalVencer)}</div>
    </div>
  `;
}

// ===== GERAR GRÁFICO DE GASTOS PAGOS (DONUT) =====
function gerarGraficoFinanceiro() {
  const ctx = document.getElementById("graficoGastos").getContext("2d");
  if (graficoGastosChart) graficoGastosChart.destroy();

  const categorias = {};

  gastos.forEach(g => {
    if (g.parcelasDetalhes?.length) {
      g.parcelasDetalhes.forEach(p => {
        if (p.pago) {
          categorias[g.tipo] = (categorias[g.tipo] || 0) + p.valor;
        }
      });
    } else if (g.pago) {
      categorias[g.tipo] = (categorias[g.tipo] || 0) + g.valor;
    }
  });

  const labels = Object.keys(categorias);
  const valores = Object.values(categorias);
  const total = valores.reduce((sum, v) => sum + v, 0);

  const labelsComPorcentagem = labels.map((l, i) => {
    const pct = ((valores[i] / total) * 100).toFixed(1);
    return `${l} (${pct}%)`;
  });

  graficoGastosChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labelsComPorcentagem,
      datasets: [{
        data: valores,
        backgroundColor: ['#66bb6a', '#29b6f6', '#ffa726', '#ef5350', '#ab47bc']
      }]
    },
    options: {
      plugins: {
        legend: {
          labels: { color: "#ddd" }
        }
      }
    }
  });
}

// ===== EXPORTAR FINANCEIRO COMO CSV =====
function exportarFinanceiroCSV() {
  if (!gastos.length) {
    alert("Nenhum dado disponível para exportação.");
    return;
  }

  let csv = 'Data,Produto,Descrição,Tipo,Valor (R$),Pago\n';

  gastos.forEach(g => {
    if (g.parcelasDetalhes?.length) {
      g.parcelasDetalhes.forEach(p => {
        csv += `${p.vencimento},${g.produto} (Parcela ${p.numero}),${g.descricao || ''},${g.tipo},${p.valor.toFixed(2)},${p.pago ? 'Sim' : 'Não'}\n`;
      });
    } else {
      csv += `${g.data},${g.produto},${g.descricao || ''},${g.tipo},${g.valor.toFixed(2)},${g.pago ? 'Sim' : 'Não'}\n`;
    }
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `financeiro_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
}

// ===== EXPORTAR FINANCEIRO COMO PDF =====
function exportarFinanceiroPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("Relatório Financeiro", 20, 20);
  let y = 40;

  gastos.forEach(g => {
    doc.text(`${g.data || '-'} - ${g.produto} (${g.tipo}) - ${formatarReal(g.valor)} - ${g.pago ? "Pago" : "A Vencer"}`, 20, y);
    y += 8;

    if (g.descricao) {
      doc.text(`Descrição: ${g.descricao}`, 25, y);
      y += 6;
    }

    if (g.parcelasDetalhes?.length) {
      g.parcelasDetalhes.forEach(p => {
        doc.text(`Parcela ${p.numero}: ${p.vencimento} - ${formatarReal(p.valor)} - ${p.pago ? "Pago" : "A Vencer"}`, 25, y);
        y += 6;
      });
    }
    y += 4;
  });

  doc.save("relatorio_financeiro.pdf");
}
