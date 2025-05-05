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
      item.className = 'item fade-in';
item.style.display = 'flex';
item.style.alignItems = 'center';
item.style.justifyContent = 'space-between';

      const aplicacaoExtra = t.eAplicacao ? ` - ${t.tipo} (${t.dosagem})` : '';

      item.innerHTML = `
      <span>${t.data} - ${t.descricao} (${t.prioridade}) - ${t.setor}${aplicacaoExtra}</span>
      <div class="botoes-tarefa">
          ${!t.feita ? `
            <button class="botao-circular verde" onclick="marcarTarefaComoFeita(${i})">
              <i class="fas fa-check"></i>
            </button>
            <button class="botao-circular azul" onclick="editarTarefa(${i})">
              <i class="fas fa-edit"></i>
            </button>
          ` : `
            <button class="botao-circular laranja" onclick="desfazerTarefa(${i})">
              <i class="fas fa-undo-alt"></i>
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

// ====== ADICIONAR OU SALVAR EDIÇÃO ======
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

  if (!nova.data || !nova.descricao) {
    alert("Preencha todos os campos obrigatórios!");
    return;
  }

  if (nova.eAplicacao && (!nova.dosagem || isNaN(parseFloat(nova.dosagem)) || parseFloat(nova.dosagem) <= 0)) {
    alert("A dosagem deve ser um número positivo.");
    return;
  }

  if (indiceEdicaoTarefa !== null) {
    tarefas[indiceEdicaoTarefa] = nova;
    indiceEdicaoTarefa = null;
    document.getElementById('btnCancelarEdicaoTarefa').style.display = 'none';
    document.querySelector('#tarefas button[onclick="adicionarTarefa()"]').innerText = "Salvar Tarefa";
  } else {
    tarefas.push(nova);
  }

  db.ref('Tarefas').set(tarefas);
  atualizarTarefas();
  limparCamposTarefa();
}

// ====== EDITAR ======
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
  mostrarCamposAplicacao();

  indiceEdicaoTarefa = index;
  document.querySelector('#tarefas button[onclick="adicionarTarefa()"]').innerText = "Salvar Edição";
  document.getElementById('btnCancelarEdicaoTarefa').style.display = 'inline-block';
}

function cancelarEdicaoTarefa() {
  limparCamposTarefa();
  indiceEdicaoTarefa = null;
  document.querySelector('#tarefas button[onclick="adicionarTarefa()"]').innerText = "Salvar Tarefa";
  document.getElementById('btnCancelarEdicaoTarefa').style.display = 'none';
}

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

// ====== MARCAR COMO FEITA ======
function marcarTarefaComoFeita(index) {
  const tarefa = tarefas[index];
  tarefa.feita = true;

  if (tarefa.eAplicacao) {
    db.ref('Aplicacoes').once('value').then(snap => {
      const aplicacoes = snap.exists() ? snap.val() : [];
      aplicacoes.push({
        data: tarefa.data,
        produto: tarefa.descricao,
        dosagem: tarefa.dosagem,
        tipo: tarefa.tipo,
        setor: tarefa.setor
      });
      db.ref('Aplicacoes').set(aplicacoes);
    });
  }

  db.ref('Tarefas').set(tarefas);
  atualizarTarefas();
}

// ====== DESFAZER ======
function desfazerTarefa(index) {
  const tarefa = tarefas[index];

  if (tarefa.eAplicacao) {
    db.ref('Aplicacoes').once('value').then(snap => {
      let aplicacoes = snap.exists() ? snap.val() : [];
      aplicacoes = aplicacoes.filter(app => !(app.produto === tarefa.descricao && app.data === tarefa.data));
      db.ref('Aplicacoes').set(aplicacoes);
    });
  }

  tarefa.feita = false;
  db.ref('Tarefas').set(tarefas);
  atualizarTarefas();
}

// ====== EXCLUIR ======
function excluirTarefa(index) {
  const tarefa = tarefas[index];

  if (!confirm("Deseja excluir esta tarefa?")) return;

  if (tarefa.feita && tarefa.eAplicacao) {
    db.ref('Aplicacoes').once('value').then(snap => {
      let aplicacoes = snap.exists() ? snap.val() : [];
      aplicacoes = aplicacoes.filter(app => !(app.produto === tarefa.descricao && app.data === tarefa.data));
      db.ref('Aplicacoes').set(aplicacoes);
    });
  }

  tarefas.splice(index, 1);
  db.ref('Tarefas').set(tarefas);
  atualizarTarefas();
}

// ====== MOSTRAR CAMPOS DE APLICAÇÃO ======
function mostrarCamposAplicacao() {
  const checkbox = document.getElementById('eAplicacaoCheckbox');
  const campos = document.getElementById('camposAplicacao');
  campos.style.display = checkbox.checked ? 'block' : 'none';
}
