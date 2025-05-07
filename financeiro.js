// ===== VARIÁVEIS GLOBAIS =====
let gastos = [];
let indiceEdicaoGasto = null;

// ===== INICIALIZAR MENU FINANCEIRO =====
function inicializarFinanceiro() {
  carregarFinanceiro();
}

// ===== CARREGAR GASTOS (Simulação) =====
function carregarFinanceiro() {
  atualizarFinanceiro();
}

// ===== ADICIONAR OU EDITAR GASTO =====
function adicionarFinanceiro() {
  const data = dataFin.value;
  const produto = produtoFin.value.trim();
  const descricao = descricaoFin.value.trim();
  const valor = parseFloat(valorFin.value);
  const tipo = tipoFin.value;

  if (!data || !produto || isNaN(valor)) {
    alert("Preencha todos os campos corretamente!");
    return;
  }

  if (indiceEdicaoGasto !== null) {
    gastos[indiceEdicaoGasto] = { data, produto, descricao, valor, tipo, pago: false };
  } else {
    gastos.push({ data, produto, descricao, valor, tipo, pago: false });
  }

  atualizarFinanceiro();
  resetarFormularioFinanceiro();
}

// ===== ATUALIZAR LISTAGEM =====
function atualizarFinanceiro() {
  const listaVencer = document.getElementById("financeiroVencer");
  listaVencer.innerHTML = "";
  gastos.forEach((gasto, index) => {
    const item = document.createElement("div");
    item.className = "item-financeiro";
    item.innerHTML = `
      <span>${gasto.data} - ${gasto.produto} (${gasto.tipo}) - R$ ${gasto.valor.toFixed(2)}</span>
      <button onclick="editarGasto(${index})">Editar</button>
      <button onclick="excluirGasto(${index})">Excluir</button>
    `;
    listaVencer.appendChild(item);
  });
}

// ===== EDITAR GASTO =====
function editarGasto(index) {
  const gasto = gastos[index];
  dataFin.value = gasto.data;
  produtoFin.value = gasto.produto;
  descricaoFin.value = gasto.descricao;
  valorFin.value = gasto.valor;
  tipoFin.value = gasto.tipo;
  indiceEdicaoGasto = index;
}

// ===== EXCLUIR GASTO =====
function excluirGasto(index) {
  gastos.splice(index, 1);
  atualizarFinanceiro();
}

// ===== RESETAR FORMULÁRIO =====
function resetarFormularioFinanceiro() {
  dataFin.value = "";
  produtoFin.value = "";
  descricaoFin.value = "";
  valorFin.value = "";
  tipoFin.value = "Adubo";
  indiceEdicaoGasto = null;
}
