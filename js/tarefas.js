// ====== MOSTRAR CAMPOS DE APLICAÇÃO ======
function mostrarCamposAplicacao() {
  const checkbox = document.getElementById('eAplicacaoCheckbox');
  const campos = document.getElementById('camposAplicacao');
  campos.style.display = checkbox.checked ? 'block' : 'none';
}

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
    tarefas[indiceEdicaoTarefa] = nova;
    indiceEdicaoTarefa = null;
  } else {
    tarefas.push(nova);
  }

  db.ref('Tarefas').set(tarefas);
  atualizarTarefas();
  limparCamposTarefa();
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
