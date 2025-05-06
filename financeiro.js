// ===== VARIÁVEIS =====
let gastos = [];
let graficoGastosChart = null;
let indiceEdicaoGasto = null;
let editarTodasParcelas = false;

// ===== CARREGAR FINANCEIRO =====
function carregarFinanceiro() {
  db.ref("Financeiro").on("value", snap => {
    if (snap.exists()) {
      gastos = snap.val();
      atualizarFinanceiro();
    }
  });
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

  const novoGasto = {
    data,
    produto,
    descricao,
    valor,
    tipo,
    pago: false,
    parcelas: numParcelas
  };

  if (numParcelas > 1) {
    const valorParcela = parseFloat((valor / numParcelas).toFixed(2));
    const parcelas = [];
    const dataBase = new Date(data);
    for (let i = 0; i < numParcelas; i++) {
      const vencimento = new Date(dataBase);
      vencimento.setMonth(vencimento.getMonth() + i);
      parcelas.push({
        numero: i + 1,
        valor: valorParcela,
        vencimento: vencimento.toISOString().split("T")[0],
        pago: false
      });
    }
    novoGasto.parcelasDetalhes = parcelas;
  }

  if (typeof indiceEdicaoGasto === "number") {
    const original = gastos[indiceEdicaoGasto];

    if (original.parcelasDetalhes && original.parcelasDetalhes.length > 0) {
      if (editarTodasParcelas) {
        gastos[indiceEdicaoGasto] = novoGasto;
      } else {
        const idx = parseInt(parcelasFin.dataset.parcelaIndex);
        if (!isNaN(idx)) {
          original.parcelasDetalhes[idx].valor = valor;
          original.parcelasDetalhes[idx].vencimento = data;
          original.produto = produto;
          original.descricao = descricao;
          original.tipo = tipo;
        }
      }
    } else {
      gastos[indiceEdicaoGasto] = novoGasto;
    }

    indiceEdicaoGasto = null;
    editarTodasParcelas = false;
    document.getElementById("btnCancelarFinanceiro").style.display = "none";
  } else {
    gastos.push(novoGasto);
  }

  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();
  limparFormularioFinanceiro();
  document.getElementById("formularioFinanceiro").style.display = "none";
}

// ===== PAGAMENTO E EXCLUSÃO =====
function marcarPago(index) {
  if (gastos[index]) {
    gastos[index].pago = true;
    db.ref("Financeiro").set(gastos);
    atualizarFinanceiro();
  }
}

function desfazerPagamento(index) {
  if (gastos[index]) {
    gastos[index].pago = false;
    db.ref("Financeiro").set(gastos);
    atualizarFinanceiro();
  }
}

function alternarParcela(gastoIndex, parcelaIndex) {
  const gasto = gastos[gastoIndex];
  if (!gasto || !gasto.parcelasDetalhes) return;
  const parcela = gasto.parcelasDetalhes[parcelaIndex];
  parcela.pago = !parcela.pago;
  gasto.pago = gasto.parcelasDetalhes.every(p => p.pago);
  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();
}

// ===== GRÁFICO E RESUMO =====
function gerarResumoFinanceiro() {
  let totalPago = 0;
  let totalVencer = 0;
  gastos.forEach(g => {
    if (g.parcelasDetalhes) {
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
    <div>Total Pago: R$ ${totalPago.toFixed(2)}</div>
    <div>Total A Vencer: R$ ${totalVencer.toFixed(2)}</div>
    <div>Total Geral: R$ ${(totalPago + totalVencer).toFixed(2)}</div>
  `;
}

function gerarGraficoFinanceiro() {
  const ctx = document.getElementById("graficoGastos").getContext("2d");
  if (graficoGastosChart) graficoGastosChart.destroy();

  const categorias = {};
  gastos.forEach(g => {
    if (g.parcelasDetalhes) {
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
  const total = valores.reduce((soma, v) => soma + v, 0);
  const labelsComPercentual = labels.map((label, i) => {
    const percent = ((valores[i] / total) * 100).toFixed(1);
    return `${label} (${percent}%)`;
  });

  graficoGastosChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labelsComPercentual,
      datasets: [{
        data: valores,
        backgroundColor: ['#66bb6a', '#29b6f6', '#ffa726', '#ef5350', '#ab47bc']
      }]
    }
  });
}

function formatarMes(mes) {
  const [ano, mesNum] = mes.split("-");
  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                 "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return `${meses[parseInt(mesNum) - 1]} de ${ano}`;
}

// ===== EXPORTAÇÃO PDF E CSV =====
function exportarFinanceiroCSV() {
  if (!gastos.length) {
    alert("Nenhum dado disponível para exportação.");
    return;
  }

  let csv = 'Data,Produto,Descrição,Tipo,Valor (R$),Pago\n';

  gastos.forEach(g => {
    if (g.parcelasDetalhes && g.parcelasDetalhes.length > 0) {
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

function exportarFinanceiroPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("Relatório Financeiro", 20, 20);
  let y = 40;

  gastos.forEach(g => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    doc.text(`${g.data || '-'} - ${g.produto} (${g.tipo}) - R$ ${g.valor.toFixed(2)} - ${g.pago ? "Pago" : "A Vencer"}`, 20, y);
    y += 8;

    if (g.descricao) {
      doc.text(`Descrição: ${g.descricao}`, 25, y);
      y += 6;
    }

    if (g.parcelasDetalhes && g.parcelasDetalhes.length > 0) {
      g.parcelasDetalhes.forEach(p => {
        doc.text(`Parcela ${p.numero}: Venc ${p.vencimento} - R$ ${p.valor.toFixed(2)} - ${p.pago ? "Pago" : "A Vencer"}`, 25, y);
        y += 6;
      });
    }

    y += 4;
  });

  doc.save("relatorio_financeiro.pdf");
}

// ===== EXCLUSÃO DE PARCELA =====
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

function excluirTodasParcelas() {
  const index = parseInt(modalConfirmarExclusaoParcela.dataset.index);
  if (!isNaN(index)) {
    gastos.splice(index, 1);
    db.ref("Financeiro").set(gastos);
    atualizarFinanceiro();
  }
  fecharModalExcluirParcela();
}

function fecharModalExcluirParcela() {
  modalConfirmarExclusaoParcela.style.display = "none";
}

// ===== TOGGLE DE FILTROS =====
function toggleFiltrosFinanceiro() {
  const filtros = document.getElementById("filtrosFinanceiro");
  const btnIcone = document.querySelector("#btnToggleFiltrosFin i");

  if (filtros.style.display === "none" || filtros.style.display === "") {
    filtros.style.display = "block";
    btnIcone.classList.remove("fa-filter");
    btnIcone.classList.add("fa-times");
  } else {
    filtros.style.display = "none";
    btnIcone.classList.remove("fa-times");
    btnIcone.classList.add("fa-filter");
  }
}

// ===== TOGGLE DE FORMULÁRIO =====
function alternarFormularioFinanceiro() {
  const formulario = document.getElementById("formularioFinanceiro");
  formulario.style.display = formulario.style.display === "none" ? "block" : "none";
}


