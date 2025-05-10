// ====== CARREGAR COLHEITA ======
function carregarColheita() {
  const lista = document.getElementById("listaColheitas");
  lista.innerHTML = "";

  db.ref('Colheita').on('value', snapshot => {
    lista.innerHTML = "";
    const colheitas = snapshot.val() || [];
    colheitas.forEach(colheita => {
      const item = document.createElement('div');
      item.textContent = `${colheita.data} - ${colheita.colhedor} - ${colheita.quantidadeLatas} Latas`;
      lista.appendChild(item);
    });
  });
}

// ====== ADICIONAR COLHEITA (AUTOMÁTICO) ======
function adicionarColheita() {
  const data = document.getElementById("dataColheita").value;
  const colhedor = document.getElementById("colhedor").value;
  const quantidadeLatas = parseFloat(document.getElementById("quantidadeLatas").value);

  if (data && colhedor && !isNaN(quantidadeLatas)) {
    db.ref('Colheita').push({
      data: data,
      colhedor: colhedor,
      quantidadeLatas: quantidadeLatas
    });
  }
}
