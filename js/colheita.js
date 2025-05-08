// ===== VARIÁVEIS GLOBAIS =====
let colheitas = [];
let colheitasPagas = [];

// ===== FUNÇÃO: CARREGAR COLHEITAS =====
function carregarColheita() {
  atualizarColheita();
}

// ===== FUNÇÃO: ATUALIZAR COLHEITAS =====
function atualizarColheita() {
  const listaPendentes = document.getElementById("colheitaPendentes");
  const listaPagos = document.getElementById("colheitaPagos");
  const resumoColheita = document.getElementById("resumoColheita");

  listaPendentes.innerHTML = "";
  listaPagos.innerHTML = "";

  let totalLatas = 0;

  colheitas.forEach((colheita, index) => {
    totalLatas += parseFloat(colheita.quantidade);
    const item = document.createElement("div");
    item.classList.add("item");
    item.innerHTML = `
      <span>${colheita.data} - ${colheita.colhedor} - ${colheita.quantidade} Latas</span>
      <div class="botoes-acao">
        <button class="botao-circular verde" onclick="pagarColheita(${index})"><i class="fas fa-check"></i></button>
        <button class="botao-circular vermelho" onclick="excluirColheita(${index})"><i class="fas fa-trash-alt"></i></button>
      </div>
    `;
    listaPendentes.appendChild(item);
  });

  colheitasPagas.forEach((colheita, index) => {
    const item = document.createElement("div");
    item.classList.add("item");
    item.innerHTML = `
      <span>${colheita.data} - ${colheita.colhedor} - ${colheita.quantidade} Latas</span>
      <div class="botoes-acao">
        <button class="botao-circular laranja" onclick="desfazerPagamentoColheita(${index})"><i class="fas fa-undo-alt"></i></button>
        <button class="botao-circular vermelho" onclick="excluirColheitaPaga(${index})"><i class="fas fa-trash-alt"></i></button>
      </div>
    `;
    listaPagos.appendChild(item);
  });

  resumoColheita.textContent = `Total de Latas: ${totalLatas.toFixed(2)}`;
}

// ===== FUNÇÃO: ADICIONAR COLHEITA =====
function adicionarColheita() {
  const nova = {
    data: document.getElementById("dataColheita").value,
    colhedor: document.getElementById("colhedor").value.trim(),
    quantidade: parseFloat(document.getElementById("quantidadeLatas").value)
  };

  if (!nova.data || !nova.colhedor || isNaN(nova.quantidade)) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  colheitas.push(nova);
  limparCamposColheita();
  atualizarColheita();
}

// ===== FUNÇÃO: PAGAR COLHEITA =====
function pagarColheita(index) {
  const colheita = colheitas.splice(index, 1)[0];
  colheitasPagas.push(colheita);
  atualizarColheita();
}

// ===== FUNÇÃO: DESFAZER PAGAMENTO =====
function desfazerPagamentoColheita(index) {
  const colheita = colheitasPagas.splice(index, 1)[0];
  colheitas.push(colheita);
  atualizarColheita();
}

// ===== FUNÇÃO: EXCLUIR COLHEITA =====
function excluirColheita(index) {
  colheitas.splice(index, 1);
  atualizarColheita();
}

// ===== FUNÇÃO: EXCLUIR COLHEITA PAGA =====
function excluirColheitaPaga(index) {
  colheitasPagas.splice(index, 1);
  atualizarColheita();
}

// ===== FUNÇÃO: LIMPAR CAMPOS =====
function limparCamposColheita() {
  document.getElementById("dataColheita").value = "";
  document.getElementById("colhedor").value = "";
  document.getElementById("quantidadeLatas").value = "";
}
