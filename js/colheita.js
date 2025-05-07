// ===== VARIÁVEIS GLOBAIS =====
let colheitas = [];
let indiceEdicaoColheita = null;

// ===== INICIALIZAR MENU COLHEITA =====
function inicializarColheita() {
  carregarColheitas();
}

// ===== CARREGAR COLHEITAS (Simulação) =====
function carregarColheitas() {
  atualizarColheitas();
}

// ===== ADICIONAR OU EDITAR COLHEITA =====
function adicionarColheita() {
  const data = dataColheita.value;
  const quantidade = parseFloat(quantidadeColheita.value);
  const local = localColheita.value.trim();

  if (!data || isNaN(quantidade) || !local) {
    alert("Preencha todos os campos corretamente!");
    return;
  }

  if (indiceEdicaoColheita !== null) {
    colheitas[indiceEdicaoColheita] = { data, quantidade, local };
  } else {
    colheitas.push({ data, quantidade, local });
  }

  atualizarColheitas();
  resetarFormularioColheita();
}

// ===== ATUALIZAR LISTAGEM =====
function atualizarColheitas() {
  const lista = document.getElementById("listaColheitas");
  lista.innerHTML = "";

  colheitas.forEach((colheita, index) => {
    const item = document.createElement("div");
    item.className = "item-colheita";
    item.innerHTML = `
      <span>${colheita.data} - ${colheita.quantidade} Kg - ${colheita.local}</span>
      <div>
        <button class="editar" onclick="editarColheita(${index})">Editar</button>
        <button class="excluir" onclick="excluirColheita(${index})">Excluir</button>
      </div>
    `;
    lista.appendChild(item);
  });
}

// ===== EDITAR COLHEITA =====
function editarColheita(index) {
  const colheita = colheitas[index];
  dataColheita.value = colheita.data;
  quantidadeColheita.value = colheita.quantidade;
  localColheita.value = colheita.local;
  indiceEdicaoColheita = index;

  document.getElementById("formularioColheita").style.display = "block";
}

// ===== EXCLUIR COLHEITA =====
function excluirColheita(index) {
  colheitas.splice(index, 1);
  atualizarColheitas();
}

// ===== RESETAR FORMULÁRIO =====
function resetarFormularioColheita() {
  dataColheita.value = "";
  quantidadeColheita.value = "";
  localColheita.value = "";
  indiceEdicaoColheita = null;
  document.getElementById("formularioColheita").style.display = "none";
}

// ===== CANCELAR EDIÇÃO =====
function cancelarEdicaoColheita() {
  resetarFormularioColheita();
}
