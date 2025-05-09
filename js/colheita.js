// ===== VARIÁVEIS GLOBAIS =====
let colheitas = [];
let colheitasPagas = [];

// ===== FUNÇÃO: CARREGAR COLHEITAS =====
function carregarColheita() {
  const listaColheitas = document.getElementById("listaColheitas");
  listaColheitas.innerHTML = "";

  colheitas.forEach((colheita, index) => {
    const item = document.createElement("div");
    item.classList.add("item");
    item.innerHTML = `
      <span>${colheita.colhedor} - ${colheita.quantidade} Latas</span>
      <button onclick="pagarColheita(${index})">Pagar</button>
      <button onclick="excluirColheita(${index})">Excluir</button>
    `;
    listaColheitas.appendChild(item);
  });
}

// ===== FUNÇÃO: ADICIONAR COLHEITA =====
function adicionarColheita() {
  const nova = {
    colhedor: document.getElementById("colhedor").value.trim(),
    quantidade: parseFloat(document.getElementById("quantidadeLatas").value)
  };

  if (!nova.colhedor || isNaN(nova.quantidade)) {
    alert("Preencha todos os campos.");
    return;
  }

  colheitas.push(nova);
  carregarColheita();
  salvarDadosFirebase("colheitas", { colheitas, colheitasPagas });
}

// ===== FUNÇÃO: PAGAR COLHEITA =====
function pagarColheita(index) {
  const item = colheitas.splice(index, 1)[0];
  colheitasPagas.push(item);
  carregarColheita();
  salvarDadosFirebase("colheitas", { colheitas, colheitasPagas });
}

// ===== FUNÇÃO: EXCLUIR COLHEITA =====
function excluirColheita(index) {
  colheitas.splice(index, 1);
  carregarColheita();
  salvarDadosFirebase("colheitas", { colheitas, colheitasPagas });
}
