// ===== VARIÁVEIS GLOBAIS =====
const dbTarefas = firebase.database().ref('Tarefas');

// ===== CARREGAR TAREFAS =====
function carregarTarefas() {
  dbTarefas.on('value', (snapshot) => {
    const lista = document.getElementById("listaTarefas");
    lista.innerHTML = '';

    snapshot.forEach((snap) => {
      const tarefa = snap.val();
      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `
        <span>${formatarDataBR(tarefa.data)} - ${tarefa.descricao}</span>
        <div class="botoes">
          <button onclick="editarTarefa('${snap.key}')"><i class="fas fa-edit"></i></button>
          <button onclick="excluirTarefa('${snap.key}')"><i class="fas fa-trash"></i></button>
        </div>
      `;
      lista.appendChild(item);
    });
  });
}

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
  cancelarFormularioTarefa();
  carregarTarefas();
}

// ===== EDITAR TAREFA =====
function editarTarefa(id) {
  dbTarefas.child(id).once('value').then(snapshot => {
    const tarefa = snapshot.val();
    document.getElementById("dataTarefa").value = tarefa.data;
    document.getElementById("descricaoTarefa").value = tarefa.descricao;

    excluirTarefa(id);
    mostrarFormularioTarefa();
  });
}

// ===== EXCLUIR TAREFA =====
function excluirTarefa(id) {
  if (confirm("Deseja excluir esta tarefa?")) {
    dbTarefas.child(id).remove();
  }
}

// ===== MOSTRAR FORMULÁRIO =====
function mostrarFormularioTarefa() {
  document.getElementById("formularioTarefas").style.display = "block";
}

// ===== CANCELAR FORMULÁRIO =====
function cancelarFormularioTarefa() {
  document.getElementById("formularioTarefas").style.display = "none";
  document.getElementById("dataTarefa").value = '';
  document.getElementById("descricaoTarefa").value = '';
}
