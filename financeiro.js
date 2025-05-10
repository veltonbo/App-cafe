// ====== CARREGAR FINANCEIRO ======
function carregarFinanceiro() {
  db.ref('Financeiro').on('value', snapshot => {
    const lista = document.getElementById("listaFinanceiro");
    lista.innerHTML = "";
    const lancamentos = snapshot.val() || [];

    lancamentos.forEach((lancamento, index) => {
      const item = document.createElement('div');
      item.className = 'item';
      item.innerHTML = `
        <span>${lancamento.data} - ${lancamento.produto} - R$ ${lancamento.valor.toFixed(2)}</span>
        <div class="botoes-acao">
          <button class="botao-circular azul" onclick="editarFinanceiro(${index})"><i class="fas fa-edit"></i></button>
          <button class="botao-circular vermelho" onclick="excluirFinanceiro(${index})"><i class="fas fa-trash-alt"></i></button>
        </div>
      `;
      lista.appendChild(item);
    });
  });
}

// ====== ADICIONAR LANÇAMENTO ======
function adicionarFinanceiro() {
  const data = document.getElementById("dataFin").value;
  const produto = document.getElementById("produtoFin").value;
  const valor = parseFloat(document.getElementById("valorFin").value);

  if (data && produto && !isNaN(valor)) {
    db.ref('Financeiro').push({ data, produto, valor });
    limparCamposFinanceiro();
  }
}

// ====== EDITAR LANÇAMENTO ======
function editarFinanceiro(index) {
  const lista = document.getElementById("listaFinanceiro");
  const item = lista.children[index];
  const [data, produto, valor] = item.textContent.split(" - ");

  document.getElementById("dataFin").value = data.trim();
  document.getElementById("produtoFin").value = produto.trim();
  document.getElementById("valorFin").value = parseFloat(valor.replace("R$", "").trim());
}

// ====== EXCLUIR LANÇAMENTO ======
function excluirFinanceiro(index) {
  if (confirm("Deseja excluir este lançamento?")) {
    db.ref(`Financeiro/${index}`).remove();
  }
}

// ====== LIMPAR CAMPOS DE FINANCEIRO ======
function limparCamposFinanceiro() {
  document.getElementById("dataFin").value = '';
  document.getElementById("produtoFin").value = '';
  document.getElementById("valorFin").value = '';
}
