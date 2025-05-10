// ====== VARIÁVEIS GLOBAIS ======
let tarefas = [];
let indiceEdicaoTarefa = null;

// ====== FUNÇÃO PARA ALTERNAR FORMULÁRIO ======
function alternarFormularioTarefa() {
  const form = document.getElementById("formularioTarefa");
  form.style.display = form.style.display === "none" ? "block" : "none";
  
  if (form.style.display === "block") {
    limparCamposTarefa();
  }
}

// ====== CARREGAR TAREFAS ======
function carregarTarefas() {
  db.ref('Tarefas').once('value').then(snap => {
    tarefas = snap.exists() ? snap.val() : [];
    atualizarTarefas();
  });
}

// ====== ATUALIZAR LISTA DE TAREFAS ======
function atualizarTarefas() {
  const listaAFazer = document.getElementById('listaTarefas');
  const listaFeitas = document.getElementById('listaTarefasFeitas');
  listaAFazer.innerHTML = '';
  listaFeitas.innerHTML = '';

  tarefas.forEach((t, i) => {
    const item = document.createElement('div');
    item.className = "item";
    item.innerHTML = `
      <span>${t.data} - ${t.descricao} (${t.prioridade}) - ${t.setor}</span>
      <div class="botoes-tarefa">
        ${t.feita ? `
          <button class="botao-circular laranja" onclick="desfazerTarefa(${i})">
            <i class="fas fa-undo-alt"></i>
          </button>
        ` : `
          <button class="botao-circular verde" onclick="marcarTarefaComoFeita(${i})">
            <i class="fas fa-check"></i>
          </button>
          <button class="botao-circular azul" onclick="editarTarefa(${i})">
            <i class="fas fa-edit"></i>
          </button>
        `}
        <button class="botao-circular vermelho" onclick="excluirTarefa(${i})">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    `;
    (t.feita ? listaFeitas : listaAFazer).appendChild(item);
  });
}

// ====== ADICIONAR OU EDITAR TAREFA ======
function adicionarTarefa() {
  const nova = {
    data: document.getElementById('dataTarefa').value,
    descricao: document.getElementById('descricaoTarefa').value.trim(),
    prioridade: document.getElementById('prioridadeTarefa').value,
    setor: document.getElementById('setorTarefa').value,
    feita: false
  };

  if (indiceEdicaoTarefa !== null) {
    tarefas[indiceEdicaoTarefa] = nova;
    indiceEdicaoTarefa = null;
  } else {
    tarefas.push(nova);
  }

  db.ref('Tarefas').set(tarefas);
  atualizarTarefas();
  limparCamposTarefa();
  alternarFormularioTarefa();
}

// ====== EDITAR TAREFA ======
function editarTarefa(index) {
  const t = tarefas[index];
  document.getElementById('dataTarefa').value = t.data;
  document.getElementById('descricaoTarefa').value = t.descricao;
  document.getElementById('prioridadeTarefa').value = t.prioridade;
  document.getElementById('setorTarefa').value = t.setor;

  indiceEdicaoTarefa = index;
  document.getElementById("formularioTarefa").style.display = "block";
  document.getElementById("btnCancelarEdicaoTarefa").style.display = "inline-block";
}

// ====== CANCELAR EDIÇÃO ======
function cancelarEdicaoTarefa() {
  limparCamposTarefa();
  indiceEdicaoTarefa = null;
  document.getElementById("formularioTarefa").style.display = "none";
  document.getElementById("btnCancelarEdicaoTarefa").style.display = "none";
}

// ====== LIMPAR CAMPOS ======
function limparCamposTarefa() {
  document.getElementById('dataTarefa').value = '';
  document.getElementById('descricaoTarefa').value = '';
  document.getElementById('prioridadeTarefa').value = 'Alta';
  document.getElementById('setorTarefa').value = 'Setor 01';
}
