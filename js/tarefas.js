// ===== VARIÁVEIS GLOBAIS =====
let tarefas = [];
let tarefasFeitas = [];

// ===== FUNÇÃO: CARREGAR TAREFAS =====
function carregarTarefas() {
  const listaTarefas = document.getElementById("listaTarefas");
  const listaTarefasFeitas = document.getElementById("listaTarefasFeitas");
  listaTarefas.innerHTML = "";
  listaTarefasFeitas.innerHTML = "";

  tarefas.forEach((tarefa, index) => {
    const item = document.createElement("div");
    item.classList.add("item");
    item.innerHTML = `
      <span>${tarefa.descricao}</span>
      <button onclick="marcarFeita(${index})">Feita</button>
      <button onclick="excluirTarefa(${index})">Excluir</button>
    `;
    listaTarefas.appendChild(item);
  });

  tarefasFeitas.forEach((tarefa, index) => {
    const item = document.createElement("div");
    item.classList.add("item");
    item.innerHTML = `
      <span>${tarefa.descricao}</span>
      <button onclick="desfazerFeita(${index})">Desfazer</button>
      <button onclick="excluirTarefaFeita(${index})">Excluir</button>
    `;
    listaTarefasFeitas.appendChild(item);
  });
}

// ===== FUNÇÃO: ADICIONAR TAREFA =====
function adicionarTarefa() {
  const descricao = document.getElementById("descricaoTarefa").value.trim();
  if (!descricao) {
    alert("Preencha a descrição.");
    return;
  }

  tarefas.push({ descricao });
  carregarTarefas();
  salvarDadosFirebase("tarefas", { tarefas, tarefasFeitas });
}

// ===== FUNÇÃO: MARCAR COMO FEITA =====
function marcarFeita(index) {
  const tarefa = tarefas.splice(index, 1)[0];
  tarefasFeitas.push(tarefa);
  carregarTarefas();
  salvarDadosFirebase("tarefas", { tarefas, tarefasFeitas });
}

// ===== FUNÇÃO: DESFAZER =====
function desfazerFeita(index) {
  const tarefa = tarefasFeitas.splice(index, 1)[0];
  tarefas.push(tarefa);
  carregarTarefas();
  salvarDadosFirebase("tarefas", { tarefas, tarefasFeitas });
}

// ===== FUNÇÃO: EXCLUIR TAREFA =====
function excluirTarefa(index) {
  tarefas.splice(index, 1);
  carregarTarefas();
  salvarDadosFirebase("tarefas", { tarefas, tarefasFeitas });
}

// ===== FUNÇÃO: EXCLUIR TAREFA FEITA =====
function excluirTarefaFeita(index) {
  tarefasFeitas.splice(index, 1);
  carregarTarefas();
  salvarDadosFirebase("tarefas", { tarefas, tarefasFeitas });
}
