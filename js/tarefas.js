// ===== VARIÁVEIS GLOBAIS =====
let tarefas = [];
let indiceEdicaoTarefa = null;

// ===== CARREGAR TAREFAS =====
async function carregarTarefas() {
  const cache = localStorage.getItem('tarefas');
  if (cache) {
    tarefas = JSON.parse(cache);
    atualizarTarefas();
  }

  const snapshot = await db.ref('Tarefas').once('value');
  tarefas = snapshot.val() ? Object.values(snapshot.val()) : [];
  localStorage.setItem('tarefas', JSON.stringify(tarefas));
  atualizarTarefas();
}

// ===== ADICIONAR OU EDITAR TAREFA =====
function adicionarTarefa() {
  const nova = {
    data: document.getElementById('dataTarefa').value,
    descricao: document.getElementById('descricaoTarefa').value.trim(),
    prioridade: document.getElementById('prioridadeTarefa').value,
    setor: document.getElementById('setorTarefa').value,
    feita: false
  };

  if (!nova.data || !nova.descricao) {
    mostrarErro("Preencha todos os campos obrigatórios.");
    return;
  }

  if (indiceEdicaoTarefa !== null) {
    tarefas[indiceEdicaoTarefa] = nova;
    indiceEdicaoTarefa = null;
    document.getElementById("btnCancelarEdicaoTarefa").style.display = "none";
  } else {
    tarefas.push(nova);
  }

  db.ref('Tarefas').set(tarefas);
  atualizarTarefas();
  limparCamposTarefa();
  mostrarSucesso("Tarefa salva com sucesso!");
}

// ===== LIMPAR CAMPOS =====
function limparCamposTarefa() {
  document.getElementById('dataTarefa').value = '';
  document.getElementById('descricaoTarefa').value = '';
  document.getElementById('prioridadeTarefa').value = 'Alta';
  document.getElementById('setorTarefa').value = 'Setor 01';
}

// ===== ATUALIZAR LISTAGEM =====
function atualizarTarefas() {
  const lista = document.getElementById('listaTarefas');
  lista.innerHTML = '';

  tarefas.forEach((t, index) => {
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
      <span>${t.data} - ${t.descricao} (${t.prioridade}) - ${t.setor}</span>
      <div class="botoes-tarefa">
        <button class="botao-circular azul" onclick="editarTarefa(${index})">
          <i class="fas fa-edit"></i>
        </button>
        <button class="botao-circular vermelho" onclick="confirmarExclusaoTarefa(${index})">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    lista.appendChild(item);
  });
}

// ===== EDITAR TAREFA =====
function editarTarefa(index) {
  const tarefa = tarefas[index];
  if (!tarefa) return;

  document.getElementById('dataTarefa').value = tarefa.data;
  document.getElementById('descricaoTarefa').value = tarefa.descricao;
  document.getElementById('prioridadeTarefa').value = tarefa.prioridade;
  document.getElementById('setorTarefa').value = tarefa.setor;

  indiceEdicaoTarefa = index;
  document.getElementById("btnCancelarEdicaoTarefa").style.display = "inline-block";
}

// ===== CONFIRMAR EXCLUSÃO =====
function confirmarExclusaoTarefa(index) {
  Swal.fire({
    title: 'Você tem certeza?',
    text: "Esta ação não pode ser desfeita!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Sim, excluir!',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      excluirTarefa(index);
    }
  });
}

// ===== EXCLUIR TAREFA =====
function excluirTarefa(index) {
  tarefas.splice(index, 1);
  db.ref('Tarefas').set(tarefas);
  atualizarTarefas();
  mostrarSucesso("Tarefa excluída com sucesso!");
}

// ===== FEEDBACK VISUAL (SWEETALERT) =====
function mostrarSucesso(mensagem) {
  Swal.fire({
    icon: 'success',
    title: 'Sucesso!',
    text: mensagem,
    timer: 2000,
    showConfirmButton: false
  });
}

function mostrarErro(mensagem) {
  Swal.fire({
    icon: 'error',
    title: 'Erro!',
    text: mensagem,
    timer: 2000,
    showConfirmButton: false
  });
}

// ===== INICIALIZAR TAREFAS =====
document.addEventListener("dadosCarregados", carregarTarefas);
