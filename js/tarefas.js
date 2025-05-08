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
  const data = document.getElementById("dataTarefa").value;
  const descricao = document.getElementById("descricaoTarefa").value.trim();
  const prioridade = document.getElementById("prioridadeTarefa").value;
  const setor = document.getElementById("setorTarefa").value;

  if (!data || !descricao) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  const novaTarefa = { data, descricao, prioridade, setor, feita: false };

  if (indiceEdicaoTarefa !== null) {
    tarefas[indiceEdicaoTarefa] = novaTarefa;
    indiceEdicaoTarefa = null;
  } else {
    tarefas.push(novaTarefa);
  }

  db.ref('Tarefas').set(tarefas);
  atualizarTarefas();
  limparCamposTarefa();
}

// ===== LIMPAR CAMPOS =====
function limparCamposTarefa() {
  document.getElementById("dataTarefa").value = '';
  document.getElementById("descricaoTarefa").value = '';
  document.getElementById("prioridadeTarefa").value = 'Média';
  document.getElementById("setorTarefa").value = 'Setor 01';
}

// ===== ATUALIZAR LISTAGEM =====
function atualizarTarefas() {
  const listaTarefas = document.getElementById("listaTarefas");
  const listaFeitas = document.getElementById("listaTarefasFeitas");
  listaTarefas.innerHTML = '';
  listaFeitas.innerHTML = '';

  const termoBusca = document.getElementById("pesquisaTarefas").value.toLowerCase();
  tarefas.forEach((tarefa, index) => {
    const item = document.createElement('div');
    item.className = "item";
    item.innerHTML = `
      <div>
        ${tarefa.data} - ${tarefa.descricao} (${tarefa.prioridade}) - ${tarefa.setor}
      </div>
      <div>
        ${tarefa.feita ? `
          <button class="botao-circular verde" onclick="desfazerTarefa(${index})">
            <i class="fas fa-undo"></i>
          </button>
        ` : `
          <button class="botao-circular verde" onclick="marcarComoFeita(${index})">
            <i class="fas fa-check"></i>
          </button>
          <button class="botao-circular azul" onclick="editarTarefa(${index})">
            <i class="fas fa-edit"></i>
          </button>
        `}
        <button class="botao-circular vermelho" onclick="excluirTarefa(${index})">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;

    if (tarefa.feita) {
      listaFeitas.appendChild(item);
    } else {
      listaTarefas.appendChild(item);
    }
  });
}

// ===== MARCAR COMO FEITA =====
function marcarComoFeita(index) {
  tarefas[index].feita = true;
  db.ref('Tarefas').set(tarefas);
  atualizarTarefas();
}

// ===== DESFAZER TAREFA =====
function desfazerTarefa(index) {
  tarefas[index].feita = false;
  db.ref('Tarefas').set(tarefas);
  atualizarTarefas();
}

// ===== EDITAR TAREFA =====
function editarTarefa(index) {
  const tarefa = tarefas[index];
  document.getElementById("dataTarefa").value = tarefa.data;
  document.getElementById("descricaoTarefa").value = tarefa.descricao;
  document.getElementById("prioridadeTarefa").value = tarefa.prioridade;
  document.getElementById("setorTarefa").value = tarefa.setor;
  indiceEdicaoTarefa = index;
}

// ===== EXCLUIR TAREFA =====
function excluirTarefa(index) {
  if (confirm("Deseja excluir esta tarefa?")) {
    tarefas.splice(index, 1);
    db.ref('Tarefas').set(tarefas);
    atualizarTarefas();
  }
}

// ===== INICIALIZAR =====
document.addEventListener("DOMContentLoaded", carregarTarefas);
