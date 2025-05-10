// ====== CARREGAR FINANCEIRO ======
function carregarFinanceiro() {
  const lista = document.getElementById("listaFinanceiro");
  lista.innerHTML = "";

  db.ref('Financeiro').on('value', snapshot => {
    lista.innerHTML = "";
    const lancamentos = snapshot.val() || [];
    lancamentos.forEach(lancamento => {
      const item = document.createElement('div');
      item.textContent = `${lancamento.data} - ${lancamento.produto} - R$ ${lancamento.valor}`;
      lista.appendChild(item);
    });
  });
}

// ====== ADICIONAR LANÇAMENTO (AUTOMÁTICO) ======
function adicionarFinanceiro() {
  const data = document.getElementById("dataFin").value;
  const produto = document.getElementById("produtoFin").value;
  const valor = parseFloat(document.getElementById("valorFin").value);

  if (data && produto && !isNaN(valor)) {
    db.ref('Financeiro').push({
      data: data,
      produto: produto,
      valor: valor
    });
  }
}
