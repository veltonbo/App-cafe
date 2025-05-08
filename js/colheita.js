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
  const data = document.getElementById("dataColheita").value;
  const quantidade = parseFloat(document.getElementById("quantidadeColheita").value);
  const descricao = document.getElementById("descricaoColheita").value.trim();

  if (!data || isNaN(quantidade) || quantidade <= 0) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  const novaColheita = { data, quantidade, descricao };

  if (indiceEdicaoColheita !== null) {
    colheitas[indiceEdicaoColheita] = novaColheita;
    indiceEdicaoColheita = null;
  } else {
    colheitas.push(novaColheita);
  }

  db.ref('Colheita').set(colheitas);
  atualizarColheita();
  limparCamposColheita();
}

// ===== LIMPAR CAMPOS =====
function limparCamposColheita() {
  document.getElementById("dataColheita").value = '';
  document.getElementById("quantidadeColheita").value = '';
  document.getElementById("descricaoColheita").value = '';
}

// ===== ATUALIZAR LISTAGEM =====
function atualizarColheita() {
  const lista = document.getElementById("listaColheita");
  lista.innerHTML = '';

  const termoBusca = document.getElementById("pesquisaColheita").value.toLowerCase();
  colheitas
    .filter(col => `${col.data} ${col.descricao}`.toLowerCase().includes(termoBusca))
    .forEach((col, index) => {
      const item = document.createElement('div');
      item.className = "item";
      item.innerHTML = `
        <div>
          ${col.data} - ${col.quantidade} Kg 
          ${col.descricao ? `- ${col.descricao}` : ''}
        </div>
        <div>
          <button class="botao-circular azul" onclick="editarColheita(${index})"><i class="fas fa-edit"></i></button>
          <button class="botao-circular vermelho" onclick="excluirColheita(${index})"><i class="fas fa-trash"></i></button>
        </div>
      `;
      lista.appendChild(item);
    });
}

// ===== EDITAR COLHEITA =====
function editarColheita(index) {
  const colheita = colheitas[index];
  document.getElementById("dataColheita").value = colheita.data;
  document.getElementById("quantidadeColheita").value = colheita.quantidade;
  document.getElementById("descricaoColheita").value = colheita.descricao || '';
  indiceEdicaoColheita = index;
}

// ===== EXCLUIR COLHEITA =====
function excluirColheita(index) {
  if (confirm("Deseja excluir esta colheita?")) {
    colheitas.splice(index, 1);
    db.ref('Colheita').set(colheitas);
    atualizarColheita();
  }
}

// ===== INICIALIZAR =====
document.addEventListener("DOMContentLoaded", carregarColheita);
