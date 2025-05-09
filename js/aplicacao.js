// aplicacao.js

// Inicializa Firebase
document.addEventListener("DOMContentLoaded", () => {
  if (typeof firebase === "undefined") {
    alert("Firebase não está carregado corretamente.");
    return;
  }

  const db = firebase.database().ref("aplicacoes");

  // Carrega Aplicações ao iniciar
  carregarAplicacoes();

  // Função para adicionar ou editar aplicação
  document.getElementById("btnSalvarAplicacao").onclick = adicionarAplicacao;
  document.getElementById("btnCancelarEdicaoApp").onclick = cancelarEdicaoAplicacao;

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

    const aplicacaoId = document.getElementById("btnSalvarAplicacao").dataset.editing;
    if (aplicacaoId) {
      db.child(aplicacaoId).update({ data, produto, dosagem, tipo, setor });
      document.getElementById("btnSalvarAplicacao").removeAttribute("data-editing");
    } else {
      const novaAplicacao = db.push();
      novaAplicacao.set({ data, produto, dosagem, tipo, setor });
    }

    limparFormularioAplicacao();
    carregarAplicacoes();
  }

  function cancelarEdicaoAplicacao() {
    limparFormularioAplicacao();
  }

  function limparFormularioAplicacao() {
    document.getElementById("dataApp").value = "";
    document.getElementById("produtoApp").value = "";
    document.getElementById("dosagemApp").value = "";
    document.getElementById("tipoApp").value = "Adubo";
    document.getElementById("setorApp").value = "Setor 01";
    document.getElementById("btnSalvarAplicacao").removeAttribute("data-editing");
    document.getElementById("btnCancelarEdicaoApp").style.display = "none";
  }

  function carregarAplicacoes() {
    db.on("value", (snapshot) => {
      const lista = document.getElementById("listaAplicacoes");
      lista.innerHTML = "";

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

  window.editarAplicacao = function(id) {
    db.child(id).once("value").then((snapshot) => {
      const aplicacao = snapshot.val();
      document.getElementById("dataApp").value = aplicacao.data;
      document.getElementById("produtoApp").value = aplicacao.produto;
      document.getElementById("dosagemApp").value = aplicacao.dosagem;
      document.getElementById("tipoApp").value = aplicacao.tipo;
      document.getElementById("setorApp").value = aplicacao.setor;
      document.getElementById("btnSalvarAplicacao").setAttribute("data-editing", id);
      document.getElementById("btnCancelarEdicaoApp").style.display = "inline-block";
    });
  };

  window.excluirAplicacao = function(id) {
    if (confirm("Tem certeza que deseja excluir esta aplicação?")) {
      db.child(id).remove();
      carregarAplicacoes();
    }
  };
});
