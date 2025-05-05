// ===== VARIÁVEIS =====
let gastos = [];
let graficoGastosChart = null;
let editandoGastoIndex = null;
let editandoParcelaIndex = null;

// ===== CARREGAR FINANCEIRO =====
function carregarFinanceiro() {
  db.ref("Financeiro").on("value", snap => {
    gastos = snap.exists() ? snap.val() : [];
    atualizarFinanceiro();
  });
}

// ===== MOSTRAR/OCULTAR PARCELAS =====
function mostrarParcelas() {
  document.getElementById("parcelasFin").style.display =
    document.getElementById("parceladoFin").checked ? "block" : "none";
}

// ===== ADICIONAR OU EDITAR GASTO =====
function adicionarFinanceiro() {
  const data = dataFin.value;
  const produto = produtoFin.value.trim();
  const descricao = descricaoFin.value.trim();
  const valor = parseFloat(valorFin.value);
  const tipo = tipoFin.value;
  const parcelas = parceladoFin.checked ? parseInt(parcelasFin.value) || 1 : 1;

  if (!data || !produto || isNaN(valor)) {
    alert("Preencha os campos obrigatórios corretamente!");
    return;
  }

  const gasto = {
    data,
    produto,
    descricao,
    valor,
    tipo,
    pago: false,
    parcelas,
  };

  if (parcelas > 1) {
    const valorParcela = parseFloat((valor / parcelas).toFixed(2));
    const baseDate = new Date(data);
    gasto.parcelasDetalhes = [];

    for (let i = 0; i < parcelas; i++) {
      const venc = new Date(baseDate);
      venc.setMonth(venc.getMonth() + i);
      gasto.parcelasDetalhes.push({
        numero: i + 1,
        valor: valorParcela,
        vencimento: venc.toISOString().split("T")[0],
        pago: false,
      });
    }
  }

  if (editandoGastoIndex !== null) {
    if (
      gastos[editandoGastoIndex].parcelasDetalhes &&
      gastos[editandoGastoIndex].parcelasDetalhes.length > 0 &&
      editandoParcelaIndex !== null
    ) {
      gastos[editandoGastoIndex].parcelasDetalhes[editandoParcelaIndex].valor = gasto.parcelasDetalhes[0].valor;
      gastos[editandoGastoIndex].parcelasDetalhes[editandoParcelaIndex].vencimento = gasto.parcelasDetalhes[0].vencimento;
    } else {
      gastos[editandoGastoIndex] = gasto;
    }
    editandoGastoIndex = null;
    editandoParcelaIndex = null;
    document.getElementById("btnSalvarFinanceiro").innerText = "Salvar Gasto";
    document.getElementById("btnCancelarEdicaoFin").style.display = "none";
  } else {
    gastos.push(gasto);
  }

  db.ref("Financeiro").set(gastos);
  limparCamposFinanceiro();
  atualizarFinanceiro();
}

// ===== LIMPAR CAMPOS =====
function limparCamposFinanceiro() {
  dataFin.value = "";
  produtoFin.value = "";
  descricaoFin.value = "";
  valorFin.value = "";
  tipoFin.value = "Adubo";
  parcelasFin.value = "";
  parceladoFin.checked = false;
  mostrarParcelas();
}

// ===== ATUALIZAR LISTAGEM =====
function atualizarFinanceiro() {
  const texto = pesquisaFinanceiro.value.toLowerCase();
  const tipo = filtroTipoFin.value;
  const status = filtroStatusFin.value;
  const dataIni = filtroDataInicioFin.value;
  const dataFim = filtroDataFimFin.value;

  const vencer = document.getElementById("financeiroVencer");
  const pagos = document.getElementById("financeiroPago");
  vencer.innerHTML = "";
  pagos.innerHTML = "";

  const grupoVencer = {};
  const grupoPago = {};

  gastos.forEach((g, i) => {
    if (g.parcelasDetalhes?.length) {
      g.parcelasDetalhes.forEach((p, j) => {
        const grupo = p.pago ? grupoPago : grupoVencer;
        if (status === "pago" && !p.pago) return;
        if (status === "vencer" && p.pago) return;
        if (dataIni && p.vencimento < dataIni) return;
        if (dataFim && p.vencimento > dataFim) return;
        if (tipo && g.tipo !== tipo) return;
        if (
          !`${g.produto} ${g.tipo} ${g.descricao}`.toLowerCase().includes(texto)
        )
          return;

        const mes = p.vencimento.slice(0, 7);
        if (!grupo[mes]) grupo[mes] = [];
        grupo[mes].push({
          produto: `${g.produto} (Parcela ${p.numero})`,
          descricao: g.descricao,
          tipo: g.tipo,
          valor: p.valor,
          vencimento: p.vencimento,
          pago: p.pago,
          i,
          parcelaIndex: j,
          isParcela: true,
        });
      });
    } else {
      const grupo = g.pago ? grupoPago : grupoVencer;
      if (status === "pago" && !g.pago) return;
      if (status === "vencer" && g.pago) return;
      if (dataIni && g.data < dataIni) return;
      if (dataFim && g.data > dataFim) return;
      if (tipo && g.tipo !== tipo) return;
      if (
        !`${g.produto} ${g.tipo} ${g.descricao}`.toLowerCase().includes(texto)
      )
        return;

      const mes = g.data.slice(0, 7);
      if (!grupo[mes]) grupo[mes] = [];
      grupo[mes].push({ ...g, i, isParcela: false });
    }
  });

  renderizarFinanceiro(grupoVencer, vencer, false);
  renderizarFinanceiro(grupoPago, pagos, true);
  gerarResumoFinanceiro();
  gerarGraficoFinanceiro();
}

// ===== RENDERIZAR FINANCEIRO COM BOTÕES AJUSTÁVEIS =====
function renderizarFinanceiro(grupo, container, pago) {
  for (const mes in grupo) {
    const grupoData = document.createElement("div");
    grupoData.className = "grupo-data";
    grupoData.innerText = formatarMes(mes);
    container.appendChild(grupoData);

    let total = 0;

    grupo[mes].forEach((gasto) => {
      total += gasto.valor;
      const div = document.createElement("div");
      div.className = "item";

      const botoes = document.createElement("div");
      botoes.className = "botoes-financeiro";
      botoes.style.position = "absolute";
      botoes.style.top = "50%";
      botoes.style.right = "10px";
      botoes.style.transform = "translateY(-50%)";
      botoes.style.display = "flex";
      botoes.style.gap = "10px";

      const span = document.createElement("span");
      span.innerHTML = `
        <i class="fas fa-tag"></i> <strong>${gasto.produto}</strong> - R$ ${gasto.valor.toFixed(2)} (${gasto.tipo})
        ${gasto.descricao ? `<br><small style="color:#ccc;">${gasto.descricao}</small>` : ""}
        ${gasto.isParcela ? `<br><small>Venc: ${gasto.vencimento}</small>` : ""}
      `;

      const btnCheck = document.createElement("button");
      btnCheck.className = "botao-circular verde";
      btnCheck.innerHTML = `<i class="fas ${gasto.pago ? "fa-undo" : "fa-check"}"></i>`;
      btnCheck.onclick = () =>
        gasto.isParcela
          ? alternarParcela(gasto.i, gasto.parcelaIndex)
          : gasto.pago
          ? desfazerPagamento(gasto.i)
          : marcarPago(gasto.i);

      const btnExcluir = document.createElement("button");
      btnExcluir.className = "botao-circular vermelho";
      btnExcluir.innerHTML = `<i class="fas fa-trash"></i>`;
      btnExcluir.onclick = () =>
        confirmarExclusaoParcela(gasto.i, gasto.parcelaIndex);

      botoes.appendChild(btnCheck);

      if (!gasto.pago) {
        const btnEditar = document.createElement("button");
        btnEditar.className = "botao-circular azul";
        btnEditar.innerHTML = `<i class="fas fa-edit"></i>`;
        btnEditar.onclick = () =>
          editarFinanceiro(gasto.i, gasto.isParcela ? gasto.parcelaIndex : null);
        botoes.appendChild(btnEditar);
      }

      botoes.appendChild(btnExcluir);
      div.appendChild(span);
      div.appendChild(botoes);

      // ajuste espaçamento
      div.style.paddingRight = gasto.pago ? "90px" : "130px";

      container.appendChild(div);
    });

    const totalDiv = document.createElement("div");
    totalDiv.className = "grupo-data";
    totalDiv.innerHTML = `<span style="font-size:14px;">Total: R$ ${total.toFixed(2)}</span>`;
    container.appendChild(totalDiv);
  }
}

// ===== PAGAMENTO =====
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

// ===== RESUMO E GRÁFICO =====
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
        if (!p.pago) return;
        categorias[g.tipo] = (categorias[g.tipo] || 0) + p.valor;
      });
    } else {
      if (!g.pago) return;
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

// ===== EXPORTAÇÃO CSV E PDF =====
function exportarFinanceiroCSV() {
  if (!gastos.length) {
    alert("Nenhum dado disponível para exportação.");
    return;
  }

  let csv = 'Data,Produto,Descrição,Tipo,Valor (R$),Pago\n';

  gastos.forEach(g => {
    if (g.parcelasDetalhes) {
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

    if (g.parcelasDetalhes) {
      g.parcelasDetalhes.forEach(p => {
        doc.text(`Parcela ${p.numero}: Venc ${p.vencimento} - R$ ${p.valor.toFixed(2)} - ${p.pago ? "Pago" : "A Vencer"}`, 25, y);
        y += 6;
      });
    }

    y += 4;
  });

  doc.save("relatorio_financeiro.pdf");
}

// ===== EXCLUSÃO =====
function confirmarExclusaoParcela(index, parcelaIndex) {
  if (gastos[index]?.parcelasDetalhes) {
    modalConfirmarExclusaoParcela.style.display = "flex";
    modalConfirmarExclusaoParcela.dataset.index = index;
    modalConfirmarExclusaoParcela.dataset.parcelaIndex = parcelaIndex;
  } else {
    if (confirm("Deseja excluir este lançamento?")) {
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

// ===== EDITAR FINANCEIRO (parcela ou todas) =====
function editarFinanceiro(index, parcelaIndex = null) {
  const g = gastos[index];
  if (!g) return;

  if (g.parcelasDetalhes && parcelaIndex !== null) {
    const p = g.parcelasDetalhes[parcelaIndex];
    if (!confirm("Deseja editar apenas esta parcela?")) return;

    dataFin.value = p.vencimento;
    produtoFin.value = `${g.produto} (Parcela ${p.numero})`;
    descricaoFin.value = g.descricao;
    valorFin.value = p.valor;
    tipoFin.value = g.tipo;
    parceladoFin.checked = false;
    parcelasFin.style.display = "none";
  } else {
    dataFin.value = g.data;
    produtoFin.value = g.produto;
    descricaoFin.value = g.descricao;
    valorFin.value = g.valor;
    tipoFin.value = g.tipo;
    parceladoFin.checked = g.parcelas > 1;
    parcelasFin.value = g.parcelas || 1;
    mostrarParcelas();
  }

  // Apagar item original para editar como novo
  gastos.splice(index, 1);
  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();
}

