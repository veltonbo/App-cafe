// ===== VARIÁVEIS GLOBAIS =====
let financeiro = [];
let financeiroPago = [];
let indiceEdicaoFinanceiro = null;

// ===== FUNÇÃO: CARREGAR FINANCEIRO =====
function carregarFinanceiro() {
  atualizarFinanceiro();
}

// ===== FUNÇÃO: ATUALIZAR FINANCEIRO =====
function atualizarFinanceiro() {
  const listaVencer = document.getElementById("financeiroVencer");
  const listaPago = document.getElementById("financeiroPago");
  listaVencer.innerHTML = "";
  listaPago.innerHTML = "";

  financeiro.forEach((fin, index) => {
    const item = document.createElement("div");
    item.classList.add("item");
    item.innerHTML = `
      <span>${fin.data} - ${fin.produto} - R$ ${parseFloat(fin.valor).toFixed(2)}</span>
      <div class="botoes-acao">
        <button class="botao-circular verde" onclick="pagarFinanceiro(${index})"><i class="fas fa-check"></i></button>
        <button class="botao-circular azul" onclick="editarFinanceiro(${index})"><i class="fas fa-edit"></i></button>
        <button class="botao-circular vermelho" onclick="excluirFinanceiro(${index})"><i class="fas fa-trash-alt"></i></button>
      </div>
    `;
    listaVencer.appendChild(item);
  });

  financeiroPago.forEach((fin, index) => {
    const item = document.createElement("div");
    item.classList.add("item");
    item.innerHTML = `
      <span>${fin.data} - ${fin.produto} - R$ ${parseFloat(fin.valor).toFixed(2)}</span>
      <div class="botoes-acao">
        <button class="botao-circular laranja" onclick="desfazerPagamento(${index})"><i class="fas fa-undo-alt"></i></button>
        <button class="botao-circular vermelho" onclick="excluirFinanceiroPago(${index})"><i class="fas fa-trash-alt"></i></button>
      </div>
    `;
    listaPago.appendChild(item);
  });
}

// ===== FUNÇÃO: ADICIONAR/EDITAR FINANCEIRO =====
function adicionarFinanceiro() {
  const novo = {
    data: document.getElementById("dataFin").value,
    produto: document.getElementById("produtoFin").value.trim(),
    valor: document.getElementById("valorFin").value.trim(),
    descricao: document.getElementById("descricaoFin").value.trim(),
    tipo: document.getElementById("tipoFin").value,
  };

  if (!novo.data || !novo.produto || !novo.valor) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  if (indiceEdicaoFinanceiro === null) {
    financeiro.push(novo);
  } else {
    financeiro[indiceEdicaoFinanceiro] = novo;
    indiceEdicaoFinanceiro = null;
  }

  limparCamposFinanceiro();
  atualizarFinanceiro();
}

// ===== FUNÇÕES: PAGAR E DESFAZER =====
function pagarFinanceiro(index) {
  const lancamento = financeiro.splice(index, 1)[0];
  financeiroPago.push(lancamento);
  atualizarFinanceiro();
}

function desfazerPagamento(index) {
  const lancamento = financeiroPago.splice(index, 1)[0];
  financeiro.push(lancamento);
  atualizarFinanceiro();
}

// ===== FUNÇÃO: EXCLUIR FINANCEIRO =====
function excluirFinanceiro(index) {
  financeiro.splice(index, 1);
  atualizarFinanceiro();
}

// ===== FUNÇÃO: EXCLUIR FINANCEIRO PAGO =====
function excluirFinanceiroPago(index) {
  financeiroPago.splice(index, 1);
  atualizarFinanceiro();
}

// ===== FUNÇÃO: LIMPAR CAMPOS =====
function limparCamposFinanceiro() {
  document.getElementById("dataFin").value = "";
  document.getElementById("produtoFin").value = "";
  document.getElementById("descricaoFin").value = "";
  document.getElementById("valorFin").value = "";
  document.getElementById("tipoFin").value = "Adubo";
}
