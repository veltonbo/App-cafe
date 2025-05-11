// ===== CONFIGURAÇÃO DO FIREBASE PARA TAREFAS =====
const dbTarefas = firebase.database().ref('Tarefas');

// ===== SALVAR TAREFA =====
function salvarTarefa() {
  const data = document.getElementById("dataTarefa").value;
  const descricao = document.getElementById("descricaoTarefa").value.trim();

  if (!data || !descricao) {
    alert("Preencha todos os campos corretamente!");
    return;
  }

  const novaTarefa = { data, descricao };
  dbTarefas.push(novaTarefa);
  cancelarFormulario('formularioTarefas');
  atualizarTarefas();
}

// ===== ATUALIZAR LISTA DE TAREFAS =====
function atualizarTarefas() {
  dbTarefas.on('value', (snapshot) => {
    const lista = document.getElementById("listaTarefas");
    lista.innerHTML = '';

    snapshot.forEach((snap) => {
      const tarefa = snap.val();
      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `
        <span>${tarefa.data} - ${tarefa.descricao}</span>
        <div class="botoes">
          <button onclick="excluirTarefa('${snap.key}')"><i class="fas fa-trash"></i></button>
        </div>
      `;
      lista.appendChild(item);
    });
  });
}

// ===== EXCLUIR TAREFA =====
function excluirTarefa(id) {
  if (confirm("Deseja excluir esta tarefa?")) {
    dbTarefas.child(id).remove();
  }
}
