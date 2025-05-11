// ====== VARIÁVEIS GLOBAIS ======
let tarefas = [];
let indiceEdicaoTarefa = null;

// ====== ADICIONAR OU SALVAR EDIÇÃO DE TAREFA ======
function adicionarTarefa() {
  const dataTarefa = document.getElementById('dataTarefa').value;
  const descricaoTarefa = document.getElementById('descricaoTarefa').value.trim();
  const prioridadeTarefa = document.getElementById('prioridadeTarefa').value;
  const setorTarefa = document.getElementById('setorTarefa').value;
  const eAplicacao = document.getElementById('eAplicacaoCheckbox').checked;
  const dosagemAplicacao = document.getElementById('dosagemAplicacao').value.trim();
  const tipoAplicacao = document.getElementById('tipoAplicacao').value;

  if (!dataTarefa || !descricaoTarefa) {
    alert("Preencha todos os campos obrigatórios!");
    return;
  }

  const novaTarefa = {
    data: dataTarefa,
    descricao: descricaoTarefa,
    prioridade: prioridadeTarefa,
    setor: setorTarefa,
    feita: false,
    eAplicacao,
    dosagem: eAplicacao ? dosagemAplicacao : '',
    tipo: eAplicacao ? tipoAplicacao : ''
  };

  if (indiceEdicaoTarefa !== null) {
    tarefas[indiceEdicaoTarefa] = novaTarefa;
    indiceEdicaoTarefa = null;
    document.getElementById("btnCancelarEdicaoTarefa").style.display = "none";
  } else {
    tarefas.push(novaTarefa);
  }

  db.ref('Tarefas').set(tarefas);
  atualizarTarefas();
  limparCamposTarefa();
}

// ====== EDITAR TAREFA ======
function editarTarefa(index) {
  const t = tarefas[index];
  if (!t) return;

  document.getElementById('dataTarefa').value = t.data;
  document.getElementById('descricaoTarefa').value = t.descricao;
  document.getElementById('prioridadeTarefa').value = t.prioridade;
  document.getElementById('setorTarefa').value = t.setor;
  document.getElementById('eAplicacaoCheckbox').checked = t.eAplicacao;
  document.getElementById('dosagemAplicacao').value = t.dosagem || '';
  document.getElementById('tipoAplicacao').value = t.tipo || 'Adubo';

  indiceEdicaoTarefa = index;
  document.getElementById("btnCancelarEdicaoTarefa").style.display = "inline-block";
}

// ====== CANCELAR EDIÇÃO ======
function cancelarEdicaoTarefa() {
  limparCamposTarefa();
  indiceEdicaoTarefa = null;
  document.getElementById("btnCancelarEdicaoTarefa").style.display = "none";
}

// ====== LIMPAR CAMPOS DE TAREFA ======
function limparCamposTarefa() {
  document.getElementById('dataTarefa').value = '';
  document.getElementById('descricaoTarefa').value = '';
  document.getElementById('prioridadeTarefa').value = 'Alta';
  document.getElementById('setorTarefa').value = 'Setor 01';
  document.getElementById('eAplicacaoCheckbox').checked = false;
  document.getElementById('dosagemAplicacao').value = '';
  document.getElementById('tipoAplicacao').value = 'Adubo';
  mostrarCamposAplicacao();
}

// ====== ATUALIZAR LISTA DE TAREFAS ======
function atualizarTarefas() {
  const lista = document.getElementById("listaTarefas");
  lista.innerHTML = '';

  tarefas.forEach((tarefa, index) => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <span>${formatarDataBR(tarefa.data)} - ${tarefa.descricao} (${tarefa.prioridade}) - ${tarefa.setor}</span>
      <div class="botoes-tarefa">
        <button class="botao-circular azul" onclick="editarTarefa(${index})">
          <i class="fas fa-edit"></i>
        </button>
        <button class="botao-circular vermelho" onclick="excluirTarefa(${index})">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    lista.appendChild(item);
  });
}

// ====== EXCLUIR TAREFA ======
function excluirTarefa(index) {
  if (!confirm("Deseja excluir esta tarefa?")) return;
  tarefas.splice(index, 1);
  db.ref('Tarefas').set(tarefas);
  atualizarTarefas();
}

// ====== MOSTRAR CAMPOS DE APLICAÇÃO ======
function mostrarCamposAplicacao() {
  const campos = document.getElementById('camposAplicacao');
  campos.style.display = document.getElementById('eAplicacaoCheckbox').checked ? 'block' : 'none';
}

// ====== CARREGAR TAREFAS DO FIREBASE ======
function carregarTarefas() {
  db.ref('Tarefas').on('value', (snapshot) => {
    tarefas = snapshot.exists() ? Object.values(snapshot.val()) : [];
    atualizarTarefas();
  });
}

// ====== INICIALIZAR TAREFAS ======
document.addEventListener("dadosCarregados", carregarTarefas);
