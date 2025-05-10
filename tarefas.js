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

// ===== EXIBIR/OCULTAR FORMULÁRIO =====
function alternarFormularioTarefa() {
  const form = document.getElementById("formularioTarefa");
  form.style.display = form.style.display === "none" ? "block" : "none";
  if (form.style.display === "none") {
    limparCamposTarefa();
    indiceEdicaoTarefa = null;
  }
}

// ===== ADICIONAR OU EDITAR TAREFA =====
function adicionarTarefa() {
  const nova = {
    data: document.getElementById("dataTarefa").value,
    descricao: document.getElementById("descricaoTarefa").value.trim(),
    prioridade: document.getElementById("prioridadeTarefa").value,
    setor: document.getElementById("setorTarefa").value
  };

  if (!nova.data || !nova.descricao) {
    alert("Preencha todos os campos obrigatórios!");
    return;
  }

  if (indiceEdicaoTarefa !== null) {
    tarefas[indiceEdicaoTarefa] = nova;
  } else {
    tarefas.push(nova);
  }

  db.ref('Tarefas').set(tarefas);
  atualizarTarefas();
  alternarFormularioTarefa();
}

// ===== ATUALIZAR LISTAGEM =====
function atualizarTarefas() {
  const lista = document.getElementById("listaTarefas");
  lista.innerHTML = '';

  tarefas.forEach((t, i) => {
    const item = document.createElement('div');
    item.className = 'item fade-in';
    item.innerHTML = `
      <span>${t.data} - ${t.descricao} (${t.prioridade}) - ${t.setor}</span>
      <div class="botoes-tarefa">
        <button class="botao-circular azul" onclick="editarTarefa(${i})"><i class="fas fa-edit"></i></button>
        <button class="botao-circular vermelho" onclick="excluirTarefa(${i})"><i class="fas fa-trash-alt"></i></button>
      </div>
    `;
    lista.appendChild(item);
  });
}

// ===== EDITAR TAREFA =====
function editarTarefa(index) {
  const t = tarefas[index];
  if (!t) return;

  document.getElementById("dataTarefa").value = t.data;
  document.getElementById("descricaoTarefa").value = t.descricao;
  document.getElementById("prioridadeTarefa").value = t.prioridade;
  document.getElementById("setorTarefa").value = t.setor;
  
  indiceEdicaoTarefa = index;
  document.getElementById("formularioTarefa").style.display = "block";
}

// ===== EXCLUIR TAREFA =====
function excluirTarefa(index) {
  if (!confirm("Deseja excluir esta tarefa?")) return;
  tarefas.splice(index, 1);
  db.ref('Tarefas').set(tarefas);
  atualizarTarefas();
}

// ===== LIMPAR CAMPOS =====
function limparCamposTarefa() {
  document.getElementById("dataTarefa").value = '';
  document.getElementById("descricaoTarefa").value = '';
  document.getElementById("prioridadeTarefa").value = 'Alta';
  document.getElementById("setorTarefa").value = 'Setor 01';
}
