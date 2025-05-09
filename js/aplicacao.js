// js/aplicacao.js

document.addEventListener("DOMContentLoaded", () => {
  carregarAplicacoes();
});

// Alterna a visibilidade do formulário
function alternarFormularioAplicacao() {
  const formulario = document.getElementById("formularioAplicacao");
  formulario.style.display = formulario.style.display === "none" ? "block" : "none";
}

// Função para salvar aplicação no Firebase
function salvarAplicacao() {
  const data = document.getElementById("dataApp").value;
  const produto = document.getElementById("produtoApp").value;
  const dosagem = document.getElementById("dosagemApp").value;
  const tipo = document.getElementById("tipoApp").value;
  const setor = document.getElementById("setorApp").value;

  if (!data || !produto || !dosagem) {
    alert("Preencha todos os campos.");
    return;
  }

  const aplicacaoId = document.getElementById("btnSalvarAplicacao").dataset.editing;
  const aplicacao = { data, produto, dosagem, tipo, setor };

  if (aplicacaoId) {
    db.child(aplicacaoId).set(aplicacao);
  } else {
    db.push().set(aplicacao);
  }

  cancelarAplicacao();
  carregarAplicacoes();
}

// Função para carregar aplicações do Firebase
function carregarAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  lista.innerHTML = "";

  db.on("value", (snapshot) => {
    lista.innerHTML = ""; // Limpa a lista antes de atualizar

    snapshot.forEach((childSnapshot) => {
      const id = childSnapshot.key;
      const aplicacao = childSnapshot.val();

      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `
        <strong>${aplicacao.data}</strong> - ${aplicacao.produto} (${aplicacao.dosagem}) - ${aplicacao.tipo} - ${aplicacao.setor}
        <div class="acoes">
          <button onclick="editarAplicacao('${id}')"><i class="fas fa-edit"></i></button>
          <button onclick="excluirAplicacao('${id}')"><i class="fas fa-trash-alt"></i></button>
        </div>
      `;
      lista.appendChild(item);
    });
  });
}

// Função para excluir aplicação
function excluirAplicacao(id) {
  if (confirm("Deseja realmente excluir esta aplicação?")) {
    db.child(id).remove();
    carregarAplicacoes();
  }
}

// Função para editar aplicação
function editarAplicacao(id) {
  db.child(id).once("value", (snapshot) => {
    const aplicacao = snapshot.val();
    document.getElementById("dataApp").value = aplicacao.data;
    document.getElementById("produtoApp").value = aplicacao.produto;
    document.getElementById("dosagemApp").value = aplicacao.dosagem;
    document.getElementById("tipoApp").value = aplicacao.tipo;
    document.getElementById("setorApp").value = aplicacao.setor;

    document.getElementById("btnSalvarAplicacao").dataset.editing = id;
    alternarFormularioAplicacao();
  });
}

// Função para cancelar aplicação
function cancelarAplicacao() {
  document.getElementById("formularioAplicacao").style.display = "none";
  document.getElementById("dataApp").value = "";
  document.getElementById("produtoApp").value = "";
  document.getElementById("dosagemApp").value = "";
  document.getElementById("tipoApp").value = "Adubo";
  document.getElementById("setorApp").value = "Setor 01";
  document.getElementById("btnSalvarAplicacao").removeAttribute("data-editing");
}
