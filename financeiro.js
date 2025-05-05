// ===== VARIÁVEIS =====
let gastos = [];
let graficoGastosChart = null;
let indiceEdicaoGasto = null;
let editarTodasParcelas = false;

// ===== CARREGAR FINANCEIRO =====
function carregarFinanceiro() {
  db.ref("Financeiro").on("value", snap => {
    gastos = snap.exists() ? snap.val() : [];
    atualizarFinanceiro();
  });
}

// ===== MOSTRAR PARCELAS =====
function mostrarParcelas() {
  const isParcelado = document.getElementById("parceladoFin").checked;
  document.getElementById("parcelasFin").style.display = isParcelado ? "inline-block" : "none";
}

// ===== TOGGLE FILTROS =====
function toggleFiltrosFinanceiro() {
  const div = document.getElementById("filtrosFinanceiro");
  div.style.display = div.style.display === "none" ? "block" : "none";
}

// ===== CANCELAR EDIÇÃO =====
function cancelarEdicaoGasto() {
  indiceEdicaoGasto = null;
  editarTodasParcelas = false;
  limparCamposFinanceiro();
  document.getElementById("btnSalvarGasto").innerHTML = '<i class="fas fa-save"></i> Salvar Gasto';
  document.getElementById("btnCancelarEdicaoGasto").style.display = "none";
}

// ===== ADICIONAR OU EDITAR GASTO =====
function adicionarFinanceiro() {
  const data = document.getElementById("dataFin").value;
  const produto = document.getElementById("produtoFin").value.trim();
  const descricao = document.getElementById("descricaoFin").value.trim();
  const valor = parseFloat(document.getElementById("valorFin").value);
  const tipo = document.getElementById("tipoFin").value;
  const parcelado = document.getElementById("parceladoFin").checked;
  const numParcelas = parcelado ? parseInt(document.getElementById("parcelasFin").value) || 1 : 1;

  if (!data || !produto || isNaN(valor)) {
    alert("Preencha os campos obrigatórios.");
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

  if (indiceEdicaoGasto !== null) {
    gastos[indiceEdicaoGasto] = novoGasto;
    indiceEdicaoGasto = null;
  } else {
    gastos.push(novoGasto);
  }

  db.ref("Financeiro").set(gastos);
  limparCamposFinanceiro();
  atualizarFinanceiro();
}

// ===== CANCELAR EDIÇÃO =====
function cancelarEdicaoGasto() {
  limparCamposFinanceiro();
}

// ===== LIMPAR CAMPOS =====
function limparCamposFinanceiro() {
  document.getElementById("dataFin").value = "";
  document.getElementById("produtoFin").value = "";
  document.getElementById("descricaoFin").value = "";
  document.getElementById("valorFin").value = "";
  document.getElementById("tipoFin").value = "Adubo";
  document.getElementById("parceladoFin").checked = false;
  document.getElementById("parcelasFin").value = "";
  document.getElementById("parcelasFin").style.display = "none";
  indiceEdicaoGasto = null;
  document.getElementById("btnCancelarEdicaoGasto").style.display = "none";
  document.getElementById("btnSalvarGasto").innerHTML = '<i class="fas fa-save"></i> Salvar Gasto';
}

// ===== MODAL CONFIRMAR EXCLUSÃO =====
function confirmarExclusaoParcela(index, parcelaIndex) {
  document.getElementById("modalConfirmarExclusaoParcela").style.display = "flex";
  modalConfirmarExclusaoParcela.dataset.index = index;
  modalConfirmarExclusaoParcela.dataset.parcelaIndex = parcelaIndex;
}

function excluirApenasParcela() {
  const index = parseInt(modalConfirmarExclusaoParcela.dataset.index);
  const parcelaIndex = parseInt(modalConfirmarExclusaoParcela.dataset.parcelaIndex);

  if (!isNaN(index) && !isNaN(parcelaIndex)) {
    const gasto = gastos[index];
    if (gasto?.parcelasDetalhes) {
      gasto.parcelasDetalhes.splice(parcelaIndex, 1);
      if (gasto.parcelasDetalhes.length === 0) gastos.splice(index, 1);
      db.ref("Financeiro").set(gastos);
      atualizarFinanceiro();
    }
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
  document.getElementById("modalConfirmarExclusaoParcela").style.display = "none";
}

// ===== MODAL EDITAR PARCELA =====
function mostrarModalEscolherEdicao(index, parcelaIndex) {
  document.getElementById("modalEscolherEdicao").style.display = "flex";
  modalEscolherEdicao.dataset.index = index;
  modalEscolherEdicao.dataset.parcelaIndex = parcelaIndex;
}

function editarSomenteParcela() {
  const index = parseInt(modalEscolherEdicao.dataset.index);
  const parcelaIndex = parseInt(modalEscolherEdicao.dataset.parcelaIndex);
  if (!isNaN(index) && !isNaN(parcelaIndex)) editarFinanceiro(index, parcelaIndex, false);
  fecharModalEscolherEdicao();
}

function editarTodasParcelas() {
  const index = parseInt(modalEscolherEdicao.dataset.index);
  if (!isNaN(index)) editarFinanceiro(index, null, true);
  fecharModalEscolherEdicao();
}

function fecharModalEscolherEdicao() {
  document.getElementById("modalEscolherEdicao").style.display = "none";
}
