// ===== VARIÁVEIS GLOBAIS =====
let tarefas = [];
let indiceEdicaoTarefa = null;

// ===== INICIALIZAR MENU TAREFAS =====
function inicializarTarefas() {
  carregarTarefas();
}

// ===== CARREGAR TAREFAS (Simulação) =====
function carregarTarefas() {
  atualizarTarefas();
}

// ===== ADICIONAR OU EDITAR TAREFA =====
function adicionarTarefa() {
  const data = dataTarefa.value;
  const titulo = tituloTarefa.value.trim();
  const descricao = descricaoTarefa.value.trim();

  if (!data || !titulo) {
    alert("Preencha todos os campos corretamente!");
    return;
  }

  if (indiceEdicaoTarefa !== null) {
    tarefas[indiceEdicaoTarefa] = { data, titulo, descricao, concluida: false };
  } else {
    tarefas.push({ data, titulo, descricao, concluida: false });
  }

  atualizarTarefas();
  resetarFormularioTarefa();
}

// ===== ATUALIZAR LISTAGEM =====
function atualizarTarefas() {
  const lista = document.getElementById("listaTarefas");
  lista.innerHTML = "";

  tarefas.forEach((tarefa, index) => {
    const item = document.createElement("div");
    item.className = "item-tarefa";
    item.innerHTML = `
      <span>${tarefa.data} - ${tarefa.titulo}</span>
      <div>
        <button class="concluir" onclick="concluirTarefa(${index})">Concluir</button>
        <button class="editar" onclick="editarTarefa(${index})">Editar</button>
        <button class="excluir" onclick="excluirTarefa(${index})">Excluir</button>
      </div>
    `;
    lista.appendChild(item);
  });
}

// ===== CONCLUIR TAREFA =====
function concluirTarefa(index) {
  tarefas[index].concluida = !tarefas[index].concluida;
  atualizarTarefas();
}

// ===== EDITAR TAREFA =====
function editarTarefa(index) {
  const tarefa = tarefas[index];
  dataTarefa.value = tarefa.data;
  tituloTarefa.value = tarefa.titulo;
  descricaoTarefa.value = tarefa.descricao;
  indiceEdicaoTarefa = index;

  document.getElementById("formularioTarefa").style.display = "block";
}

// ===== EXCLUIR TAREFA =====
function excluirTarefa(index) {
  tarefas.splice(index, 1);
  atualizarTarefas();
}

// ===== RESETAR FORMULÁRIO =====
function resetarFormularioTarefa() {
  dataTarefa.value = "";
  tituloTarefa.value = "";
  descricaoTarefa.value = "";
  indiceEdicaoTarefa = null;
  document.getElementById("formularioTarefa").style.display = "none";
}

// ===== CANCELAR EDIÇÃO =====
function cancelarEdicaoTarefa() {
  resetarFormularioTarefa();
}
