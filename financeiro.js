// ===== VARIÁVEIS GLOBAIS =====
let gastos = [];
let indiceEdicaoGasto = null;

// ===== INICIALIZAR FINANCEIRO =====
function inicializarFinanceiro() {
  carregarFinanceiro();
  document.getElementById("btnCancelarFinanceiro").addEventListener("click", cancelarEdicaoFinanceiro);
}

// ===== ALTERNAR FORMULÁRIO FINANCEIRO =====
function alternarFormularioFinanceiro() {
  const form = document.getElementById("formularioFinanceiro");
  form.style.display = form.style.display === "none" ? "block" : "none";
  resetarFormularioFinanceiro();
}

// ===== MOSTRAR CAMPOS DE PARCELAS =====
function mostrarCamposParcelas() {
  const camposParcelas = document.getElementById("camposParcelas");
  const parcelado = document.getElementById("parceladoFin").checked;
  camposParcelas.style.display = parcelado ? "block" : "none";
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
    // Editar gasto existente
    gastos[indiceEdicaoGasto] = { data, produto, descricao, valor, tipo, parcelado, parcelas: numParcelas };
    indiceEdicaoGasto = null;
  } else {
    // Adicionar novo gasto
    gastos.push({ data, produto, descricao, valor, tipo, parcelado, parcelas: numParcelas });
  }

  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();
  resetarFormularioFinanceiro();
  alternarFormularioFinanceiro();
}

// ===== CANCELAR EDIÇÃO =====
function cancelarEdicaoFinanceiro() {
  resetarFormularioFinanceiro();
  alternarFormularioFinanceiro();
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
  mostrarCamposParcelas();
  indiceEdicaoGasto = null;
  document.getElementById("btnCancelarFinanceiro").style.display = "none";
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
  parceladoFin.checked = gasto.parcelado;
  mostrarCamposParcelas();
  parcelasFin.value = gasto.parcelas || "";

  indiceEdicaoGasto = index;
  document.getElementById("btnCancelarFinanceiro").style.display = "inline-block";
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
