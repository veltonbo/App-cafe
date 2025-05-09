// ===== VARIÁVEIS GLOBAIS =====
let financeiro = [];
let financeiroPago = [];

// ===== FUNÇÃO: CARREGAR FINANCEIRO =====
function carregarFinanceiro() {
  const listaFinanceiro = document.getElementById("listaFinanceiro");
  listaFinanceiro.innerHTML = "";

  financeiro.forEach((fin, index) => {
    const item = document.createElement("div");
    item.classList.add("item");
    item.innerHTML = `
      <span>${fin.descricao} - R$ ${parseFloat(fin.valor).toFixed(2)}</span>
      <button onclick="pagarFinanceiro(${index})">Pagar</button>
      <button onclick="excluirFinanceiro(${index})">Excluir</button>
    `;
    listaFinanceiro.appendChild(item);
  });
}

// ===== FUNÇÃO: ADICIONAR FINANCEIRO =====
function adicionarFinanceiro() {
  const novo = {
    descricao: document.getElementById("descricaoFin").value.trim(),
    valor: parseFloat(document.getElementById("valorFin").value)
  };

  if (!novo.descricao || isNaN(novo.valor)) {
    alert("Preencha todos os campos.");
    return;
  }

  financeiro.push(novo);
  carregarFinanceiro();
  salvarDadosFirebase("financeiro", { financeiro, financeiroPago });
}

// ===== FUNÇÃO: PAGAR FINANCEIRO =====
function pagarFinanceiro(index) {
  const item = financeiro.splice(index, 1)[0];
  financeiroPago.push(item);
  carregarFinanceiro();
  salvarDadosFirebase("financeiro", { financeiro, financeiroPago });
}

// ===== FUNÇÃO: EXCLUIR FINANCEIRO =====
function excluirFinanceiro(index) {
  financeiro.splice(index, 1);
  carregarFinanceiro();
  salvarDadosFirebase("financeiro", { financeiro, financeiroPago });
}
