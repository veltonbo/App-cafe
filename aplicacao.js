// ====== CARREGAR APLICAÇÕES ======
function carregarAplicacoes() {
  db.ref('Aplicacoes').on('value', snapshot => {
    const lista = document.getElementById("listaAplicacoes");
    lista.innerHTML = "";
    const aplicacoes = snapshot.val() || [];

    aplicacoes.forEach((app, index) => {
      const item = document.createElement('div');
      item.className = 'item';
      item.innerHTML = `
        <span>${app.data} - ${app.produto} (${app.dosagem}) - ${app.tipo}</span>
        <div class="botoes-acao">
          <button class="botao-circular verde" onclick="editarAplicacao(${index})"><i class="fas fa-edit"></i></button>
          <button class="botao-circular vermelho" onclick="excluirAplicacao(${index})"><i class="fas fa-trash-alt"></i></button>
        </div>
      `;
      lista.appendChild(item);
    });
  });
}

// ====== ADICIONAR APLICAÇÃO ======
function adicionarAplicacao() {
  const data = document.getElementById("dataApp").value;
  const produto = document.getElementById("produtoApp").value;
  const dosagem = document.getElementById("dosagemApp").value;
  const tipo = document.getElementById("tipoApp").value;

  if (data && produto && dosagem) {
    db.ref('Aplicacoes').push({ data, produto, dosagem, tipo });
    limparCamposAplicacao();
  }
}

// ====== EDITAR APLICAÇÃO ======
function editarAplicacao(index) {
  const lista = document.getElementById("listaAplicacoes");
  const item = lista.children[index];
  const [data, produto, dosagem, tipo] = item.textContent.split(" - ");

  document.getElementById("dataApp").value = data.trim();
  document.getElementById("produtoApp").value = produto.trim();
  document.getElementById("dosagemApp").value = dosagem.replace("(", "").replace(")", "").trim();
  document.getElementById("tipoApp").value = tipo.trim();
}

// ====== EXCLUIR APLICAÇÃO ======
function excluirAplicacao(index) {
  if (confirm("Deseja excluir esta aplicação?")) {
    db.ref(`Aplicacoes/${index}`).remove();
  }
}

// ====== LIMPAR CAMPOS DE APLICAÇÃO ======
function limparCamposAplicacao() {
  document.getElementById("dataApp").value = '';
  document.getElementById("produtoApp").value = '';
  document.getElementById("dosagemApp").value = '';
  document.getElementById("tipoApp").value = 'Adubo';
}
