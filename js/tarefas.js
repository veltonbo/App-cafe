// ====== VARIÁVEIS GLOBAIS ======
let tarefas = [];
let indiceEdicaoTarefa = null;

// ====== INICIALIZAR TAREFAS ======
document.addEventListener("dadosCarregados", carregarTarefas);

// ====== CARREGAR TAREFAS DO FIREBASE ======
function carregarTarefas() {
  db.ref('Tarefas').on('value', (snapshot) => {
    if (snapshot.exists()) {
      tarefas = Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...data }));
      atualizarTarefas();
    } else {
      tarefas = [];
      atualizarTarefas();
    }
  });
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
        <button class="botao-circular azul" onclick="editarTarefa('${tarefa.id}')">
          <i class="fas fa-edit"></i>
        </button>
        <button class="botao-circular vermelho" onclick="excluirTarefa('${tarefa.id}')">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    lista.appendChild(item);
  });
}

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
    const tarefaID = tarefas[indiceEdicaoTarefa].id;
    db.ref(`Tarefas/${tarefaID}`).set(novaTarefa);
    indiceEdicaoTarefa = null;
  } else {
    db.ref('Tarefas').push(novaTarefa);
  }

  limparCamposTarefa();
}

// ====== EDITAR TAREFA ======
function editarTarefa(id) {
  const tarefa = tarefas.find(t => t.id === id);
  if (!tarefa) return;

  document.getElementById('dataTarefa').value = tarefa.data;
  document.getElementById('descricaoTarefa').value = tarefa.descricao;
  document.getElementById('prioridadeTarefa').value = tarefa.prioridade;
  document.getElementById('setorTarefa').value = tarefa.setor;
  document.getElementById('eAplicacaoCheckbox').checked = tarefa.eAplicacao;
  document.getElementById('dosagemAplicacao').value = tarefa.dosagem || '';
  document.getElementById('tipoAplicacao').value = tarefa.tipo || 'Adubo';

  indiceEdicaoTarefa = tarefas.findIndex(t => t.id === id);
  document.getElementById("btnCancelarEdicaoTarefa").style.display = "inline-block";
}

// ====== EXCLUIR TAREFA ======
function excluirTarefa(id) {
  if (!confirm("Deseja excluir esta tarefa?")) return;
  db.ref(`Tarefas/${id}`).remove();
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

// ====== MOSTRAR CAMPOS DE APLICAÇÃO ======
function mostrarCamposAplicacao() {
  const campos = document.getElementById('camposAplicacao');
  campos.style.display = document.getElementById('eAplicacaoCheckbox').checked ? 'block' : 'none';
}

// ====== FORMATAR DATA (DD/MM/AAAA) ======
function formatarDataBR(dataISO) {
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}
