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
    const original = gastos[indiceEdicaoGasto];

    if (editarTodasParcelas && original.parcelasDetalhes) {
      original.parcelasDetalhes.forEach((parcela, idx) => {
        parcela.valor = parseFloat((valor / numParcelas).toFixed(2));
        parcela.vencimento = new Date(data);
        parcela.vencimento.setMonth(parcela.vencimento.getMonth() + idx);
        parcela.vencimento = parcela.vencimento.toISOString().split("T")[0];
      });
    } else if (!editarTodasParcelas && original.parcelasDetalhes) {
      const idx = parseInt(parcelasFin.dataset.parcelaIndex);
      if (!isNaN(idx) && original.parcelasDetalhes[idx]) {
        original.parcelasDetalhes[idx].valor = valor;
        original.parcelasDetalhes[idx].vencimento = data;
      }
    } else {
      original.data = data;
      original.produto = produto;
      original.descricao = descricao;
      original.valor = valor;
      original.tipo = tipo;
    }

    indiceEdicaoGasto = null;
    editarTodasParcelas = false;
  } else {
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
      novoGasto.parcelasDetalhes = Array.from({ length: numParcelas }, (_, i) => ({
        numero: i + 1,
        valor: parseFloat((valor / numParcelas).toFixed(2)),
        vencimento: new Date(new Date(data).setMonth(new Date(data).getMonth() + i))
          .toISOString()
          .split("T")[0],
        pago: false
      }));
    }

    gastos.push(novoGasto);
  }

  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();
  limparFormularioFinanceiro();
}

// ===== LIMPAR FORMULÁRIO =====
function limparFormularioFinanceiro() {
  dataFin.value = "";
  produtoFin.value = "";
  descricaoFin.value = "";
  valorFin.value = "";
  tipoFin.value = "Adubo";
  parcelasFin.value = "";
  parcelasFin.dataset.parcelaIndex = "";
  parceladoFin.checked = false;
  mostrarParcelas();
  document.getElementById("formularioFinanceiro").style.display = "none";
  document.getElementById("btnSalvarFinanceiro").innerHTML = '<i class="fas fa-save"></i> Salvar Gasto';
  document.getElementById("btnCancelarFinanceiro").style.display = "none";
}

// ===== ATUALIZAR LISTAGEM =====
function atualizarFinanceiro() {
  const venc = document.getElementById("financeiroVencer");
  const pagos = document.getElementById("financeiroPago");
  venc.innerHTML = "";
  pagos.innerHTML = "";

  const dadosVencer = {};
  const dadosPago = {};

  gastos.forEach((g, index) => {
    if (g.parcelasDetalhes) {
      g.parcelasDetalhes.forEach((p, parcelaIndex) => {
        const grupo = p.pago ? dadosPago : dadosVencer;
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
      const grupo = g.pago ? dadosPago : dadosVencer;
      const mes = g.data.slice(0, 7);
      if (!grupo[mes]) grupo[mes] = [];
      grupo[mes].push({ ...g, i: index, isParcela: false });
    }
  });

  renderizarFinanceiro(dadosVencer, venc, false);
  renderizarFinanceiro(dadosPago, pagos, true);
  gerarResumoFinanceiro();
}

// ===== RENDERIZAR FINANCEIRO =====
function renderizarFinanceiro(grupo, container, pago) {
  const mesesOrdenados = Object.keys(grupo).sort((a, b) => b.localeCompare(a));
  for (const mes of mesesOrdenados) {
    const titulo = document.createElement("div");
    titulo.className = "grupo-data";
    titulo.innerText = formatarMes(mes);
    container.appendChild(titulo);

    grupo[mes].forEach(({ produto, descricao, valor, tipo, vencimento, i, parcelaIndex, isParcela, pago }) => {
      const div = document.createElement("div");
      div.className = `item ${isParcela ? 'botoes-3' : 'botoes-2'}`;
      div.innerHTML = `
        <span>
          <strong>${produto}</strong> - ${formatarReal(valor)} (${tipo}) 
          ${descricao ? `<br><small>${descricao}</small>` : ''}
          ${isParcela ? `<br><small>Venc: ${vencimento}</small>` : ''}
        </span>
        <div class="botoes-tarefa">
          ${isParcela ? `
            <button class="botao-circular verde" onclick="alternarParcela(${i}, ${parcelaIndex})">
              <i class="fas ${pago ? 'fa-undo' : 'fa-check'}"></i>
            </button>
            <button class="botao-circular vermelho" onclick="confirmarExclusaoParcela(${i}, ${parcelaIndex})">
              <i class="fas fa-trash"></i>
            </button>
          ` : `
            <button class="botao-circular verde" onclick="marcarPago(${i})">
              <i class="fas fa-check"></i>
            </button>
            <button class="botao-circular vermelho" onclick="confirmarExclusao(${i})">
              <i class="fas fa-trash"></i>
            </button>
          `}
        </div>
      `;
      container.appendChild(div);
    });
  }
}

// ===== EDITAR LANÇAMENTO OU PARCELA =====
function editarFinanceiro(index, parcelaIndex = null) {
  const gasto = gastos[index];
  if (!gasto) return;

  const parcela = parcelaIndex !== null ? gasto.parcelasDetalhes?.[parcelaIndex] : null;

  dataFin.value = parcela ? parcela.vencimento : gasto.data;
  produtoFin.value = gasto.produto;
  descricaoFin.value = gasto.descricao || "";
  valorFin.value = parcela ? parcela.valor : gasto.valor;
  tipoFin.value = gasto.tipo;
  parceladoFin.checked = !!gasto.parcelasDetalhes;
  parcelasFin.style.display = parceladoFin.checked ? "block" : "none";
  parcelasFin.value = gasto.parcelas || "";
  parcelasFin.dataset.parcelaIndex = parcelaIndex !== null ? parcelaIndex : "";

  indiceEdicaoGasto = index;
  editarTodasParcelas = parcelaIndex === null;

  document.getElementById("formularioFinanceiro").style.display = "block";
  document.getElementById("btnSalvarFinanceiro").innerHTML = '<i class="fas fa-edit"></i> Salvar Edição';
  document.getElementById("btnCancelarFinanceiro").style.display = "inline-block";
}

// ===== CANCELAR EDIÇÃO =====
function cancelarEdicaoFinanceiro() {
  indiceEdicaoGasto = null;
  editarTodasParcelas = false;
  parcelasFin.dataset.parcelaIndex = "";

  dataFin.value = "";
  produtoFin.value = "";
  descricaoFin.value = "";
  valorFin.value = "";
  tipoFin.value = "Adubo";
  parcelasFin.value = "";
  parceladoFin.checked = false;
  mostrarParcelas();
  document.getElementById("formularioFinanceiro").style.display = "none";

  document.getElementById("btnSalvarFinanceiro").innerHTML = '<i class="fas fa-save"></i> Salvar Gasto';
  document.getElementById("btnCancelarFinanceiro").style.display = "none";
}

// ===== ALTERNAR PAGAMENTO DE UMA PARCELA =====
function alternarParcela(gastoIndex, parcelaIndex) {
  const gasto = gastos[gastoIndex];
  if (!gasto || !gasto.parcelasDetalhes) return;
  
  const parcela = gasto.parcelasDetalhes[parcelaIndex];
  parcela.pago = !parcela.pago;

  gasto.pago = gasto.parcelasDetalhes.every(p => p.pago);

  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();
}

// ===== CONFIRMAR EXCLUSÃO DE PARCELA OU LANÇAMENTO =====
function confirmarExclusaoParcela(index, parcelaIndex = null) {
  if (parcelaIndex !== null) {
    excluirApenasParcela(index, parcelaIndex);
  } else {
    excluirTodasParcelas(index);
  }
}

// ===== EXCLUIR APENAS UMA PARCELA =====
function excluirApenasParcela(index, parcelaIndex) {
  if (gastos[index]?.parcelasDetalhes) {
    gastos[index].parcelasDetalhes.splice(parcelaIndex, 1);

    if (gastos[index].parcelasDetalhes.length === 0) {
      gastos.splice(index, 1);
    }
  }

  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();
}

// ===== EXCLUIR TODAS AS PARCELAS OU GASTO =====
function excluirTodasParcelas(index) {
  if (gastos[index]) {
    gastos.splice(index, 1);
  }

  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();
}

// ===== EXCLUIR GASTO SIMPLES (SEM PARCELAS) =====
function confirmarExclusao(index) {
  if (confirm("Deseja excluir esse lançamento financeiro?")) {
    gastos.splice(index, 1);
    db.ref("Financeiro").set(gastos);
    atualizarFinanceiro();
  }
}

// ===== GERAR RESUMO FINANCEIRO (Topo) =====
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
    <div style="display: flex; gap: 20px; flex-wrap: wrap;">
      <span style="color: #4caf50;">Total Pago: <strong>${formatarReal(totalPago)}</strong></span>
      <span style="color: #ff9800;">A Vencer: <strong>${formatarReal(totalVencer)}</strong></span>
      <span style="color: #29b6f6;">Geral: <strong>${formatarReal(totalPago + totalVencer)}</strong></span>
    </div>
  `;
}

// ===== GERAR GRÁFICO DE GASTOS PAGOS =====
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

  graficoGastosChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
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

// ===== EXPORTAR FINANCEIRO COMO PDF =====
function exportarFinanceiroPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("Relatório Financeiro", 20, 20);
  let y = 40;

  gastos.forEach(g => {
    doc.text(`${g.data} - ${g.produto} - R$ ${g.valor.toFixed(2)} - ${g.pago ? "Pago" : "A Vencer"}`, 20, y);
    y += 10;
  });

  doc.save("relatorio_financeiro.pdf");
}

// ===== INICIALIZAR MENU FINANCEIRO =====
function inicializarFinanceiro() {
  carregarFinanceiro();
  gerarResumoFinanceiro();
  gerarGraficoFinanceiro();
}

// ===== CARREGAR FINANCEIRO DO BANCO DE DADOS =====
function carregarFinanceiro() {
  db.ref("Financeiro").on("value", (snapshot) => {
    const data = snapshot.val();
    gastos = Array.isArray(data) ? data : [];
    atualizarFinanceiro();
  });
}

// ===== ATUALIZAR LISTAGEM DE LANÇAMENTOS =====
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

// ===== RENDERIZAR LISTAGEM FINANCEIRO =====
function renderizarFinanceiro(grupo, container, pago) {
  const mesesOrdenados = Object.keys(grupo).sort((a, b) => b.localeCompare(a)); // Ordem decrescente

  mesesOrdenados.forEach(mes => {
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
      div.className = `item ${isParcela ? 'botoes-3' : 'botoes-2'}`;
      div.innerHTML = `
        <span>
          <i class="fas fa-${icone}"></i> 
          <strong>${produto}</strong> - ${formatarReal(valor)} (${tipo}) 
          ${descricao ? `<br><small>${descricao}</small>` : ''}
          ${isParcela ? `<br><small>Venc: ${vencimento}</small>` : ''}
        </span>
        <div class="botoes-tarefa">
          ${isParcela ? `
            <button class="botao-circular verde" onclick="alternarParcela(${i}, ${parcelaIndex})">
              <i class="fas ${pago ? 'fa-undo' : 'fa-check'}"></i>
            </button>
            ${!pago ? `
              <button class="botao-circular azul" onclick="editarFinanceiro(${i}, ${parcelaIndex})">
                <i class="fas fa-edit"></i>
              </button>` : ''}
            <button class="botao-circular vermelho" onclick="confirmarExclusaoParcela(${i}, ${parcelaIndex})">
              <i class="fas fa-trash"></i>
            </button>
          ` : pago ? `
            <button class="botao-circular laranja" onclick="desfazerPagamento(${i})">
              <i class="fas fa-undo"></i>
            </button>
            <button class="botao-circular vermelho" onclick="confirmarExclusaoParcela(${i}, null)">
              <i class="fas fa-trash"></i>
            </button>
          ` : `
            <button class="botao-circular verde" onclick="marcarPago(${i})">
              <i class="fas fa-check"></i>
            </button>
            <button class="botao-circular azul" onclick="editarFinanceiro(${i})">
              <i class="fas fa-edit"></i>
            </button>
            <button class="botao-circular vermelho" onclick="confirmarExclusaoParcela(${i}, null)">
              <i class="fas fa-trash"></i>
            </button>
          `}
        </div>
      `;
      container.appendChild(div);
    });

    const totalDiv = document.createElement("div");
    totalDiv.className = "grupo-data";
    totalDiv.innerHTML = `<span style="font-size:14px;">Total: ${formatarReal(totalMes)}</span>`;
    container.appendChild(totalDiv);
  });
}

// ===== FORMATAÇÃO DE MOEDA BRASILEIRA =====
function formatarReal(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ===== FORMATAÇÃO DE MÊS =====
function formatarMes(mes) {
  const [ano, mesNum] = mes.split("-");
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  return `${meses[parseInt(mesNum) - 1]} de ${ano}`;
}

// ===== INICIAR FINANCEIRO AO CARREGAR =====
document.addEventListener("DOMContentLoaded", () => {
  inicializarFinanceiro();
});
