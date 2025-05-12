// ===== VARIÁVEIS GLOBAIS =====
let gastos = [];
let indiceEdicaoGasto = null;

// ===== CARREGAR FINANCEIRO =====
async function carregarFinanceiro() {
  const cache = localStorage.getItem('financeiro');
  if (cache) {
    gastos = JSON.parse(cache);
    atualizarFinanceiro();
  }

  const snapshot = await db.ref('Financeiro').once('value');
  gastos = snapshot.val() ? Object.values(snapshot.val()) : [];
  localStorage.setItem('financeiro', JSON.stringify(gastos));
  atualizarFinanceiro();
}

// ===== ADICIONAR OU EDITAR GASTO =====
function adicionarFinanceiro() {
  const novoGasto = {
    data: document.getElementById("dataFin").value,
    produto: document.getElementById("produtoFin").value.trim(),
    descricao: document.getElementById("descricaoFin").value.trim(),
    valor: parseFloat(document.getElementById("valorFin").value),
    tipo: document.getElementById("tipoFin").value,
    parcelado: document.getElementById("parceladoFin").checked,
    parcelas: document.getElementById("parceladoFin").checked ? parseInt(document.getElementById("parcelasFin").value) || 1 : 1
  };

  if (!novoGasto.data || !novoGasto.produto || isNaN(novoGasto.valor) || novoGasto.valor <= 0) {
    mostrarErro("Preencha todos os campos corretamente.");
    return;
  }

  if (indiceEdicaoGasto !== null) {
    gastos[indiceEdicaoGasto] = novoGasto;
    indiceEdicaoGasto = null;
    document.getElementById("btnCancelarFinanceiro").style.display = "none";
  } else {
    gastos.push(novoGasto);
  }

  db.ref('Financeiro').set(gastos);
  atualizarFinanceiro();
  limparCamposFinanceiro();
  mostrarSucesso("Gasto salvo com sucesso!");
}

// ===== LIMPAR CAMPOS =====
function limparCamposFinanceiro() {
  document.getElementById("dataFin").value = '';
  document.getElementById("produtoFin").value = '';
  document.getElementById("descricaoFin").value = '';
  document.getElementById("valorFin").value = '';
  document.getElementById("tipoFin").value = 'Adubo';
  document.getElementById("parceladoFin").checked = false;
  document.getElementById("parcelasFin").value = '';
  document.getElementById("camposParcelas").style.display = 'none';
}

// ===== ATUALIZAR LISTAGEM =====
function atualizarFinanceiro() {
  const lista = document.getElementById("financeiroLista");
  lista.innerHTML = '';

  gastos.forEach((g, index) => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <span>${g.data} - ${g.produto} - R$ ${g.valor.toFixed(2)} (${g.tipo})</span>
      <div class="botoes-financeiro">
        <button class="botao-circular azul" onclick="editarFinanceiro(${index})">
          <i class="fas fa-edit"></i>
        </button>
        <button class="botao-circular vermelho" onclick="confirmarExclusaoGasto(${index})">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    lista.appendChild(item);
  });
}

// ===== EDITAR GASTO =====
function editarFinanceiro(index) {
  const gasto = gastos[index];
  if (!gasto) return;

  document.getElementById("dataFin").value = gasto.data;
  document.getElementById("produtoFin").value = gasto.produto;
  document.getElementById("descricaoFin").value = gasto.descricao;
  document.getElementById("valorFin").value = gasto.valor;
  document.getElementById("tipoFin").value = gasto.tipo;
  document.getElementById("parceladoFin").checked = gasto.parcelado;
  document.getElementById("parcelasFin").value = gasto.parcelas;
  document.getElementById("camposParcelas").style.display = gasto.parcelado ? 'block' : 'none';

  indiceEdicaoGasto = index;
  document.getElementById("btnCancelarFinanceiro").style.display = "inline-block";
}

// ===== CONFIRMAR EXCLUSÃO =====
function confirmarExclusaoGasto(index) {
  Swal.fire({
    title: 'Você tem certeza?',
    text: "Esta ação não pode ser desfeita!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Sim, excluir!',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      excluirFinanceiro(index);
    }
  });
}

// ===== EXCLUIR GASTO =====
function excluirFinanceiro(index) {
  gastos.splice(index, 1);
  db.ref('Financeiro').set(gastos);
  atualizarFinanceiro();
  mostrarSucesso("Gasto excluído com sucesso!");
}

// ===== FEEDBACK VISUAL (SWEETALERT) =====
function mostrarSucesso(mensagem) {
  Swal.fire({
    icon: 'success',
    title: 'Sucesso!',
    text: mensagem,
    timer: 2000,
    showConfirmButton: false
  });
}

function mostrarErro(mensagem) {
  Swal.fire({
    icon: 'error',
    title: 'Erro!',
    text: mensagem,
    timer: 2000,
    showConfirmButton: false
  });
}

// ===== INICIALIZAR FINANCEIRO =====
document.addEventListener("dadosCarregados", carregarFinanceiro);
