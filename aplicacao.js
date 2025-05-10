// ====== CARREGAR APLICAÇÕES ======
function carregarAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  lista.innerHTML = "";

  db.ref('Aplicacoes').on('value', snapshot => {
    lista.innerHTML = "";
    const aplicacoes = snapshot.val() || [];
    aplicacoes.forEach(aplicacao => {
      const item = document.createElement('div');
      item.textContent = `${aplicacao.data} - ${aplicacao.produto} (${aplicacao.dosagem}) - ${aplicacao.tipo}`;
      lista.appendChild(item);
    });
  });
}

// ====== ADICIONAR APLICAÇÃO (AUTOMÁTICO) ======
function adicionarAplicacao() {
  const data = document.getElementById("dataApp").value;
  const produto = document.getElementById("produtoApp").value;
  const dosagem = document.getElementById("dosagemApp").value;
  const tipo = document.getElementById("tipoApp").value;

  if (data && produto && dosagem) {
    db.ref('Aplicacoes').push({
      data: data,
      produto: produto,
      dosagem: dosagem,
      tipo: tipo
    });
  }
}
