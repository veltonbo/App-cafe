// aplicacao.js

// Verifica se o Firebase está carregado corretamente
document.addEventListener("DOMContentLoaded", () => {
  if (typeof firebase === "undefined") {
    alert("Firebase não está carregado corretamente.");
    return;
  }

  const db = firebase.database().ref("aplicacoes");

  // Carrega as aplicações ao iniciar
  carregarAplicacoes();

  // Atribui eventos aos botões
  document.getElementById("btnSalvarAplicacao").onclick = adicionarAplicacao;
  document.getElementById("btnCancelarEdicaoApp").onclick = cancelarEdicaoAplicacao;
});

// Função para alternar o formulário de aplicação (Mostrar/Ocultar)
function alternarFormularioAplicacao() {
  const formulario = document.getElementById("formularioAplicacao");
  formulario.style.display = formulario.style.display === "none" ? "block" : "none";
  if (formulario.style.display === "block") {
    limparFormularioAplicacao(); // Limpa os campos ao abrir
  }
}

// Função para alternar os filtros (Mostrar/Ocultar)
function alternarFiltrosAplicacao() {
  const filtros = document.getElementById("filtrosAplicacoes");
  filtros.style.display = filtros.style.display === "none" ? "flex" : "none";
}

// Função para adicionar ou editar uma aplicação
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
    // Editando uma aplicação existente
    db.child(aplicacaoId).update({ data, produto, dosagem, tipo, setor });
  } else {
    // Adicionando uma nova aplicação
    db.push().set({ data, produto, dosagem, tipo, setor });
  }

  cancelarEdicaoAplicacao();
  carregarAplicacoes();
  document.getElementById("formularioAplicacao").style.display = "none";
}

// Função para cancelar a edição e limpar o formulário
function cancelarEdicaoAplicacao() {
  limparFormularioAplicacao();
  document.getElementById("formularioAplicacao").style.display = "none";
}

// Função para limpar o formulário de aplicação
function limparFormularioAplicacao() {
  document.getElementById("dataApp").value = "";
  document.getElementById("produtoApp").value = "";
  document.getElementById("dosagemApp").value = "";
  document.getElementById("tipoApp").value = "Adubo";
  document.getElementById("setorApp").value = "Setor 01";
  document.getElementById("btnSalvarAplicacao").removeAttribute("data-editing");
  document.getElementById("btnCancelarEdicaoApp").style.display = "none";
}

// Função para carregar as aplicações do Firebase
function carregarAplicacoes() {
  const db = firebase.database().ref("aplicacoes");
  const lista = document.getElementById("listaAplicacoes");
  lista.innerHTML = "";

  db.once("value", (snapshot) => {
    snapshot.forEach((childSnapshot) => {
      const id = childSnapshot.key;
      const aplicacao = childSnapshot.val();

      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `
        <div>
          <strong>${aplicacao.data}</strong> - ${aplicacao.produto} (${aplicacao.dosagem}) - ${aplicacao.tipo} - ${aplicacao.setor}
        </div>
        <div class="acoes">
          <button onclick="editarAplicacao('${id}')"><i class="fas fa-edit"></i></button>
          <button onclick="excluirAplicacao('${id}')"><i class="fas fa-trash-alt"></i></button>
        </div>
      `;
      lista.appendChild(item);
    });
  });
}

// Função para editar uma aplicação
function editarAplicacao(id) {
  const db = firebase.database().ref("aplicacoes");
  db.child(id).once("value").then((snapshot) => {
    const aplicacao = snapshot.val();
    document.getElementById("dataApp").value = aplicacao.data;
    document.getElementById("produtoApp").value = aplicacao.produto;
    document.getElementById("dosagemApp").value = aplicacao.dosagem;
    document.getElementById("tipoApp").value = aplicacao.tipo;
    document.getElementById("setorApp").value = aplicacao.setor;
    document.getElementById("btnSalvarAplicacao").setAttribute("data-editing", id);
    document.getElementById("btnCancelarEdicaoApp").style.display = "inline-block";
    document.getElementById("formularioAplicacao").style.display = "block";
  });
}

// Função para excluir uma aplicação
function excluirAplicacao(id) {
  if (confirm("Tem certeza que deseja excluir esta aplicação?")) {
    const db = firebase.database().ref("aplicacoes");
    db.child(id).remove();
    carregarAplicacoes();
  }
}
