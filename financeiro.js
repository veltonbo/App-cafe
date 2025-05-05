// ===== VARIÁVEIS GLOBAIS =====
let gastos = [];
let graficoGastosChart = null;
let indiceEdicaoFinanceiro = null;
let parcelaEditando = null;
let indiceEdicaoFinanceiro = null;
let editarTodasParcelas = false;
let editarParcelaIndex = null;

// ===== CARREGAR FINANCEIRO =====
function carregarFinanceiro() {
  db.ref("Financeiro").on("value", snap => {
    gastos = snap.exists() ? snap.val() : [];
    atualizarFinanceiro();
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

  // ===== EDIÇÃO DE LANÇAMENTO EXISTENTE =====
  if (indiceEdicaoFinanceiro !== null) {
    const gasto = gastos[indiceEdicaoFinanceiro];
    gasto.produto = produto;
    gasto.descricao = descricao;
    gasto.tipo = tipo;

    if (gasto.parcelasDetalhes && editarParcelaIndex !== null && !editarTodasParcelas) {
      // Editar apenas a parcela selecionada
      gasto.parcelasDetalhes[editarParcelaIndex].valor = valor;
      gasto.parcelasDetalhes[editarParcelaIndex].vencimento = data;
    } else if (gasto.parcelasDetalhes && editarTodasParcelas) {
      // Editar todas as parcelas
      const valorParcela = parseFloat((valor / gasto.parcelasDetalhes.length).toFixed(2));
      const base = new Date(data);
      gasto.parcelasDetalhes.forEach((p, i) => {
        const venc = new Date(base);
        venc.setMonth(base.getMonth() + i);
        p.valor = valorParcela;
        p.vencimento = venc.toISOString().split("T")[0];
      });
    } else {
      // Lançamento único (sem parcelas)
      gasto.data = data;
      gasto.valor = valor;
    }

    gastos[indiceEdicaoFinanceiro] = gasto;
    db.ref("Financeiro").set(gastos);
    atualizarFinanceiro();
    cancelarEdicaoFinanceiro();
    return;
  }

  // ===== NOVO LANÇAMENTO =====
  const novo = {
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
    const base = new Date(data);
    novo.parcelasDetalhes = [];

    for (let i = 0; i < numParcelas; i++) {
      const venc = new Date(base);
      venc.setMonth(venc.getMonth() + i);
      novo.parcelasDetalhes.push({
        numero: i + 1,
        valor: valorParcela,
        vencimento: venc.toISOString().split("T")[0],
        pago: false
      });
    }
  }

  gastos.push(novo);
  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();
  limparCamposFinanceiro();
}

// ===== CANCELAR EDIÇÃO =====
function cancelarEdicaoFinanceiro() {
  indiceEdicaoFinanceiro = null;
  editarTodasParcelas = false;
  editarParcelaIndex = null;
  document.getElementById("btnCancelarEdicaoFinanceiro").style.display = "none";
  document.getElementById("btnSalvarAplicacao").innerText = "Salvar Gasto";
  limparCamposFinanceiro();
}

// ===== LIMPAR CAMPOS =====
function limparCamposFinanceiro() {
  dataFin.value = "";
  produtoFin.value = "";
  descricaoFin.value = "";
  valorFin.value = "";
  tipoFin.value = "Adubo";
  parceladoFin.checked = false;
  parcelasFin.value = "";
  mostrarParcelas();
}

// ===== MOSTRAR PARCELAS =====
function mostrarParcelas() {
  parcelasFin.style.display = parceladoFin.checked ? "inline-block" : "none";
}

// ===== TOGGLE FILTROS =====
function toggleFiltrosFinanceiro() {
  const filtros = document.getElementById("filtrosFinanceiro");
  filtros.style.display = filtros.style.display === "none" ? "block" : "none";
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

// ===== RENDERIZAR FINANCEIRO =====
function renderizarFinanceiro(grupo, container, pago) {
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

      const div = document.createElement("div");
      div.className = "item fade-in";
      div.classList.add(isParcela || !pago ? "botoes-3" : "botoes-2");

      let botoes = "";

      if (isParcela) {
        botoes += `<button class="botao-circular verde" onclick="alternarParcela(${i}, ${parcelaIndex})">
                    <i class="fas ${pago ? 'fa-undo' : 'fa-check'}"></i>
                  </button>`;
        if (!pago) {
          botoes += `<button class="botao-circular azul" onclick="editarParcela(${i}, ${parcelaIndex})">
                      <i class="fas fa-edit"></i>
                    </button>`;
        }
        botoes += `<button class="botao-circular vermelho" onclick="confirmarExclusaoParcela(${i}, ${parcelaIndex})">
                    <i class="fas fa-trash"></i>
                  </button>`;
      } else {
        if (pago) {
          botoes += `<button class="botao-circular verde" onclick="desfazerPagamento(${i})"><i class="fas fa-undo"></i></button>`;
        } else {
          botoes += `<button class="botao-circular verde" onclick="marcarPago(${i})"><i class="fas fa-check"></i></button>`;
          botoes += `<button class="botao-circular azul" onclick="editarFinanceiro(${i})"><i class="fas fa-edit"></i></button>`;
        }
        botoes += `<button class="botao-circular vermelho" onclick="confirmarExclusaoParcela(${i})"><i class="fas fa-trash"></i></button>`;
      }

      div.innerHTML = `
        <span>
          <i class="fas fa-${icone}"></i> 
          <strong>${produto}</strong> - R$ ${valor.toFixed(2)} (${tipo}) 
          ${descricao ? `<br><small style="color:#ccc;">${descricao}</small>` : ''}
          ${isParcela ? `<br><small>Venc: ${vencimento}</small>` : ''}
        </span>
        <div class="botoes-tarefa">${botoes}</div>
      `;
      container.appendChild(div);
    });

    const totalDiv = document.createElement("div");
    totalDiv.className = "grupo-data";
    totalDiv.innerHTML = `<span style="font-size:14px;">Total: R$ ${totalMes.toFixed(2)}</span>`;
    container.appendChild(totalDiv);
  }
}

// ===== RESUMO E GRÁFICO =====
function gerarResumoFinanceiro() {
  let totalPago = 0;
  let totalVencer = 0;
  gastos.forEach(g => {
    if (g.parcelasDetalhes?.length) {
      g.parcelasDetalhes.forEach(p => p.pago ? totalPago += p.valor : totalVencer += p.valor);
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
    if (g.parcelasDetalhes?.length) {
      g.parcelasDetalhes.forEach(p => {
        if (p.pago) categorias[g.tipo] = (categorias[g.tipo] || 0) + p.valor;
      });
    } else {
      if (g.pago) categorias[g.tipo] = (categorias[g.tipo] || 0) + g.valor;
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
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${meses[parseInt(mesNum) - 1]} de ${ano}`;
}

// ===== EDITAR LANÇAMENTO COMPLETO =====
function editarFinanceiro(index) {
  const g = gastos[index];
  if (!g) return;

  dataFin.value = g.data;
  produtoFin.value = g.produto;
  descricaoFin.value = g.descricao || "";
  valorFin.value = g.valor;
  tipoFin.value = g.tipo;
  parceladoFin.checked = !!g.parcelasDetalhes;
  parcelasFin.style.display = parceladoFin.checked ? "block" : "none";
  parcelasFin.value = g.parcelas || "";

  document.getElementById("btnSalvarAplicacao").innerText = "Salvar Edição";
  document.getElementById("btnSalvarAplicacao").onclick = () => salvarEdicaoFinanceiro(index);
}

function salvarEdicaoFinanceiro(index) {
  const g = gastos[index];
  if (!g) return;

  const atualizado = {
    data: dataFin.value,
    produto: produtoFin.value.trim(),
    descricao: descricaoFin.value.trim(),
    valor: parseFloat(valorFin.value),
    tipo: tipoFin.value,
    pago: g.pago,
    parcelas: parceladoFin.checked ? parseInt(parcelasFin.value) || 1 : 1
  };

  if (!atualizado.data || !atualizado.produto || isNaN(atualizado.valor)) {
    alert("Preencha todos os campos corretamente!");
    return;
  }

  if (atualizado.parcelas > 1) {
    const valorParcela = parseFloat((atualizado.valor / atualizado.parcelas).toFixed(2));
    const parcelas = [];
    const dataBase = new Date(atualizado.data);

    for (let i = 0; i < atualizado.parcelas; i++) {
      const vencimento = new Date(dataBase);
      vencimento.setMonth(vencimento.getMonth() + i);
      parcelas.push({
        numero: i + 1,
        valor: valorParcela,
        vencimento: vencimento.toISOString().split("T")[0],
        pago: false
      });
    }

    atualizado.parcelasDetalhes = parcelas;
  }

  gastos[index] = atualizado;
  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();
  limparCamposFinanceiro();
}

function editarParcela(index, parcelaIndex) {
  const gasto = gastos[index];
  if (!gasto || !gasto.parcelasDetalhes || parcelaIndex == null) return;

  // Armazena os índices para uso posterior
  indiceEdicaoFinanceiro = index;
  editarParcelaIndex = parcelaIndex;

  // Exibe o modal para escolher o tipo de edição
  const modal = document.getElementById("modalEditarParcela");
  if (modal) {
    modal.style.display = "flex";
  }
}

// ===== EXCLUSÃO DE PARCELA OU LANÇAMENTO =====
function confirmarExclusaoParcela(index, parcelaIndex = null) {
  if (parcelaIndex !== null && gastos[index]?.parcelasDetalhes) {
    modalConfirmarExclusaoParcela.style.display = "flex";
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
    if (gastos[index].parcelasDetalhes.length === 0) gastos.splice(index, 1);
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

// ===== EXPORTAÇÃO CSV E PDF =====
function exportarFinanceiroCSV() {
  if (!gastos.length) return alert("Nenhum dado disponível para exportação.");

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

// ===== TOGGLE FILTROS =====
function toggleFiltrosFinanceiro() {
  const filtros = document.getElementById("filtrosFinanceiro");
  filtros.style.display = filtros.style.display === "none" ? "block" : "none";
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
  document.getElementById("btnSalvarAplicacao").innerText = "Salvar Aplicação";
  document.getElementById("btnSalvarAplicacao").onclick = adicionarFinanceiro;
}

function confirmarEdicaoParcelaUnica() {
  editarTodasParcelas = false;
  iniciarEdicaoFinanceiro();
  fecharModalEdicaoParcelas();
}

function confirmarEdicaoTodasParcelas() {
  editarTodasParcelas = true;
  iniciarEdicaoFinanceiro();
  fecharModalEdicaoParcelas();
}

function fecharModalEdicaoParcelas() {
  document.getElementById("modalEscolherEdicaoParcelas").style.display = "none";
}
