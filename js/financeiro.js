let financeiro = [];

function carregarFinanceiro() {
  atualizarFinanceiro();
}

function atualizarFinanceiro() {
  const lista = document.getElementById("listaFinanceiro");
  lista.innerHTML = '';

  financeiro.forEach((fin, index) => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <span>${fin.descricao} - ${fin.valor}</span>
      <button class="botao-expandir" onclick="alternarOpcoes(${index})">▶</button>
      <div class="botoes-opcoes" id="opcoes-financeiro-${index}">
        <button class="botao-circular azul" onclick="editarFinanceiro(${index})">✏️</button>
        <button class="botao-circular vermelho" onclick="excluirFinanceiro(${index})">🗑️</button>
      </div>
    `;
    lista.appendChild(item);
  });
}
