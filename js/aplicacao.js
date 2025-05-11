// ===== CONFIGURAÇÃO DO FIREBASE PARA APLICAÇÕES =====
const dbAplicacao = firebase.database().ref('Aplicacoes');

// ===== SALVAR APLICAÇÃO =====
function salvarAplicacao() {
  const data = document.getElementById("dataApp").value;
  const produto = document.getElementById("produtoApp").value.trim();
  const dosagem = document.getElementById("dosagemApp").value.trim();
  const tipo = document.getElementById("tipoApp").value;

  if (!data || !produto || !dosagem) {
    alert("Preencha todos os campos corretamente!");
    return;
  }

  const novaAplicacao = { data, produto, dosagem, tipo };
  dbAplicacao.push(novaAplicacao);
  cancelarFormulario('formularioAplicacoes');
  atualizarAplicacoes();
}

// ===== ATUALIZAR LISTA DE APLICAÇÕES =====
function atualizarAplicacoes() {
  dbAplicacao.on('value', (snapshot) => {
    const lista = document.getElementById("listaAplicacoes");
    lista.innerHTML = '';

    snapshot.forEach((snap) => {
      const app = snap.val();
      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `
        <span>${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem}</span>
        <div class="botoes">
          <button onclick="excluirAplicacao('${snap.key}')"><i class="fas fa-trash"></i></button>
        </div>
      `;
      lista.appendChild(item);
    });
  });
}

// ===== EXCLUIR APLICAÇÃO =====
function excluirAplicacao(id) {
  if (confirm("Deseja excluir esta aplicação?")) {
    dbAplicacao.child(id).remove();
  }
}
