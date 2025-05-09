// js/aplicacao.js

document.addEventListener("DOMContentLoaded", () => {
  if (typeof firebase === "undefined" || !firebase.apps.length) {
    console.error("Firebase não carregado corretamente.");
    alert("Erro ao carregar o Firebase. Verifique a conexão.");
    return;
  }

  console.log("Firebase carregado corretamente.");
  carregarAplicacoes();
});

// Função para alternar o formulário
function alternarFormularioAplicacao() {
  const formulario = document.getElementById("formularioAplicacao");
  formulario.style.display = formulario.style.display === "none" ? "block" : "none";
}

// Função para salvar ou editar aplicação
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
  const db = firebase.database().ref("aplicacoes");

  if (aplicacaoId) {
    db.child(aplicacaoId).set({ data, produto, dosagem, tipo, setor });
  } else {
    db.push().set({ data, produto, dosagem, tipo, setor });
  }

  cancelarAplicacao();
  carregarAplicacoes();
}

// Função para carregar aplicações
function carregarAplicacoes() {
  const db = firebase.database().ref("aplicacoes");
  db.on("value", (snapshot) => {
    const lista = document.getElementById("listaAplicacoes");
    lista.innerHTML = "";

    snapshot.forEach((childSnapshot) => {
      const id = childSnapshot.key;
      const aplicacao = childSnapshot.val();
      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `
        <strong>${aplicacao.data}</strong> - ${aplicacao.produto} (${aplicacao.dosagem}) - ${aplicacao.tipo} - ${aplicacao.setor}
        <button onclick="editarAplicacao('${id}')"><i class="fas fa-edit"></i></button>
        <button onclick="excluirAplicacao('${id}')"><i class="fas fa-trash-alt"></i></button>
      `;
      lista.appendChild(item);
    });
  });
}

// Função para cancelar o formulário
function cancelarAplicacao() {
  document.getElementById("formularioAplicacao").style.display = "none";
  document.getElementById("dataApp").value = "";
  document.getElementById("produtoApp").value = "";
  document.getElementById("dosagemApp").value = "";
  document.getElementById("tipoApp").value = "Adubo";
  document.getElementById("setorApp").value = "Setor 01";
  document.getElementById("btnSalvarAplicacao").removeAttribute("data-editing");
}
