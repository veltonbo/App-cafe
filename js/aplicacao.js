// ===== VARIÁVEIS GLOBAIS =====
const dbAplicacao = firebase.database().ref('Aplicacoes');

// ===== CARREGAR APLICAÇÕES =====
function carregarAplicacoes() {
  dbAplicacao.on('value', (snapshot) => {
    const lista = document.getElementById("listaAplicacoes");
    lista.innerHTML = '';

    snapshot.forEach((snap) => {
      const app = snap.val();
      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `
        <span>${formatarDataBR(app.data)} - ${app.produto} (${app.tipo}) - ${app.dosagem}</span>
        <div class="botoes">
          <button onclick="editarAplicacao('${snap.key}')"><i class="fas fa-edit"></i></button>
          <button onclick="excluirAplicacao('${snap.key}')"><i class="fas fa-trash"></i></button>
        </div>
      `;
      lista.appendChild(item);
    });
  });
}

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
  cancelarFormularioAplicacao();
  carregarAplicacoes();
}

// ===== EDITAR APLICAÇÃO =====
function editarAplicacao(id) {
  dbAplicacao.child(id).once('value').then(snapshot => {
    const app = snapshot.val();
    document.getElementById("dataApp").value = app.data;
    document.getElementById("produtoApp").value = app.produto;
    document.getElementById("dosagemApp").value = app.dosagem;
    document.getElementById("tipoApp").value = app.tipo;

    excluirAplicacao(id); // Remove a aplicação para ser re-adicionada ao salvar
    mostrarFormularioAplicacao();
  });
}

// ===== EXCLUIR APLICAÇÃO =====
function excluirAplicacao(id) {
  if (confirm("Deseja excluir esta aplicação?")) {
    dbAplicacao.child(id).remove();
  }
}

// ===== MOSTRAR FORMULÁRIO =====
function mostrarFormularioAplicacao() {
  document.getElementById("formularioAplicacoes").style.display = "block";
}

// ===== CANCELAR FORMULÁRIO =====
function cancelarFormularioAplicacao() {
  document.getElementById("formularioAplicacoes").style.display = "none";
  document.getElementById("dataApp").value = '';
  document.getElementById("produtoApp").value = '';
  document.getElementById("dosagemApp").value = '';
  document.getElementById("tipoApp").value = 'Adubo';
}
