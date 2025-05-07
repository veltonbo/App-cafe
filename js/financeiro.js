// ===== VARIÁVEIS GLOBAIS =====
let movimentos = [];
let indiceEdicaoFinanceiro = null;

// ===== CARREGAR MOVIMENTAÇÕES =====
function carregarFinanceiro() {
  db.ref('Financeiro').on('value', snap => {
    movimentos = snap.exists() ? snap.val() : [];
    atualizarFinanceiro();
  });
}

// ===== ADICIONAR OU EDITAR MOVIMENTO =====
function adicionarFinanceiro() {
  const novo = {
    data: document.getElementById("dataFin").value,
    descricao: document.getElementById("produtoFin").value.trim(),
    valor: parseFloat(document.getElementById("valorFin").value),
    tipo: document.getElementById("tipoFin").value
  };

  if (!novo.data || !novo.descricao || isNaN(novo.valor)) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  if (indiceEdicaoFinanceiro !== null) {
    movimentos[indiceEdicaoFinanceiro] = novo;
  } else {
    movimentos.push(novo);
  }

  db.ref('Financeiro').set(movimentos);
  atualizarFinanceiro();
  limparCamposFinanceiro();
}

// ===== CANCELAR EDIÇÃO =====
function cancelarEdicaoFinanceiro() {
  indiceEdicaoFinanceiro = null;
  limparCamposFinanceiro();
  document.getElementById("btnCancelarEdicaoFin").style.display = "none";
}

// ===== LIMPAR CAMPOS =====
function limparCamposFinanceiro() {
  document.getElementById("dataFin").value = '';
  document.getElementById("produtoFin").value = '';
  document.getElementById("valorFin").value = '';
  document.getElementById("tipoFin").value = 'Receita';
}

// ===== ATUALIZAR LISTAGEM =====
function atualizarFinanceiro() {
  const lista = document.getElementById("listaFinanceiro");
  lista.innerHTML = '';

  movimentos.forEach((mov, i) => {
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
      <span>${mov.data} - ${mov.descricao} (${mov.tipo}) - R$ ${mov.valor.toFixed(2)}</span>
      <div class="buttons">
        <button class="btn azul" onclick="editarFinanceiro(${i})"><i class="fas fa-edit"></i></button>
        <button class="btn vermelho" onclick="excluirFinanceiro(${i})"><i class="fas fa-trash"></i></button>
      </div>
    `;
    lista.appendChild(item);
  });
}

// ===== EDITAR MOVIMENTO =====
function editarFinanceiro(index) {
  const mov = movimentos[index];
  if (!mov) return;

  document.getElementById("dataFin").value = mov.data;
  document.getElementById("produtoFin").value = mov.descricao;
  document.getElementById("valorFin").value = mov.valor;
  document.getElementById("tipoFin").value = mov.tipo;

  indiceEdicaoFinanceiro = index;
  document.getElementById("btnCancelarEdicaoFin").style.display = "inline-block";
}

// ===== EXCLUIR MOVIMENTO =====
function excluirFinanceiro(index) {
  if (!confirm("Deseja excluir esta movimentação?")) return;
  movimentos.splice(index, 1);
  db.ref('Financeiro').set(movimentos);
  atualizarFinanceiro();
}
