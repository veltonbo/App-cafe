// ====== CARREGAR COLHEITA ======
function carregarColheita() {
  db.ref('Colheita').on('value', snapshot => {
    const lista = document.getElementById("listaColheitas");
    lista.innerHTML = "";
    const colheitas = snapshot.val() || [];

    colheitas.forEach((colheita, index) => {
      const item = document.createElement('div');
      item.className = 'item';
      item.innerHTML = `
        <span>${colheita.data} - ${colheita.colhedor} - ${colheita.quantidadeLatas} Latas</span>
        <div class="botoes-acao">
          <button class="botao-circular vermelho" onclick="excluirColheita(${index})"><i class="fas fa-trash-alt"></i></button>
        </div>
      `;
      lista.appendChild(item);
    });
  });
}

// ====== ADICIONAR COLHEITA ======
function adicionarColheita() {
  const data = document.getElementById("dataColheita").value;
  const colhedor = document.getElementById("colhedor").value;
  const quantidadeLatas = parseFloat(document.getElementById("quantidadeLatas").value);

  if (data && colhedor && !isNaN(quantidadeLatas)) {
    db.ref('Colheita').push({ data, colhedor, quantidadeLatas });
    limparCamposColheita();
  }
}

// ====== EXCLUIR COLHEITA ======
function excluirColheita(index) {
  if (confirm("Deseja excluir esta colheita?")) {
    db.ref(`Colheita/${index}`).remove();
  }
}

// ====== LIMPAR CAMPOS DE COLHEITA ======
function limparCamposColheita() {
  document.getElementById("dataColheita").value = '';
  document.getElementById("colhedor").value = '';
  document.getElementById("quantidadeLatas").value = '';
}
