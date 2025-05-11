// ===== VARIÁVEIS GLOBAIS =====
let gastos = [];
let indiceEdicaoGasto = null;
let editarTodasParcelas = false;

// ===== INICIALIZAR FINANCEIRO =====
function inicializarFinanceiro() {
  carregarFinanceiro();
  document.getElementById("btnCancelarFinanceiro").addEventListener("click", cancelarEdicaoFinanceiro);
}

// ===== CARREGAR FINANCEIRO =====
function carregarFinanceiro() {
  db.ref("Financeiro").on("value", (snapshot) => {
    const dados = snapshot.val();
    gastos = dados ? Object.values(dados) : [];
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

  if (!data || !produto || isNaN(valor) || valor <= 0) {
    alert("Preencha todos os campos corretamente!");
    return;
  }

  if (indiceEdicaoGasto !== null) {
    editarGastoExistente(data, produto, descricao, valor, tipo, numParcelas);
  } else {
    adicionarNovoGasto(data, produto, descricao, valor, tipo, numParcelas);
  }

  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();
  resetarFormularioFinanceiro();
}

// ===== ADICIONAR NOVO GASTO =====
function adicionarNovoGasto(data, produto, descricao, valor, tipo, numParcelas) {
  const novoGasto = {
    data,
    produto,
    descricao,
    valor,
    tipo,
    pago: false,
    parcelas: numParcelas,
    parcelasDetalhes: numParcelas > 1 ? gerarParcelas(data, valor, numParcelas) : []
  };

  gastos.push(novoGasto);
}

// ===== EDITAR GASTO EXISTENTE =====
function editarGastoExistente(data, produto, descricao, valor, tipo, numParcelas) {
  const gasto = gastos[indiceEdicaoGasto];
  if (!gasto) return;

  gasto.data = data;
  gasto.produto = produto;
  gasto.descricao = descricao;
  gasto.valor = valor;
  gasto.tipo = tipo;

  if (numParcelas > 1) {
    // Permitir editar todas as parcelas ou apenas uma específica
    if (editarTodasParcelas || !gasto.parcelasDetalhes.length) {
      gasto.parcelasDetalhes = gerarParcelas(data, valor, numParcelas);
    }
  } else {
    gasto.parcelasDetalhes = [];
  }
}

// ===== GERAR PARCELAS =====
function gerarParcelas(data, valor, numParcelas) {
  const valorParcela = parseFloat((valor / numParcelas).toFixed(2));
  const dataBase = new Date(data);
  return Array.from({ length: numParcelas }, (_, i) => {
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

// ===== RESETAR FORMULÁRIO =====
function resetarFormularioFinanceiro() {
  dataFin.value = "";
  produtoFin.value = "";
  descricaoFin.value = "";
  valorFin.value = "";
  tipoFin.value = "Adubo";
  parcelasFin.value = "";
  parceladoFin.checked = false;
  editarTodasParcelas = false;
  indiceEdicaoGasto = null;
  document.getElementById("formularioFinanceiro").style.display = "none";
  document.getElementById("btnSalvarFinanceiro").innerText = "Salvar Gasto";
}

// ===== CANCELAR EDIÇÃO =====
function cancelarEdicaoFinanceiro() {
  resetarFormularioFinanceiro();
}

// ===== ATUALIZAR LISTAGEM DE GASTOS =====
function atualizarFinanceiro() {
  const lista = document.getElementById("financeiroLista");
  lista.innerHTML = '';

  gastos.forEach((gasto, i) => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <span>${gasto.data} - ${gasto.produto} - R$ ${gasto.valor.toFixed(2)} (${gasto.tipo})</span>
      <div class="botoes-financeiro">
        <button class="botao-circular azul" onclick="editarFinanceiro(${i})"><i class="fas fa-edit"></i></button>
        <button class="botao-circular vermelho" onclick="excluirFinanceiro(${i})"><i class="fas fa-trash"></i></button>
      </div>
    `;
    lista.appendChild(item);
  });
}

// ===== EDITAR GASTO =====
function editarFinanceiro(index) {
  const gasto = gastos[index];
  if (!gasto) return;

  dataFin.value = gasto.data;
  produtoFin.value = gasto.produto;
  descricaoFin.value = gasto.descricao || "";
  valorFin.value = gasto.valor;
  tipoFin.value = gasto.tipo;
  indiceEdicaoGasto = index;
  editarTodasParcelas = false;

  document.getElementById("btnSalvarFinanceiro").innerText = "Salvar Edição";
  document.getElementById("formularioFinanceiro").style.display = "block";
}

// ===== EXCLUIR GASTO =====
function excluirFinanceiro(index) {
  if (!confirm("Deseja excluir este lançamento financeiro?")) return;
  gastos.splice(index, 1);
  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();
}

// ===== INICIALIZAR FINANCEIRO =====
document.addEventListener("dadosCarregados", inicializarFinanceiro);
