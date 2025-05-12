// ====== VARIÁVEIS GLOBAIS ======
let tarefas = [];
let indiceEdicaoTarefa = null; // Agora está corretamente definida

// ====== ADICIONAR OU SALVAR EDIÇÃO DE TAREFA ======
function adicionarTarefa() {
  const dataTarefa = document.getElementById('dataTarefa');
  const descricaoTarefa = document.getElementById('descricaoTarefa');
  const prioridadeTarefa = document.getElementById('prioridadeTarefa');
  const setorTarefa = document.getElementById('setorTarefa');
  const eAplicacaoCheckbox = document.getElementById('eAplicacaoCheckbox');
  const dosagemAplicacao = document.getElementById('dosagemAplicacao');
  const tipoAplicacao = document.getElementById('tipoAplicacao');

  if (!dataTarefa || !descricaoTarefa || !prioridadeTarefa || !setorTarefa) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  const nova = {
    data: dataTarefa.value,
    descricao: descricaoTarefa.value.trim(),
    prioridade: prioridadeTarefa.value,
    setor: setorTarefa.value,
    feita: false,
    eAplicacao: eAplicacaoCheckbox.checked,
    dosagem: eAplicacaoCheckbox.checked ? dosagemAplicacao.value.trim() : '',
    tipo: eAplicacaoCheckbox.checked ? tipoAplicacao.value : ''
  };

  if (!nova.data || !nova.descricao) {
    alert("Preencha todos os campos obrigatórios!");
    return;
  }

  if (indiceEdicaoTarefa !== null) {
    // Edição de tarefa existente
    tarefas[indiceEdicaoTarefa] = nova;
    indiceEdicaoTarefa = null;
    document.getElementById("btnCancelarEdicaoTarefa").style.display = "none";
  } else {
    // Adicionar nova tarefa
    tarefas.push(nova);
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
  const lista = document.getElementById('listaTarefas');
  lista.innerHTML = '';

  tarefas.forEach((t, index) => {
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
      <span>${t.data} - ${t.descricao} (${t.prioridade}) - ${t.setor}</span>
      <div class="botoes-tarefa">
        <button class="botao-circular azul" onclick="editarTarefa(${index})"><i class="fas fa-edit"></i></button>
        <button class="botao-circular vermelho" onclick="excluirTarefa(${index})"><i class="fas fa-trash"></i></button>
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

// ====== INICIALIZAR TAREFAS ======
document.addEventListener("dadosCarregados", carregarTarefas);

// ====== MOSTRAR CAMPOS DE APLICAÇÃO ======
function mostrarCamposAplicacao() {
  const checkbox = document.getElementById('eAplicacaoCheckbox');
  const campos = document.getElementById('camposAplicacao');
  campos.style.display = checkbox.checked ? 'block' : 'none';
}

// ====== CARREGAR TAREFAS ======
function carregarTarefas() {
  db.ref('Tarefas').on('value', (snapshot) => {
    tarefas = snapshot.exists() ? Object.values(snapshot.val()) : [];
    atualizarTarefas();
  });
}
