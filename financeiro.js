// ===== VARIÁVEIS =====
let gastos = [];
let graficoGastosChart = null;

// ===== CARREGAR FINANCEIRO =====
function carregarFinanceiro() {
  db.ref("Financeiro").on("value", snap => {
    if (snap.exists()) {
      gastos = snap.val();
      atualizarFinanceiro();
    }
  });
}

// ===== ADICIONAR GASTO =====
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
    data, produto, descricao, valor, tipo,
    pago: false,
    parcelas: numParcelas
  };

  if (numParcelas > 1) {
    const valorParcela = parseFloat((valor / numParcelas).toFixed(2));
    const parcelas = [];
    const dataBase = new Date(data);
    for (let i = 0; i < numParcelas; i++) {
      const venc = new Date(dataBase);
      venc.setMonth(venc.getMonth() + i);
      parcelas.push({
        numero: i + 1,
        valor: valorParcela,
        vencimento: venc.toISOString().split("T")[0],
        pago: false
      });
    }
    novoGasto.parcelasDetalhes = parcelas;
  }

  if (typeof indiceEdicaoGasto === 'number') {
    gastos[indiceEdicaoGasto] = novoGasto;
    indiceEdicaoGasto = null;
    document.getElementById("btnSalvarGasto").innerHTML = '<i class="fas fa-save"></i> Salvar Gasto';
    document.getElementById("btnCancelarEdicaoGasto").style.display = "none";
  } else {
    gastos.push(novoGasto);
  }

  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();
  limparCamposFinanceiro();
}

// ===== ATUALIZAR LISTAGEM =====
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
    const txt = `${g.data} ${g.produto} ${(g.descricao || "")} ${g.tipo}`.toLowerCase();
    if (!txt.includes(filtroTexto)) return;
    if (tipoFiltro && g.tipo !== tipoFiltro) return;

    if (g.parcelasDetalhes && g.parcelasDetalhes.length > 0) {
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

function renderizarFinanceiro(grupo, container, pago) {
  container.innerHTML = ""; // limpa o container antes de preencher

  for (const mes in grupo) {
    const titulo = document.createElement("div");
    titulo.className = "grupo-data";
    titulo.innerText = formatarMes(mes);
    container.appendChild(titulo);

    let totalMes = 0;

    grupo[mes].forEach(({ produto, descricao, valor, tipo, vencimento, i, parcelaIndex, isParcela, pago }) => {
      totalMes += valor;

      const icone = tipo === "Adubo" ? "leaf"
                  : tipo === "Fungicida" ? "bug"
                  : tipo === "Inseticida" ? "spray-can"
                  : tipo === "Herbicida" ? "recycle"
                  : "tag";

      // Determina a quantidade de botões
      let numBotoes = 1; // sempre tem 1 botão de ação
      if (!pago) numBotoes++; // se não estiver pago, pode ter botão de edição
      if (!isParcela || (isParcela && typeof parcelaIndex !== "undefined")) numBotoes++; // botão de excluir

      const div = document.createElement("div");
      div.className = `item botoes-${numBotoes}`;

      const span = document.createElement("span");
      span.innerHTML = `
        <i class="fas fa-${icone}"></i> 
        <strong>${produto}</strong> - R$ ${valor.toFixed(2)} (${tipo}) 
        ${descricao ? `<br><small style="color:#ccc;">${descricao}</small>` : ''}
        ${isParcela ? `<br><small>Venc: ${vencimento}</small>` : ''}
      `;

      const botoes = document.createElement("div");
      botoes.className = "botoes-tarefa";

      // Botão de ação (pagar ou desfazer)
      const botaoAcao = document.createElement("button");
      botaoAcao.className = `botao-circular verde`;
      botaoAcao.innerHTML = `<i class="fas ${pago ? 'fa-undo' : 'fa-check'}"></i>`;
      botaoAcao.onclick = () => {
        if (isParcela) {
          alternarParcela(i, parcelaIndex);
        } else {
          pago ? desfazerPagamento(i) : marcarPago(i);
        }
      };
      botoes.appendChild(botaoAcao);

      // Botão de editar (somente se não estiver pago)
      if (!pago) {
        const botaoEditar = document.createElement("button");
        botaoEditar.className = "botao-circular azul";
        botaoEditar.innerHTML = `<i class="fas fa-pen"></i>`;
        botaoEditar.onclick = () => editarFinanceiro(i, isParcela ? parcelaIndex : null);
        botoes.appendChild(botaoEditar);
      }

      // Botão de excluir
      const botaoExcluir = document.createElement("button");
      botaoExcluir.className = "botao-circular vermelho";
      botaoExcluir.innerHTML = `<i class="fas fa-trash"></i>`;
      botaoExcluir.onclick = () => confirmarExclusaoParcela(i, parcelaIndex);
      botoes.appendChild(botaoExcluir);

      div.appendChild(span);
      div.appendChild(botoes);
      container.appendChild(div);
    });

    const totalDiv = document.createElement("div");
    totalDiv.className = "grupo-data";
    totalDiv.innerHTML = `<span style="font-size:14px;">Total: R$ ${totalMes.toFixed(2)}</span>`;
    container.appendChild(totalDiv);
  }
}

function editarFinanceiro(index, parcelaIndex = null) {
  const g = gastos[index];
  if (!g) return;

  document.getElementById("dataFin").value = parcelaIndex !== null ? g.parcelasDetalhes[parcelaIndex].vencimento : g.data;
  document.getElementById("produtoFin").value = g.produto;
  document.getElementById("descricaoFin").value = g.descricao || "";
  document.getElementById("valorFin").value = parcelaIndex !== null ? g.parcelasDetalhes[parcelaIndex].valor : g.valor;
  document.getElementById("tipoFin").value = g.tipo;
  document.getElementById("parceladoFin").checked = !!g.parcelasDetalhes;
  document.getElementById("parcelasFin").style.display = !!g.parcelasDetalhes ? "block" : "none";
  document.getElementById("parcelasFin").value = g.parcelas || "";
  document.getElementById("parcelasFin").dataset.parcelaIndex = parcelaIndex !== null ? parcelaIndex : "";

  indiceEdicaoGasto = index;

  if (g.parcelasDetalhes && parcelaIndex !== null) {
    mostrarModalEditarParcela();
  } else {
    editarTodasParcelas = true;
  }

  document.getElementById("btnSalvarGasto").innerHTML = '<i class="fas fa-edit"></i> Salvar Edição';
  document.getElementById("btnCancelarEdicaoGasto").style.display = "inline-block";
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
    if (g.pago) totalPago += g.valor;
    else totalVencer += g.valor;
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
    if (!g.pago) return;
    categorias[g.tipo] = (categorias[g.tipo] || 0) + g.valor;
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
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                 "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
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
    // Excluir uma parcela específica
    document.getElementById("modalConfirmarExclusaoParcela").style.display = "flex";
    modalConfirmarExclusaoParcela.dataset.index = index;
    modalConfirmarExclusaoParcela.dataset.parcelaIndex = parcelaIndex;
  } else {
    // Excluir lançamento simples
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

function mostrarModalEditarParcela() {
  const modal = document.createElement("div");
  modal.id = "modalEditarParcela";
  modal.style.cssText = `
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: #000a;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  `;

  modal.innerHTML = `
    <div style="background: #2c2c2c; padding: 20px; border-radius: 10px; width: 90%; max-width: 320px; text-align: center;">
      <p style="color: white; font-size: 16px;">Editar:</p>
      <button onclick="confirmarEditarParcela(false)" class="botao-circular azul" style="margin: 10px 0;">Somente esta parcela</button><br>
      <button onclick="confirmarEditarParcela(true)" class="botao-circular verde" style="margin-bottom: 10px;">Todas as parcelas</button><br>
      <button onclick="fecharModalEditarParcela()" class="botao-circular vermelho">Cancelar</button>
    </div>
  `;

  document.body.appendChild(modal);
}

function confirmarEditarParcela(todas) {
  editarTodasParcelas = todas;
  fecharModalEditarParcela();
}

function fecharModalEditarParcela() {
  const modal = document.getElementById("modalEditarParcela");
  if (modal) modal.remove();
}

function limparCamposFinanceiro() {
  dataFin.value = "";
  produtoFin.value = "";
  descricaoFin.value = "";
  valorFin.value = "";
  tipoFin.value = "Adubo";
  parceladoFin.checked = false;
  parcelasFin.value = "";
  parcelasFin.style.display = "none";
  parcelasFin.dataset.parcelaIndex = "";
  indiceEdicaoGasto = null;
  editarTodasParcelas = false;
  document.getElementById("btnSalvarGasto").innerHTML = `<i class="fas fa-save"></i> Salvar Gasto`;
  document.getElementById("btnCancelarEdicaoGasto").style.display = "none";
}
