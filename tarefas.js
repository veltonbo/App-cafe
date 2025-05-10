// ====== VARIÁVEL GLOBAL ======
let tarefas = [];
let indiceEdicaoTarefa = null;

// ====== CARREGAR TAREFAS ======
function carregarTarefas() {
  db.ref('Tarefas').once('value').then(snap => {
    tarefas = snap.exists() ? snap.val() : [];
    atualizarTarefas();
  });
}

// ====== ATUALIZAR LISTA ======
function atualizarTarefas() {
  const listaAFazer = document.getElementById('listaTarefas');
  const listaFeitas = document.getElementById('listaTarefasFeitas');
  listaAFazer.innerHTML = '';
  listaFeitas.innerHTML = '';

  const filtroSetor = document.getElementById('filtroSetorTarefas').value;
  const termoBusca = document.getElementById('pesquisaTarefas').value.toLowerCase();

  tarefas
    .filter(t =>
      (!filtroSetor || t.setor === filtroSetor) &&
      (`${t.descricao} ${t.setor}`.toLowerCase().includes(termoBusca))
    )
    .sort((a, b) => (a.data > b.data ? -1 : 1))
    .forEach((t, i) => {
      const item = document.createElement('div');
      item.className = `item fade-in`;
      item.innerHTML = `
        <span>${t.data} - ${t.descricao} (${t.prioridade}) - ${t.setor}</span>
        <div class="botoes-tarefa">
          ${t.feita ? `
            <button class="botao-circular laranja" onclick="desfazerTarefa(${i})">
              <i class="fas fa-undo-alt"></i>
            </button>
          ` : `
            <button class="botao-circular verde" onclick="marcarTarefaComoFeita(${i})">
              <i class="fas fa-check"></i>
            </button>
            <button class="botao-circular azul" onclick="editarTarefa(${i})">
              <i class="fas fa-edit"></i>
            </button>
          `}
          <button class="botao-circular vermelho" onclick="excluirTarefa(${i})">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      `;
      (t.feita ? listaFeitas : listaAFazer).appendChild(item);
    });
}

// ====== ADICIONAR OU EDITAR TAREFA ======
function adicionarTarefa() {
  const nova = {
    data: document.getElementById('dataTarefa').value,
    descricao: document.getElementById('descricaoTarefa').value.trim(),
    prioridade: document.getElementById('prioridadeTarefa').value,
    setor: document.getElementById('setorTarefa').value,
    feita: false,
    eAplicacao: document.getElementById('eAplicacaoCheckbox').checked,
    dosagem: document.getElementById('dosagemAplicacao').value.trim(),
    tipo: document.getElementById('tipoAplicacao').value
  };

  if (indiceEdicaoTarefa !== null) {
    tarefas[indiceEdicaoTarefa] = nova;
    indiceEdicaoTarefa = null;
  } else {
    tarefas.push(nova);
  }

  db.ref('Tarefas').set(tarefas);
  atualizarTarefas();
  limparCamposTarefa();
  alternarFormularioTarefa();
}

// ====== EDITAR TAREFA ======
function editarTarefa(index) {
  const t = tarefas[index];
  document.getElementById('dataTarefa').value = t.data;
  document.getElementById('descricaoTarefa').value = t.descricao;
  document.getElementById('prioridadeTarefa').value = t.prioridade;
  document.getElementById('setorTarefa').value = t.setor;
  document.getElementById('eAplicacaoCheckbox').checked = t.eAplicacao;
  document.getElementById('dosagemAplicacao').value = t.dosagem || '';
  document.getElementById('tipoAplicacao').value = t.tipo || 'Adubo';
  mostrarCamposAplicacao();
  indiceEdicaoTarefa = index;
  document.getElementById("formularioTarefa").style.display = "block";
}

// ====== CANCELAR EDIÇÃO ======
function cancelarEdicaoTarefa() {
  limparCamposTarefa();
  indiceEdicaoTarefa = null;
  document.getElementById("formularioTarefa").style.display = "none";
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
  mostrarCamposAplicacao();
}

// ====== MOSTRAR CAMPOS DE APLICAÇÃO ======
function mostrarCamposAplicacao() {
  const campos = document.getElementById('camposAplicacao');
  campos.style.display = document.getElementById('eAplicacaoCheckbox').checked ? 'block' : 'none';
}


// ====== FUNÇÃO PARA ALTERNAR FORMULÁRIO ======
function alternarFormularioTarefa() {
  const form = document.getElementById("formularioTarefa");
  form.style.display = form.style.display === "none" ? "block" : "none";
  
  // Limpa os campos ao abrir
  if (form.style.display === "block") {
    limparCamposTarefa();
  }
}
