// js/aplicacao.js

// Inicialização do Firebase e do Banco de Dados
document.addEventListener("DOMContentLoaded", () => {
  if (typeof firebase === "undefined") {
    console.error("Firebase não carregado corretamente.");
    return;
  }

  const db = firebase.database().ref("aplicacoes");

  // Carregar aplicações ao iniciar
  carregarAplicacoes();

  // Botão de Salvar Aplicação
  document.getElementById("btnSalvarAplicacao").onclick = salvarAplicacao;
  document.getElementById("btnCancelarEdicaoApp").onclick = cancelarEdicaoAplicacao;
});

// Função para carregar aplicações
function carregarAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  lista.innerHTML = ""; // Limpa a lista

  firebase.database().ref("aplicacoes").on("value", (snapshot) => {
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

// Função para salvar uma nova aplicação ou editar existente
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
    db.child(aplicacaoId).update({ data, produto, dosagem, tipo, setor });
  } else {
    db.push().set({ data, produto, dosagem, tipo, setor });
  }

  cancelarEdicaoAplicacao();
  carregarAplicacoes();
}

// Função para editar aplicação
function editarAplicacao(id) {
  firebase.database().ref("aplicacoes").child(id).once("value").then((snapshot) => {
    const aplicacao = snapshot.val();
    document.getElementById("dataApp").value = aplicacao.data;
    document.getElementById("produtoApp").value = aplicacao.produto;
    document.getElementById("dosagemApp").value = aplicacao.dosagem;
    document.getElementById("tipoApp").value = aplicacao.tipo;
    document.getElementById("setorApp").value = aplicacao.setor;
    document.getElementById("btnSalvarAplicacao").dataset.editing = id;
    document.getElementById("btnCancelarEdicaoApp").style.display = "inline-block";
  });
}

// Função para excluir aplicação
function excluirAplicacao(id) {
  if (confirm("Tem certeza que deseja excluir esta aplicação?")) {
    firebase.database().ref("aplicacoes").child(id).remove();
    carregarAplicacoes();
  }
}

// Função para cancelar edição
function cancelarEdicaoAplicacao() {
  document.getElementById("dataApp").value = "";
  document.getElementById("produtoApp").value = "";
  document.getElementById("dosagemApp").value = "";
  document.getElementById("tipoApp").value = "Adubo";
  document.getElementById("setorApp").value = "Setor 01";
  document.getElementById("btnSalvarAplicacao").removeAttribute("data-editing");
  document.getElementById("btnCancelarEdicaoApp").style.display = "none";
}

// Função para alternar exibição do formulário
function alternarFormularioAplicacao() {
  const formulario = document.getElementById("formularioAplicacao");
  formulario.style.display = formulario.style.display === "none" ? "block" : "none";
}

// Função para exportar aplicações para CSV
function exportarAplicacoesCSV() {
  const db = firebase.database().ref("aplicacoes");
  db.once("value").then((snapshot) => {
    let csv = "Data,Produto,Dosagem,Tipo,Setor\n";
    snapshot.forEach((childSnapshot) => {
      const aplicacao = childSnapshot.val();
      csv += `${aplicacao.data},${aplicacao.produto},${aplicacao.dosagem},${aplicacao.tipo},${aplicacao.setor}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aplicacoes.csv";
    a.click();
  });
}
