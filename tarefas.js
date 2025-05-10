// ====== CARREGAR TAREFAS ======
function carregarTarefas() {
  const lista = document.getElementById("listaTarefas");
  lista.innerHTML = "";

  db.ref('Tarefas').on('value', snapshot => {
    lista.innerHTML = "";
    const tarefas = snapshot.val() || [];
    tarefas.forEach(tarefa => {
      const item = document.createElement('div');
      item.textContent = `${tarefa.data} - ${tarefa.descricao} (${tarefa.prioridade})`;
      lista.appendChild(item);
    });
  });
}

// ====== ADICIONAR TAREFA (AUTOMÁTICO) ======
function adicionarTarefa() {
  const data = document.getElementById("dataTarefa").value;
  const descricao = document.getElementById("descricaoTarefa").value;
  const prioridade = document.getElementById("prioridadeTarefa").value;

  if (data && descricao) {
    db.ref('Tarefas').push({
      data: data,
      descricao: descricao,
      prioridade: prioridade
    });
  }
}
