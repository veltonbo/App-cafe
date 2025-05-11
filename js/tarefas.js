// ====== VARIÁVEL GLOBAL ======
let tarefas = [];
let indiceEdicaoTarefa = null;

// ====== CARREGAR TAREFAS ======
function carregarTarefas() {
  db.ref('Tarefas').on('value', snap => {
    tarefas = snap.exists() ? Object.values(snap.val()) : [];
    atualizarTarefas();
  });
}

// ====== ATUALIZAR LISTA ======
function atualizarTarefas() {
  const listaAFazer = document.getElementById('listaTarefas');
  const listaFeitas = document.getElementById('listaTarefasFeitas');
  listaAFazer.innerHTML = '';
  listaFeitas.innerHTML = '';

  const filtroSetor = document.getElementById('filtroSetorTarefas')?.value || '';
  const termoBusca = document.getElementById('pesquisaTarefas')?.value.toLowerCase() || '';

  tarefas
    .filter(t =>
      (!filtroSetor || t.setor === filtroSetor) &&
      (`${t.descricao} ${t.setor}`.toLowerCase().includes(termoBusca))
    )
    .sort((a, b) => new Date(b.data) - new Date(a.data))
    .forEach((t, i) => {
      const item = document.createElement('div');
      item.className = 'item';
      item.innerHTML = `
        <span>${t.data} - ${t.descricao} (${t.prioridade}) - ${t.setor}</span>
        <div class="botoes-tarefa">
          ${t.feita ? `
            <button class="botao-circular laranja" onclick="desfazerTarefa(${i})">
              <i class="fas fa-undo-alt"></i>
            </button>` : `
            <button class="botao-circular verde" onclick="marcarTarefaComoFeita(${i})">
              <i class="fas fa-check"></i>
            </button>
            <button class="botao-circular azul" onclick="editarTarefa(${i})">
              <i class="fas fa-edit"></i>
            </button>`}
          <button class="botao-circular vermelho" onclick="excluirTarefa(${i})">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      `;
      (t.feita ? listaFeitas : listaAFazer).appendChild(item);
    });
}

// ====== ADICIONAR OU SALVAR EDIÇÃO ======
function adicionarTarefa() {
  const dataTarefa = document.getElementById('dataTarefa');
  const descricaoTarefa = document.getElementById('descricaoTarefa');
  const prioridadeTarefa = document.getElementById('prioridadeTarefa');
  const setorTarefa = document.getElementById('setorTarefa');
  const eAplicacaoCheckbox = document.getElementById('eAplicacaoCheckbox');
  const dosagemAplicacao = document.getElementById('dosagemAplicacao');
  const tipoAplicacao = document.getElementById('tipoAplicacao');

  // Verificar se todos os campos existem
  if (!dataTarefa || !descricaoTarefa || !prioridadeTarefa || !setorTarefa) {
    console.error("Campos do formulário de tarefas não encontrados.");
    return;
  }

  const nova = {
    data: dataTarefa.value,
    descricao: descricaoTarefa.value.trim(),
    prioridade: prioridadeTarefa.value,
    setor: setorTarefa.value,
    feita: false,
    eAplicacao: eAplicacaoCheckbox ? eAplicacaoCheckbox.checked : false,
    dosagem: dosagemAplicacao ? dosagemAplicacao.value.trim() : '',
    tipo: tipoAplicacao ? tipoAplicacao.value : 'Adubo'
  };

  if (!nova.data || !nova.descricao) {
    alert("Preencha todos os campos obrigatórios!");
    return;
  }

  if (indiceEdicaoTarefa !== null) {
    tarefas[indiceEdicaoTarefa] = nova;
    indiceEdicaoTarefa = null;
  } else {
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
}

// ====== LIMPAR CAMPOS ======
function limparCamposTarefa() {
  document.getElementById('dataTarefa').value = '';
  document.getElementById('descricaoTarefa').value = '';
  document.getElementById('prioridadeTarefa').value = 'Alta';
  document.getElementById('setorTarefa').value = 'Setor 01';
  document.getElementById('eAplicacaoCheckbox').checked = false;
  document.getElementById('dosagemAplicacao').value = '';
  document.getElementById('tipoAplicacao').value = 'Adubo';
}

// ====== MARCAR COMO FEITA ======
function marcarTarefaComoFeita(index) {
  tarefas[index].feita = true;
  db.ref('Tarefas').set(tarefas);
  atualizarTarefas();
}

// ====== DESFAZER TAREFA ======
function desfazerTarefa(index) {
  tarefas[index].feita = false;
  db.ref('Tarefas').set(tarefas);
  atualizarTarefas();
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
