// js/aplicacao.js

document.addEventListener("DOMContentLoaded", () => {
  carregarAplicacoes();
});

// Alterna a visibilidade do formulário
function alternarFormularioAplicacao() {
  const formulario = document.getElementById("formularioAplicacao");
  formulario.style.display = formulario.style.display === "none" ? "block" : "none";
}

// Função para salvar ou editar aplicação no Firebase
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
    // Atualiza a aplicação existente
    db.child(aplicacaoId).set(aplicacao);
    alert("Aplicação editada com sucesso!");
  } else {
    // Adiciona uma nova aplicação
    db.push().set(aplicacao);
    alert("Aplicação adicionada com sucesso!");
  }

  cancelarAplicacao();
  carregarAplicacoes();
}

// Função para carregar aplicações com filtro e ordenação
function carregarAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  lista.innerHTML = "";

  const filtroSetor = document.getElementById("filtroSetor").value;
  const termoPesquisa = document.getElementById("pesquisaAplicacao").value.trim().toLowerCase();

  db.once("value", (snapshot) => {
    lista.innerHTML = "";
    const aplicacoes = [];

    snapshot.forEach((childSnapshot) => {
      const id = childSnapshot.key;
      const aplicacao = childSnapshot.val();
      aplicacoes.push({ id, ...aplicacao });
    });

    // Ordena as aplicações do mais recente para o mais antigo
    aplicacoes.sort((a, b) => new Date(b.data) - new Date(a.data));

    aplicacoes.forEach((aplicacao) => {
      if ((filtroSetor === "" || aplicacao.setor === filtroSetor) &&
          (termoPesquisa === "" || 
           aplicacao.produto.toLowerCase().includes(termoPesquisa) ||
           aplicacao.tipo.toLowerCase().includes(termoPesquisa) ||
           aplicacao.dosagem.toLowerCase().includes(termoPesquisa))) {
        
        const item = document.createElement("div");
        item.className = "item";
        item.innerHTML = `
          <strong>${aplicacao.data}</strong> - ${aplicacao.produto} (${aplicacao.dosagem}) - ${aplicacao.tipo} - ${aplicacao.setor}
          <div class="acoes">
            <button onclick="editarAplicacao('${aplicacao.id}')"><i class="fas fa-edit"></i></button>
            <button onclick="excluirAplicacao('${aplicacao.id}')"><i class="fas fa-trash-alt"></i></button>
          </div>
        `;
        lista.appendChild(item);
      }
    });

    if (lista.innerHTML === "") {
      lista.innerHTML = "<p style='text-align:center; color: #aaa;'>Nenhuma aplicação encontrada.</p>";
    }
  });
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
    document.getElementById("btnSalvarAplicacao").innerText = "Salvar Alterações";
    document.getElementById("btnCancelarEdicao").style.display = "inline-block";
    alternarFormularioAplicacao();
  });
}

// Função para cancelar edição e limpar formulário
function cancelarAplicacao() {
  document.getElementById("formularioAplicacao").style.display = "none";
  document.getElementById("dataApp").value = "";
  document.getElementById("produtoApp").value = "";
  document.getElementById("dosagemApp").value = "";
  document.getElementById("tipoApp").value = "Adubo";
  document.getElementById("setorApp").value = "Setor 01";
  document.getElementById("btnSalvarAplicacao").removeAttribute("data-editing");
  document.getElementById("btnSalvarAplicacao").innerText = "Salvar";
  document.getElementById("btnCancelarEdicao").style.display = "none";
}

// Função para excluir aplicação
function excluirAplicacao(id) {
  if (confirm("Deseja realmente excluir esta aplicação?")) {
    db.child(id).remove();
    carregarAplicacoes();
  }
}
