let tarefas = [];

function carregarTarefas() {
  atualizarTarefas();
}

function atualizarTarefas() {
  const lista = document.getElementById("listaTarefas");
  lista.innerHTML = '';

  tarefas.forEach((tarefa, index) => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <span>${tarefa.descricao}</span>
      <button class="botao-expandir" onclick="alternarOpcoes(${index})">▶</button>
      <div class="botoes-opcoes" id="opcoes-tarefa-${index}">
        <button class="botao-circular azul" onclick="editarTarefa(${index})">✏️</button>
        <button class="botao-circular vermelho" onclick="excluirTarefa(${index})">🗑️</button>
      </div>
    `;
    lista.appendChild(item);
  });
}
