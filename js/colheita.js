// ===== CONFIGURAÇÃO DO FIREBASE PARA COLHEITA =====
const dbColheita = firebase.database().ref('Colheita');

// ===== SALVAR COLHEITA =====
function salvarColheita() {
  const data = document.getElementById("dataColheita").value;
  const colhedor = document.getElementById("colhedor").value.trim();
  const quantidade = parseFloat(document.getElementById("quantidadeLatas").value);

  if (!data || !colhedor || isNaN(quantidade)) {
    alert("Preencha todos os campos corretamente!");
    return;
  }

  const novaColheita = { data, colhedor, quantidade };
  dbColheita.push(novaColheita);
  cancelarFormulario('formularioColheita');
  atualizarColheita();
}

// ===== ATUALIZAR LISTA DE COLHEITA =====
function atualizarColheita() {
  dbColheita.on('value', (snapshot) => {
    const lista = document.getElementById("listaColheita");
    lista.innerHTML = '';

    snapshot.forEach((snap) => {
      const c = snap.val();
      lista.innerHTML += `<div class="item">${c.data} - ${c.colhedor} - ${c.quantidade} Latas</div>`;
    });
  });
}

// ===== EXCLUIR COLHEITA =====
function excluirColheita(id) {
  if (confirm("Deseja excluir esta colheita?")) {
    dbColheita.child(id).remove();
  }
}
