document.addEventListener("DOMContentLoaded", () => {
  const db = firebase.database().ref("aplicacoes");

  // Carregar aplicações ao iniciar
  carregarAplicacoes();

  // Função para alternar o formulário de aplicação
  function alternarFormularioAplicacao() {
    const formulario = document.getElementById("formularioAplicacao");
    formulario.style.display = formulario.style.display === "flex" ? "none" : "flex";
    limparFormularioAplicacao();
  }

  // Função para salvar aplicação
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

    const idEdicao = document.getElementById("btnSalvarAplicacao").getAttribute("data-editing");
    
    if (idEdicao) {
      db.child(idEdicao).update({ data, produto, dosagem, tipo, setor });
    } else {
      db.push().set({ data, produto, dosagem, tipo, setor });
    }

    limparFormularioAplicacao();
    alternarFormularioAplicacao();
  }

  // Função para limpar o formulário
  function limparFormularioAplicacao() {
    document.getElementById("dataApp").value = "";
    document.getElementById("produtoApp").value = "";
    document.getElementById("dosagemApp").value = "";
    document.getElementById("tipoApp").value = "Adubo";
    document.getElementById("setorApp").value = "Setor 01";
    document.getElementById("btnCancelarEdicaoApp").style.display = "none";
  }

  // Função para carregar aplicações com filtro e pesquisa
  function carregarAplicacoes() {
    db.on("value", (snapshot) => {
      const lista = document.getElementById("listaAplicacoes");
      lista.innerHTML = "";

      const filtroSetor = document.getElementById("filtroSetorAplicacoes").value;
      const pesquisa = document.getElementById("pesquisaAplicacoes").value.toLowerCase();

      snapshot.forEach((childSnapshot) => {
        const id = childSnapshot.key;
        const aplicacao = childSnapshot.val();

        // Aplicar filtros
        if (filtroSetor && aplicacao.setor !== filtroSetor) return;
        if (pesquisa && !aplicacao.produto.toLowerCase().includes(pesquisa)) return;

        const item = document.createElement("div");
        item.className = "item";
        item.innerHTML = `
          <div>
            <strong>${aplicacao.data}</strong> - ${aplicacao.produto} (${aplicacao.dosagem}) - ${aplicacao.tipo} - ${aplicacao.setor}
          </div>
          <div class="acoes">
            <button onclick="editarAplicacao('${id}')"><i class="fas fa-edit"></i></button>
            <button onclick="excluirAplicacao('${id}')"><i class="fas fa-trash"></i></button>
          </div>
        `;
        lista.appendChild(item);
      });
    });
  }

  // Função para editar aplicação
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
      alternarFormularioAplicacao();
    });
  };

  // Função para excluir aplicação
  window.excluirAplicacao = function(id) {
    if (confirm("Tem certeza que deseja excluir esta aplicação?")) {
      db.child(id).remove();
    }
  };

  // Eventos para filtro e pesquisa
  document.getElementById("filtroSetorAplicacoes").addEventListener("change", carregarAplicacoes);
  document.getElementById("pesquisaAplicacoes").addEventListener("input", carregarAplicacoes);
});
