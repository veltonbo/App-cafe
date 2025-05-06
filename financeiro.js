// ===== VARIÁVEIS =====
let gastos = [];

// ===== CARREGAR FINANCEIRO =====
function carregarFinanceiro() {
  firebase.database().ref("Financeiro").on("value", (snapshot) => {
    if (snapshot.exists()) {
      gastos = snapshot.val();
      atualizarFinanceiro();
    } else {
      gastos = [];
      atualizarFinanceiro();
    }
  });
}

// ===== ADICIONAR FINANCEIRO =====
function adicionarFinanceiro() {
  const data = document.getElementById("dataFin").value;
  const produto = document.getElementById("produtoFin").value.trim();
  const valor = parseFloat(document.getElementById("valorFin").value);
  const tipo = document.getElementById("tipoFin").value;

  if (!data || !produto || isNaN(valor)) {
    alert("Preencha todos os campos corretamente!");
    return;
  }

  const novoGasto = { data, produto, valor, tipo, pago: false };
  gastos.push(novoGasto);

  firebase.database().ref("Financeiro").set(gastos);
  atualizarFinanceiro();

  // Limpa campos
  document.getElementById("dataFin").value = "";
  document.getElementById("produtoFin").value = "";
  document.getElementById("valorFin").value = "";
}

// ===== ATUALIZAR INTERFACE =====
function atualizarFinanceiro() {
  const container = document.getElementById("financeiroVencer");
  container.innerHTML = "";

  if (!gastos.length) {
    container.innerHTML = "<p>Nenhum gasto registrado.</p>";
    return;
  }

  gastos.forEach((g, i) => {
    const div = document.createElement("div");
    div.className = "item botoes-2";
    div.innerHTML = `
      <span>
        <strong>${g.produto}</strong> - R$ ${g.valor.toFixed(2)} (${g.tipo})
        <br><small>${g.data}</small>
      </span>
    `;
    container.appendChild(div);
  });
}
