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
  const filtro = pesquisaTarefas.value.toLowerCase();
  const filtroSetor = filtroSetorTarefas.value;
  listaTarefas.innerHTML = '';
  listaTarefasFeitas.innerHTML = '';
  const agrupado = {};

  tarefas.filter(t =>
    (`${t.data} ${t.descricao} ${t.prioridade} ${t.setor}`.toLowerCase().includes(filtro)) &&
    (filtroSetor === "" || t.setor === filtroSetor)
  ).forEach((t, i) => {
    if (!agrupado[t.data]) agrupado[t.data] = [];
    agrupado[t.data].push({ ...t, i });
  });

  for (const data in agrupado) {
    const titulo = document.createElement('div');
    titulo.className = 'grupo-data';
    titulo.textContent = data;
    listaTarefas.appendChild(titulo);
    agrupado[data].forEach(({ descricao, prioridade, setor, i }) => {
      const cor = prioridade === 'Alta' ? '#f44336' : prioridade === 'Média' ? '#ff9800' : '#4caf50';
      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML = `
        <input type="checkbox" onchange="marcarTarefa(${i}, this.checked)">
        <span style="color:${cor}">${descricao} (${prioridade}) - ${setor}</span>
        <div class="botoes-financeiro">
          <button class="botao-financeiro" onclick="marcarTarefa(${i}, true)">
            <i class="fas fa-check"></i>
          </button>
          <button class="botao-excluir" onclick="excluirTarefa(${i}, false)">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
      listaTarefas.appendChild(div);
    });
  }

  tarefasFeitas.filter(t =>
    (`${t.data} ${t.descricao} ${t.prioridade} ${t.setor}`.toLowerCase().includes(filtro)) &&
    (filtroSetor === "" || t.setor === filtroSetor)
  ).forEach((t, i) => {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <input type="checkbox" checked onchange="marcarTarefaFeita(${i}, this.checked)">
      <span>${t.data} - ${t.descricao} (${t.prioridade}) - ${t.setor}</span>
      <div class="botoes-financeiro">
        <button class="botao-financeiro" onclick="marcarTarefaFeita(${i}, false)">
          <i class="fas fa-undo"></i>
        </button>
        <button class="botao-excluir" onclick="excluirTarefa(${i}, true)">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    listaTarefasFeitas.appendChild(div);
  });
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
