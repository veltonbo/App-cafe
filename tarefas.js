// ====== VARIÁVEIS GLOBAIS ======
let tarefas = [];
let tarefasFeitas = [];

// ====== FUNÇÕES MENU TAREFAS ======

function adicionarTarefa() {
  const nova = {
    data: dataTarefa.value,
    descricao: descricaoTarefa.value,
    prioridade: prioridadeTarefa.value,
    setor: setorTarefa.value,
    executada: false,
    eAplicacao: eAplicacaoCheckbox.checked,
    dosagem: dosagemAplicacao.value,
    tipoAplicacao: tipoAplicacao.value
  };

  if (!nova.data || !nova.descricao) {
    alert("Preencha todos os campos da tarefa!");
    return;
  }

  tarefas.push(nova);
  salvarTarefas();
  atualizarTarefas();
}

function salvarTarefas() {
  db.ref('Tarefas').set([...tarefas, ...tarefasFeitas]);
}

function atualizarTarefas() {
  const listaAFazer = document.getElementById('listaTarefas');
  const listaFeitas = document.getElementById('listaTarefasFeitas');
  listaAFazer.innerHTML = '';
  listaFeitas.innerHTML = '';

  const filtroSetor = document.getElementById('filtroSetorTarefas').value;
  const termoBusca = document.getElementById('pesquisaTarefas').value.toLowerCase();

  const agrupadasAFazer = {};
  const agrupadasFeitas = {};

  tarefas
    .filter(t =>
      (!filtroSetor || t.setor === filtroSetor) &&
      (`${t.descricao} ${t.setor}`.toLowerCase().includes(termoBusca))
    )
    .forEach((t, i) => {
      const destino = t.feita ? agrupadasFeitas : agrupadasAFazer;
      if (!destino[t.data]) destino[t.data] = [];
      destino[t.data].push({ ...t, i });
    });

  // Tarefas a Fazer
  for (const data in agrupadasAFazer) {
    const grupo = document.createElement('div');
    grupo.className = 'grupo-data';
    grupo.textContent = data;
    listaAFazer.appendChild(grupo);

    agrupadasAFazer[data].forEach(({ descricao, prioridade, setor, i }) => {
      const item = document.createElement('div');
      item.className = 'item';
      item.innerHTML = `
        <span>${descricao} (${prioridade}) - ${setor}</span>
        <div class="botoes-financeiro">
          <button class="botao-financeiro" title="Concluir" onclick="marcarTarefaComoFeita(${i})">
            <i class="fas fa-check"></i>
          </button>
          <button class="botao-excluir" title="Excluir" onclick="excluirTarefa(${i})">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      `;
      listaAFazer.appendChild(item);
    });
  }

  // Tarefas Executadas
  for (const data in agrupadasFeitas) {
    const grupo = document.createElement('div');
    grupo.className = 'grupo-data';
    grupo.textContent = data;
    listaFeitas.appendChild(grupo);

    agrupadasFeitas[data].forEach(({ descricao, prioridade, setor, i }) => {
      const item = document.createElement('div');
      item.className = 'item';
      item.innerHTML = `
        <span>${descricao} (${prioridade}) - ${setor}</span>
        <div class="botoes-financeiro">
          <button class="botao-financeiro" title="Desfazer" onclick="desfazerTarefa(${i})">
            <i class="fas fa-undo-alt"></i>
          </button>
          <button class="botao-excluir" title="Excluir" onclick="excluirTarefa(${i})">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      `;
      listaFeitas.appendChild(item);
    });
  }
}

function marcarTarefa(index, checked) {
  if (checked) {
    const tarefaExecutada = tarefas.splice(index, 1)[0];
    tarefaExecutada.executada = true;
    tarefasFeitas.push(tarefaExecutada);

    if (tarefaExecutada.eAplicacao) {
      const novaAplicacao = {
        data: tarefaExecutada.data,
        produto: tarefaExecutada.descricao,
        dosagem: tarefaExecutada.dosagem || '',
        tipo: tarefaExecutada.tipoAplicacao || '',
        setor: tarefaExecutada.setor || ''
      };
      aplicacoes.push(novaAplicacao);
      db.ref('Aplicacoes').set(aplicacoes);
      atualizarAplicacoes();
    }
  } else {
    tarefasFeitas[index].executada = false;
    tarefas.push(tarefasFeitas.splice(index, 1)[0]);
  }

  salvarTarefas();
  atualizarTarefas();
}

function marcarTarefaFeita(index, checked) {
  if (!checked) {
    tarefasFeitas[index].executada = false;
    tarefas.push(tarefasFeitas.splice(index, 1)[0]);
  }

  salvarTarefas();
  atualizarTarefas();
}

function excluirTarefa(index, feita) {
  if (feita) {
    tarefasFeitas.splice(index, 1);
  } else {
    tarefas.splice(index, 1);
  }

  salvarTarefas();
  atualizarTarefas();
}

function mostrarCamposAplicacao() {
  camposAplicacao.style.display = eAplicacaoCheckbox.checked ? 'block' : 'none';
}

function carregarTarefas() {
  db.ref('Tarefas').on('value', snap => {
    if (snap.exists()) {
      tarefas.length = 0;
      tarefasFeitas.length = 0;
      snap.val().forEach(t => (t.executada ? tarefasFeitas : tarefas).push(t));
      atualizarTarefas();
    }
  });
}
