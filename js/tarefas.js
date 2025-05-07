// ===== VARIÁVEIS GLOBAIS =====
let tarefas = [];
let indiceEdicaoTarefa = null;

// ===== CARREGAR TAREFAS =====
function carregarTarefas() {
  db.ref('Tarefas').on('value', snap => {
    tarefas = snap.exists() ? snap.val() : [];
    atualizarTarefas();
  });
}

// ===== ADICIONAR OU EDITAR TAREFA =====
function adicionarTarefa() {
  const nova = {
    data: document.getElementById("dataTarefa").value,
    descricao: document.getElementById("descricaoTarefa").value.trim(),
    prioridade: document.getElementById("prioridadeTarefa").value
  };

  if (!nova.data || !nova.descricao) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  if (indiceEdicaoTarefa !== null) {
    tarefas[indiceEdicaoTarefa] = nova;
  } else {
    tarefas.push(nova);
  }

  db.ref('Tarefas').set(tarefas);
  atualizarTarefas();
  limparCamposTarefa();
}

// ===== CANCELAR EDIÇÃO =====
function cancelarEdicaoTarefa() {
  indiceEdicaoTarefa = null;
  limparCamposTarefa();
  document.getElementById("btnCancelarEdicaoTarefa").style.display = "none";
}

// ===== LIMPAR CAMPOS =====
function limparCamposTarefa() {
  document.getElementById("dataTarefa").value = '';
  document.getElementById("descricaoTarefa").value = '';
  document.getElementById("prioridadeTarefa").value = 'Média';
}

// ===== ATUALIZAR LISTAGEM =====
function atualizarTarefas() {
  const lista = document.getElementById("listaTarefas");
  lista.innerHTML = '';

  tarefas.forEach((tarefa, i) => {
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
      <span>${tarefa.data} - ${tarefa.descricao} (${tarefa.prioridade})</span>
      <div class="buttons">
        <button class="btn azul" onclick="editarTarefa(${i})"><i class="fas fa-edit"></i></button>
        <button class="btn vermelho" onclick="excluirTarefa(${i})"><i class="fas fa-trash"></i></button>
      </div>
    `;
    lista.appendChild(item);
  });
}

// ===== EDITAR TAREFA =====
function editarTarefa(index) {
  const tarefa = tarefas[index];
  if (!tarefa) return;

  document.getElementById("dataTarefa").value = tarefa.data;
  document.getElementById("descricaoTarefa").value = tarefa.descricao;
  document.getElementById("prioridadeTarefa").value = tarefa.prioridade;

  indiceEdicaoTarefa = index;
  document.getElementById("btnCancelarEdicaoTarefa").style.display = "inline-block";
}

// ===== EXCLUIR TAREFA =====
function excluirTarefa(index) {
  if (!confirm("Deseja excluir esta tarefa?")) return;
  tarefas.splice(index, 1);
  db.ref('Tarefas').set(tarefas);
  atualizarTarefas();
}
