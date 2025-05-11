let aplicacoes = [];

function carregarAplicacoes() {
  atualizarAplicacoes();
}

function atualizarAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  lista.innerHTML = '';

  aplicacoes.forEach((app, index) => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <span>${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}</span>
      <button class="botao-expandir" onclick="alternarOpcoes(${index})">▶</button>
      <div class="botoes-opcoes" id="opcoes-${index}">
        <button class="botao-circular azul" onclick="editarAplicacao(${index})">✏️</button>
        <button class="botao-circular vermelho" onclick="excluirAplicacao(${index})">🗑️</button>
      </div>
    `;
    lista.appendChild(item);
  });
}

function alternarOpcoes(index) {
  document.getElementById(`opcoes-${index}`).classList.toggle("expanded");
}
