// ====== CARREGAR TAREFAS ======
function carregarTarefas() {
  db.ref('Tarefas').on('value', snapshot => {
    const lista = document.getElementById("listaTarefas");
    lista.innerHTML = "";
    const tarefas = snapshot.val() || [];

    tarefas.forEach((tarefa, index) => {
      const item = document.createElement('div');
      item.className = 'item';
      item.innerHTML = `
        <span>${tarefa.data} - ${tarefa.descricao} (${tarefa.prioridade})</span>
        <div class="botoes-acao">
          <button class="botao-circular verde" onclick="marcarTarefa(${index})"><i class="fas fa-check"></i></button>
          <button class="botao-circular vermelho" onclick="excluirTarefa(${index})"><i class="fas fa-trash-alt"></i></button>
        </div>
      `;
      lista.appendChild(item);
    });
  });
}

// ====== ADICIONAR TAREFA ======
function adicionarTarefa() {
  const data = document.getElementById("dataTarefa").value;
  const descricao = document.getElementById("descricaoTarefa").value;
  const prioridade = document.getElementById("prioridadeTarefa").value;

  if (data && descricao) {
    db.ref('Tarefas').push({ data, descricao, prioridade });
    limparCamposTarefa();
  }
}

// ====== EXCLUIR TAREFA ======
function excluirTarefa(index) {
  if (confirm("Deseja excluir esta tarefa?")) {
    db.ref(`Tarefas/${index}`).remove();
  }
}

// ====== LIMPAR CAMPOS DE TAREFA ======
function limparCamposTarefa() {
  document.getElementById("dataTarefa").value = '';
  document.getElementById("descricaoTarefa").value = '';
  document.getElementById("prioridadeTarefa").value = 'Alta';
}
