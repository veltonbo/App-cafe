// ===== VARIÁVEIS GLOBAIS =====
let aplicacoes = [];

// ===== FUNÇÃO: CARREGAR APLICAÇÕES =====
function carregarAplicacoes() {
  const listaAplicacoes = document.getElementById("listaAplicacoes");
  listaAplicacoes.innerHTML = "";

  aplicacoes.forEach((app, index) => {
    const item = document.createElement("div");
    item.classList.add("item");
    item.innerHTML = `
      <span>${app.data} - ${app.produto} (${app.dosagem})</span>
      <button onclick="excluirAplicacao(${index})">Excluir</button>
    `;
    listaAplicacoes.appendChild(item);
  });
}

// ===== FUNÇÃO: ADICIONAR APLICAÇÃO =====
function adicionarAplicacao() {
  const nova = {
    data: document.getElementById("dataApp").value,
    produto: document.getElementById("produtoApp").value,
    dosagem: document.getElementById("dosagemApp").value
  };

  aplicacoes.push(nova);
  carregarAplicacoes();
}

// ===== FUNÇÃO: EXCLUIR APLICAÇÃO =====
function excluirAplicacao(index) {
  aplicacoes.splice(index, 1);
  carregarAplicacoes();
}
