  // aplicacao.js

// Inicializa Firebase
const db = firebase.database().ref("aplicacoes");

// Carrega Aplicações ao iniciar
document.addEventListener("DOMContentLoaded", carregarAplicacoes);

// Função para adicionar ou editar aplicação
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
    // Editando aplicação existente
    db.child(aplicacaoId).update({ data, produto, dosagem, tipo, setor });
    document.getElementById("btnSalvarAplicacao").removeAttribute("data-editing");
  } else {
    // Adicionando nova aplicação
    const novaAplicacao = db.push();
    novaAplicacao.set({ data, produto, dosagem, tipo, setor });
  }

  limparFormularioAplicacao();
  carregarAplicacoes();
}

// Função para cancelar a edição
function cancelarEdicaoAplicacao() {
  limparFormularioAplicacao();
}

// Função para limpar o formulário
function limparFormularioAplicacao() {
  document.getElementById("dataApp").value = "";
  document.getElementById("produtoApp").value = "";
  document.getElementById("dosagemApp").value = "";
  document.getElementById("tipoApp").value = "Adubo";
  document.getElementById("setorApp").value = "Setor 01";
  document.getElementById("btnSalvarAplicacao").removeAttribute("data-editing");
  document.getElementById("btnCancelarEdicaoApp").style.display = "none";
}

// Função para carregar aplicações do Firebase
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

// Função para editar uma aplicação
function editarAplicacao(id) {
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
}

// Função para excluir aplicação
function excluirAplicacao(id) {
  if (confirm("Tem certeza que deseja excluir esta aplicação?")) {
    db.child(id).remove();
    carregarAplicacoes();
  }
}

// Função para atualizar lista de aplicações
function atualizarAplicacoes() {
  const setorFiltro = document.getElementById("filtroSetorAplicacoes").value;
  const pesquisa = document.getElementById("pesquisaAplicacoes").value.toLowerCase();
  
  db.once("value", (snapshot) => {
    const lista = document.getElementById("listaAplicacoes");
    lista.innerHTML = "";

    snapshot.forEach((childSnapshot) => {
      const aplicacao = childSnapshot.val();
      const setorMatch = !setorFiltro || aplicacao.setor === setorFiltro;
      const pesquisaMatch = aplicacao.produto.toLowerCase().includes(pesquisa);

      if (setorMatch && pesquisaMatch) {
        const item = document.createElement("div");
        item.className = "item";
        item.innerHTML = `
          <div>
            <strong>${aplicacao.data}</strong> - ${aplicacao.produto} (${aplicacao.dosagem}) - ${aplicacao.tipo} - ${aplicacao.setor}
          </div>
          <div class="acoes">
            <button onclick="editarAplicacao('${childSnapshot.key}')"><i class="fas fa-edit"></i></button>
            <button onclick="excluirAplicacao('${childSnapshot.key}')"><i class="fas fa-trash-alt"></i></button>
          </div>
        `;
        lista.appendChild(item);
      }
    });
  });
}

// Função para exportar aplicações para CSV
function exportarAplicacoesCSV() {
  db.once("value", (snapshot) => {
    let csvContent = "Data,Produto,Dosagem,Tipo,Setor\n";
    snapshot.forEach((childSnapshot) => {
      const aplicacao = childSnapshot.val();
      csvContent += `${aplicacao.data},${aplicacao.produto},${aplicacao.dosagem},${aplicacao.tipo},${aplicacao.setor}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "aplicacoes.csv";
    link.click();
  });
}
