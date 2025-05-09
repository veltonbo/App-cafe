// js/aplicacao.js

document.addEventListener("DOMContentLoaded", () => {
  atualizarAplicacoes();
});

// Alterna a visibilidade do formulário
function alternarFormularioAplicacao() {
  const formulario = document.getElementById("formularioAplicacao");
  formulario.style.display = formulario.style.display === "none" ? "block" : "none";
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

  const novaAplicacao = { data, produto, dosagem, tipo, setor };
  const lista = document.getElementById("listaAplicacoes");

  const item = document.createElement("div");
  item.className = "item";
  item.innerHTML = `
    <strong>${data}</strong> - ${produto} (${dosagem}) - ${tipo} - ${setor}
    <div class="acoes">
      <button onclick="editarAplicacao(this)"><i class="fas fa-edit"></i></button>
      <button onclick="excluirAplicacao(this)"><i class="fas fa-trash-alt"></i></button>
    </div>
  `;
  lista.appendChild(item);

  cancelarAplicacao();
}

// Atualiza a listagem de aplicações
function atualizarAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  lista.innerHTML = ""; // Limpa a lista

  // Aqui vai o código para carregar as aplicações do Firebase futuramente
  console.log("Listagem de aplicações atualizada.");
}

// Função para cancelar aplicação
function cancelarAplicacao() {
  document.getElementById("formularioAplicacao").style.display = "none";
  document.getElementById("dataApp").value = "";
  document.getElementById("produtoApp").value = "";
  document.getElementById("dosagemApp").value = "";
  document.getElementById("tipoApp").value = "Adubo";
  document.getElementById("setorApp").value = "Setor 01";
}

// Função para excluir aplicação
function excluirAplicacao(botao) {
  botao.parentElement.parentElement.remove();
}

// Função para editar aplicação (em breve)
function editarAplicacao(botao) {
  alert("Funcionalidade de edição em breve.");
}
