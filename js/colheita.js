// ===== VARIÁVEIS GLOBAIS =====
let colheitas = [];
let indiceEdicaoColheita = null;

// ===== CARREGAR COLHEITAS =====
function carregarColheita() {
  db.ref('Colheita').on('value', snap => {
    colheitas = snap.exists() ? snap.val() : [];
    atualizarColheita();
  });
}

// ===== ADICIONAR OU EDITAR COLHEITA =====
function adicionarColheita() {
  const nova = {
    data: document.getElementById("dataColheita").value,
    produto: document.getElementById("produtoColheita").value.trim(),
    quantidade: parseFloat(document.getElementById("quantidadeColheita").value),
    setor: document.getElementById("setorColheita").value
  };

  if (!nova.data || !nova.produto || isNaN(nova.quantidade)) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  if (indiceEdicaoColheita !== null) {
    colheitas[indiceEdicaoColheita] = nova;
  } else {
    colheitas.push(nova);
  }

  db.ref('Colheita').set(colheitas);
  atualizarColheita();
  limparCamposColheita();
}

// ===== CANCELAR EDIÇÃO =====
function cancelarEdicaoColheita() {
  indiceEdicaoColheita = null;
  limparCamposColheita();
  document.getElementById("btnCancelarEdicaoColheita").style.display = "none";
}

// ===== LIMPAR CAMPOS =====
function limparCamposColheita() {
  document.getElementById("dataColheita").value = '';
  document.getElementById("produtoColheita").value = '';
  document.getElementById("quantidadeColheita").value = '';
  document.getElementById("setorColheita").value = 'Setor 01';
}

// ===== ATUALIZAR LISTAGEM =====
function atualizarColheita() {
  const lista = document.getElementById("listaColheita");
  lista.innerHTML = '';

  colheitas.forEach((colh, i) => {
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
      <span>${colh.data} - ${colh.produto} - ${colh.quantidade} kg - ${colh.setor}</span>
      <div class="buttons">
        <button class="btn azul" onclick="editarColheita(${i})"><i class="fas fa-edit"></i></button>
        <button class="btn vermelho" onclick="excluirColheita(${i})"><i class="fas fa-trash"></i></button>
      </div>
    `;
    lista.appendChild(item);
  });
}

// ===== EDITAR COLHEITA =====
function editarColheita(index) {
  const colh = colheitas[index];
  if (!colh) return;

  document.getElementById("dataColheita").value = colh.data;
  document.getElementById("produtoColheita").value = colh.produto;
  document.getElementById("quantidadeColheita").value = colh.quantidade;
  document.getElementById("setorColheita").value = colh.setor;

  indiceEdicaoColheita = index;
  document.getElementById("btnCancelarEdicaoColheita").style.display = "inline-block";
}

// ===== EXCLUIR COLHEITA =====
function excluirColheita(index) {
  if (!confirm("Deseja excluir este registro de colheita?")) return;
  colheitas.splice(index, 1);
  db.ref('Colheita').set(colheitas);
  atualizarColheita();
}
