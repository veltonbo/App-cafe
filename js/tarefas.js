// ===== VARIÁVEIS GLOBAIS =====
let tarefas = [];
let tarefasFeitas = [];
let indiceEdicaoTarefa = null;

// ===== FUNÇÃO: CARREGAR TAREFAS =====
function carregarTarefas() {
  atualizarTarefas();
}

// ===== FUNÇÃO: ATUALIZAR TAREFAS =====
function atualizarTarefas() {
  const listaTarefas = document.getElementById("listaTarefas");
  const listaTarefasFeitas = document.getElementById("listaTarefasFeitas");

  listaTarefas.innerHTML = "";
  listaTarefasFeitas.innerHTML = "";

  const filtroSetor = document.getElementById("filtroSetorTarefas").value;
  const pesquisa = document.getElementById("pesquisaTarefas").value.toLowerCase();

  const tarefasFiltradas = tarefas.filter(tarefa => {
    return (
      (filtroSetor === "" || tarefa.setor === filtroSetor) &&
      tarefa.descricao.toLowerCase().includes(pesquisa)
    );
  });

  const feitasFiltradas = tarefasFeitas.filter(tarefa => {
    return (
      (filtroSetor === "" || tarefa.setor === filtroSetor) &&
      tarefa.descricao.toLowerCase().includes(pesquisa)
    );
  });

  // Exibe tarefas a fazer
  if (tarefasFiltradas.length === 0) {
    listaTarefas.innerHTML = "<p style='text-align:center;'>Nenhuma tarefa encontrada.</p>";
  }

  tarefasFiltradas.forEach((tarefa, index) => {
    const item = document.createElement("div");
    item.classList.add("item");
    item.innerHTML = `
      <span><strong>${tarefa.data}</strong> - ${tarefa.descricao} (${tarefa.prioridade}) - ${tarefa.setor}</span>
      <div class="botoes-acao">
        <button class="botao-circular verde" onclick="marcarTarefa(${index})"><i class="fas fa-check"></i></button>
        <button class="botao-circular azul" onclick="editarTarefa(${index})"><i class="fas fa-edit"></i></button>
        <button class="botao-circular vermelho" onclick="excluirTarefa(${index})"><i class="fas fa-trash-alt"></i></button>
      </div>
    `;
    listaTarefas.appendChild(item);
  });

  // Exibe tarefas concluídas
  feitasFiltradas.forEach((tarefa, index) => {
    const item = document.createElement("div");
    item.classList.add("item");
    item.innerHTML = `
      <span><strong>${tarefa.data}</strong> - ${tarefa.descricao} (${tarefa.prioridade}) - ${tarefa.setor}</span>
      <div class="botoes-acao">
        <button class="botao-circular laranja" onclick="desmarcarTarefa(${index})"><i class="fas fa-undo-alt"></i></button>
        <button class="botao-circular vermelho" onclick="excluirTarefaFeita(${index})"><i class="fas fa-trash-alt"></i></button>
      </div>
    `;
    listaTarefasFeitas.appendChild(item);
  });
}

// ===== FUNÇÃO: ADICIONAR TAREFA =====
function adicionarTarefa() {
  const nova = {
    data: document.getElementById("dataTarefa").value,
    descricao: document.getElementById("descricaoTarefa").value.trim(),
    prioridade: document.getElementById("prioridadeTarefa").value,
    setor: document.getElementById("setorTarefa").value
  };

  if (!nova.data || !nova.descricao) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  if (indiceEdicaoTarefa === null) {
    tarefas.push(nova);
  } else {
    tarefas[indiceEdicaoTarefa] = nova;
    indiceEdicaoTarefa = null;
  }

  limparCamposTarefa();
  atualizarTarefas();
}

// ===== FUNÇÃO: EDITAR TAREFA =====
function editarTarefa(index) {
  const tarefa = tarefas[index];
  document.getElementById("dataTarefa").value = tarefa.data;
  document.getElementById("descricaoTarefa").value = tarefa.descricao;
  document.getElementById("prioridadeTarefa").value = tarefa.prioridade;
  document.getElementById("setorTarefa").value = tarefa.setor;

  indiceEdicaoTarefa = index;
}

// ===== FUNÇÃO: MARCAR COMO FEITA =====
function marcarTarefa(index) {
  const tarefa = tarefas.splice(index, 1)[0];
  tarefasFeitas.push(tarefa);
  atualizarTarefas();
}

// ===== FUNÇÃO: DESMARCAR TAREFA =====
function desmarcarTarefa(index) {
  const tarefa = tarefasFeitas.splice(index, 1)[0];
  tarefas.push(tarefa);
  atualizarTarefas();
}

// ===== FUNÇÃO: EXCLUIR TAREFA =====
function excluirTarefa(index) {
  tarefas.splice(index, 1);
  atualizarTarefas();
}

// ===== FUNÇÃO: EXCLUIR TAREFA FEITA =====
function excluirTarefaFeita(index) {
  tarefasFeitas.splice(index, 1);
  atualizarTarefas();
}

// ===== FUNÇÃO: LIMPAR CAMPOS =====
function limparCamposTarefa() {
  document.getElementById("dataTarefa").value = "";
  document.getElementById("descricaoTarefa").value = "";
  document.getElementById("prioridadeTarefa").value = "Alta";
  document.getElementById("setorTarefa").value = "Setor 01";
}
