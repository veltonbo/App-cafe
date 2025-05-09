// Alternar Visibilidade do Formulário
function alternarFormularioAplicacao() {
  const formulario = document.getElementById("formularioAplicacao");
  formulario.style.display = formulario.style.display === "none" ? "block" : "none";
}

// Alternar Visibilidade dos Filtros
function alternarFiltrosAplicacao() {
  const filtros = document.getElementById("filtrosAplicacoes");
  filtros.style.display = filtros.style.display === "none" ? "flex" : "none";
}

// Adicionar Aplicação
function adicionarAplicacao() {
  const data = document.getElementById("dataApp").value;
  const produto = document.getElementById("produtoApp").value;
  const dosagem = document.getElementById("dosagemApp").value;
  const tipo = document.getElementById("tipoApp").value;
  const setor = document.getElementById("setorApp").value;

  if (!data || !produto || !dosagem) {
    alert("Preencha todos os campos.");
    return;
  }

  const db = firebase.database().ref("aplicacoes");
  const aplicacaoId = document.getElementById("btnSalvarAplicacao").dataset.editing;

  if (aplicacaoId) {
    db.child(aplicacaoId).update({ data, produto, dosagem, tipo, setor });
  } else {
    db.push().set({ data, produto, dosagem, tipo, setor });
  }

  cancelarEdicaoAplicacao();
  carregarAplicacoes();
}

// Cancelar Edição
function cancelarEdicaoAplicacao() {
  limparFormularioAplicacao();
  document.getElementById("formularioAplicacao").style.display = "none";
}

// Limpar Formulário
function limparFormularioAplicacao() {
  document.getElementById("dataApp").value = "";
  document.getElementById("produtoApp").value = "";
  document.getElementById("dosagemApp").value = "";
  document.getElementById("tipoApp").value = "Adubo";
  document.getElementById("setorApp").value = "Setor 01";
}

// Carregar Aplicações
function carregarAplicacoes() {
  const db = firebase.database().ref("aplicacoes");
  db.on("value", (snapshot) => {
    const lista = document.getElementById("listaAplicacoes");
    lista.innerHTML = "";

    snapshot.forEach((childSnapshot) => {
      const id = childSnapshot.key;
      const aplicacao = childSnapshot.val();
      const item = `
        <div class="item">
          <div>${aplicacao.data} - ${aplicacao.produto} (${aplicacao.dosagem}) - ${aplicacao.tipo} - ${aplicacao.setor}</div>
          <div class="acoes">
            <button onclick="editarAplicacao('${id}')"><i class="fas fa-edit"></i></button>
            <button onclick="excluirAplicacao('${id}')"><i class="fas fa-trash-alt"></i></button>
          </div>
        </div>
      `;
      lista.insertAdjacentHTML('beforeend', item);
    });
  });
}
