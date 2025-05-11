// ===== CONFIGURAÇÃO DO FIREBASE PARA FINANCEIRO =====
const dbFinanceiro = firebase.database().ref('Financeiro');

// ===== SALVAR GASTO =====
function salvarFinanceiro() {
  const data = document.getElementById("dataFin").value;
  const produto = document.getElementById("produtoFin").value.trim();
  const valor = parseFloat(document.getElementById("valorFin").value);

  if (!data || !produto || isNaN(valor)) {
    alert("Preencha todos os campos corretamente!");
    return;
  }

  const novoGasto = { data, produto, valor };
  dbFinanceiro.push(novoGasto);
  cancelarFormulario('formularioFinanceiro');
  atualizarFinanceiro();
}

// ===== ATUALIZAR LISTA DE GASTOS =====
function atualizarFinanceiro() {
  dbFinanceiro.on('value', (snapshot) => {
    const lista = document.getElementById("listaFinanceiro");
    lista.innerHTML = '';

    snapshot.forEach((snap) => {
      const gasto = snap.val();
      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `
        <span>${gasto.data} - ${gasto.produto} - R$ ${gasto.valor.toFixed(2)}</span>
        <div class="botoes">
          <button onclick="excluirGasto('${snap.key}')"><i class="fas fa-trash"></i></button>
        </div>
      `;
      lista.appendChild(item);
    });
  });
}

// ===== EXCLUIR GASTO =====
function excluirGasto(id) {
  if (confirm("Deseja excluir este gasto?")) {
    dbFinanceiro.child(id).remove();
  }
}
