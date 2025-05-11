// ===== CONFIGURAÇÃO DO FIREBASE PARA APLICAÇÕES =====
const dbAplicacao = firebase.database().ref('Aplicacoes');

// ===== SALVAR APLICAÇÃO =====
function salvarAplicacao() {
  const data = document.getElementById("dataApp").value;
  const produto = document.getElementById("produtoApp").value.trim();
  const dosagem = document.getElementById("dosagemApp").value.trim();
  const tipo = document.getElementById("tipoApp").value;
  const setor = document.getElementById("setorApp").value;

  if (!data || !produto || !dosagem) {
    alert("Preencha todos os campos corretamente!");
    return;
  }

  const novaAplicacao = { data, produto, dosagem, tipo, setor };
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
        <span>${formatarDataBR(app.data)} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}</span>
        <div class="botoes">
          <button onclick="editarAplicacao('${snap.key}')"><i class="fas fa-edit"></i></button>
          <button onclick="excluirAplicacao('${snap.key}')"><i class="fas fa-trash"></i></button>
        </div>
      `;
      lista.appendChild(item);
    });
  });
}

// ===== EDITAR APLICAÇÃO =====
function editarAplicacao(id) {
  dbAplicacao.child(id).once('value').then(snapshot => {
    const app = snapshot.val();
    document.getElementById("dataApp").value = app.data;
    document.getElementById("produtoApp").value = app.produto;
    document.getElementById("dosagemApp").value = app.dosagem;
    document.getElementById("tipoApp").value = app.tipo;
    document.getElementById("setorApp").value = app.setor;

    excluirAplicacao(id); // Remove o item para ser re-adicionado ao salvar
    mostrarFormulario('formularioAplicacoes');
  });
}

// ===== EXCLUIR APLICAÇÃO =====
function excluirAplicacao(id) {
  if (confirm("Deseja excluir esta aplicação?")) {
    dbAplicacao.child(id).remove();
  }
}

// ===== PESQUISAR APLICAÇÕES =====
function pesquisarAplicacoes() {
  const termo = document.getElementById("pesquisaApp").value.toLowerCase();
  dbAplicacao.once('value').then(snapshot => {
    const lista = document.getElementById("listaAplicacoes");
    lista.innerHTML = '';

    snapshot.forEach((snap) => {
      const app = snap.val();
      if (`${app.produto} ${app.tipo} ${app.setor}`.toLowerCase().includes(termo)) {
        const item = document.createElement("div");
        item.className = "item";
        item.innerHTML = `
          <span>${formatarDataBR(app.data)} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}</span>
          <div class="botoes">
            <button onclick="editarAplicacao('${snap.key}')"><i class="fas fa-edit"></i></button>
            <button onclick="excluirAplicacao('${snap.key}')"><i class="fas fa-trash"></i></button>
          </div>
        `;
        lista.appendChild(item);
      }
    });
  });
}
