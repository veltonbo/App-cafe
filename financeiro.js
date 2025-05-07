// ===== VARIÁVEIS GLOBAIS =====
let gastos = [];
let indiceEdicaoGasto = null;
let editarTodasParcelas = false;
let graficoGastosChart = null;

// ===== INICIALIZAR MENU FINANCEIRO =====
function inicializarFinanceiro() {
  carregarFinanceiro();
}

// ===== BOTÃO FLUTUANTE PARA FORMULÁRIO =====
function alternarFormularioFinanceiro() {
  const form = document.getElementById("formularioFinanceiro");
  form.style.display = form.style.display === "none" ? "block" : "none";
}

// ===== MOSTRAR/ESCONDER PARCELAS =====
function mostrarParcelas() {
  const chk = document.getElementById("parceladoFin");
  const inputParcelas = document.getElementById("parcelasFin");
  inputParcelas.style.display = chk.checked ? "block" : "none";
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
    const gastoOriginal = gastos[indiceEdicaoGasto];
    if (editarTodasParcelas && gastoOriginal.parcelasDetalhes?.length) {
      gastoOriginal.parcelasDetalhes.forEach((p, idx) => {
        p.valor = parseFloat((valor / numParcelas).toFixed(2));
        p.vencimento = new Date(data);
        p.vencimento.setMonth(p.vencimento.getMonth() + idx);
      });
    } else if (gastoOriginal.parcelasDetalhes?.length) {
      const idx = parseInt(parcelasFin.dataset.parcelaIndex);
      if (!isNaN(idx)) {
        gastoOriginal.parcelasDetalhes[idx].valor = valor;
        gastoOriginal.parcelasDetalhes[idx].vencimento = data;
      }
    } else {
      gastoOriginal.data = data;
      gastoOriginal.produto = produto;
      gastoOriginal.descricao = descricao;
      gastoOriginal.valor = valor;
      gastoOriginal.tipo = tipo;
    }
  } else {
    const novoGasto = {
      data,
      produto,
      descricao,
      valor,
      tipo,
      pago: false,
      parcelas: numParcelas,
    };

    if (numParcelas > 1) {
      novoGasto.parcelasDetalhes = [];
      for (let i = 0; i < numParcelas; i++) {
        novoGasto.parcelasDetalhes.push({
          numero: i + 1,
          valor: parseFloat((valor / numParcelas).toFixed(2)),
          vencimento: new Date(data).toISOString().split("T")[0],
          pago: false,
        });
      }
    }
    gastos.push(novoGasto);
  }

  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();
  cancelarEdicaoFinanceiro();
}

// ===== ATUALIZAR LISTAGEM =====
function atualizarFinanceiro() {
  const filtroTexto = pesquisaFinanceiro.value.toLowerCase();
  const venc = document.getElementById("financeiroVencer");
  const pagos = document.getElementById("financeiroPago");
  venc.innerHTML = "";
  pagos.innerHTML = "";

  gastos.forEach((g, index) => {
    const txt = `${g.data} ${g.produto} ${(g.descricao || "")} ${g.tipo}`.toLowerCase();
    if (!txt.includes(filtroTexto)) return;

    if (g.parcelasDetalhes) {
      g.parcelasDetalhes.forEach((p, idx) => {
        const container = p.pago ? pagos : venc;
        container.innerHTML += `
          <div class="item">
            <span>${g.produto} (Parcela ${p.numero}) - R$ ${p.valor.toFixed(2)}</span>
            <div>
              <button onclick="alternarParcela(${index}, ${idx})">
                ${p.pago ? "Desfazer" : "Pagar"}
              </button>
              <button onclick="editarFinanceiro(${index}, ${idx})">Editar</button>
              <button onclick="confirmarExclusaoParcela(${index}, ${idx})">Excluir</button>
            </div>
          </div>
        `;
      });
    } else {
      const container = g.pago ? pagos : venc;
      container.innerHTML += `
        <div class="item">
          <span>${g.produto} - R$ ${g.valor.toFixed(2)}</span>
          <div>
            <button onclick="marcarPago(${index})">${g.pago ? "Desfazer" : "Pagar"}</button>
            <button onclick="editarFinanceiro(${index})">Editar</button>
            <button onclick="confirmarExclusaoParcela(${index})">Excluir</button>
          </div>
        </div>
      `;
    }
  });
  gerarResumoFinanceiro();
}

// ===== EDITAR FINANCEIRO =====
function editarFinanceiro(index, parcelaIndex = null) {
  const gasto = gastos[index];
  const parcela = parcelaIndex !== null ? gasto.parcelasDetalhes?.[parcelaIndex] : null;

  dataFin.value = parcela ? parcela.vencimento : gasto.data;
  produtoFin.value = gasto.produto;
  descricaoFin.value = gasto.descricao || "";
  valorFin.value = parcela ? parcela.valor : gasto.valor;
  tipoFin.value = gasto.tipo;
  parceladoFin.checked = !!gasto.parcelasDetalhes;
  parcelasFin.value = gasto.parcelas || "";

  indiceEdicaoGasto = index;
  editarTodasParcelas = parcelaIndex === null;
  parcelasFin.dataset.parcelaIndex = parcelaIndex !== null ? parcelaIndex : "";

  document.getElementById("formularioFinanceiro").style.display = "block";
}

// ===== MARCAR COMO PAGO =====
function alternarParcela(index, parcelaIndex) {
  const parcela = gastos[index].parcelasDetalhes[parcelaIndex];
  parcela.pago = !parcela.pago;
  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();
}

// ===== CANCELAR EDIÇÃO =====
function cancelarEdicaoFinanceiro() {
  indiceEdicaoGasto = null;
  editarTodasParcelas = false;
  parcelasFin.dataset.parcelaIndex = "";
  document.getElementById("formularioFinanceiro").style.display = "none";
  dataFin.value = "";
  produtoFin.value = "";
  descricaoFin.value = "";
  valorFin.value = "";
  tipoFin.value = "Adubo";
  parcelasFin.value = "";
}

// ===== CONFIRMAR EXCLUSÃO DE PARCELA =====
function confirmarExclusaoParcela(index, parcelaIndex = null) {
  if (parcelaIndex !== null) {
    if (confirm("Deseja excluir esta parcela?")) {
      excluirApenasParcela(index, parcelaIndex);
    }
  } else {
    if (confirm("Deseja excluir este lançamento financeiro?")) {
      excluirGastoCompleto(index);
    }
  }
}

// ===== EXCLUIR APENAS UMA PARCELA =====
function excluirApenasParcela(index, parcelaIndex) {
  const gasto = gastos[index];
  if (gasto.parcelasDetalhes) {
    gasto.parcelasDetalhes.splice(parcelaIndex, 1);
    if (gasto.parcelasDetalhes.length === 0) {
      gastos.splice(index, 1);
    }
  }
  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();
}

// ===== EXCLUIR GASTO COMPLETO =====
function excluirGastoCompleto(index) {
  gastos.splice(index, 1);
  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();
}

// ===== GERAR RESUMO FINANCEIRO (Topo) =====
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
    <div style="display: flex; gap: 20px; flex-wrap: wrap;">
      <span style="color: #4caf50;">Total Pago: <strong>R$ ${totalPago.toFixed(2)}</strong></span>
      <span style="color: #ff9800;">A Vencer: <strong>R$ ${totalVencer.toFixed(2)}</strong></span>
      <span style="color: #29b6f6;">Total Geral: <strong>R$ ${(totalPago + totalVencer).toFixed(2)}</strong></span>
    </div>
  `;
}

// ===== GERAR GRÁFICO DE GASTOS PAGOS =====
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

    if (g.parcelasDetalhes?.length) {
      g.parcelasDetalhes.forEach(p => {
        doc.text(`Parcela ${p.numero}: Venc ${p.vencimento} - R$ ${p.valor.toFixed(2)} - ${p.pago ? "Pago" : "A Vencer"}`, 25, y);
        y += 6;
      });
    }

    y += 4;
  });

  doc.save("relatorio_financeiro.pdf");
}

// ===== INICIALIZAR FINANCEIRO AO CARREGAR =====
function carregarFinanceiro() {
  db.ref("Financeiro").on("value", (snapshot) => {
    const data = snapshot.val();
    gastos = Array.isArray(data) ? data : [];
    atualizarFinanceiro();
  });
}

// ===== TOGGLE FILTROS FINANCEIRO =====
function toggleFiltrosFinanceiro() {
  const filtros = document.getElementById("filtrosFinanceiro");
  filtros.style.display = filtros.style.display === "none" ? "block" : "none";
}

// ===== FORMATAR REAL =====
function formatarReal(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
