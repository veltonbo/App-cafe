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

  const lista = document.getElementById("listaAplicacoes");
  const item = document.createElement("div");
  item.className = "item";
  item.innerHTML = `
    <strong>${data}</strong> - ${produto} (${dosagem}) - ${tipo} - ${setor}
    <div class="acoes">
      <button onclick="editarAplicacao(this)"><i class="fas fa-edit"></i></button>
      <button onclick="excluirAplicacao(this)"><i class="fas fa-trash"></i></button>
    </div>
  `;
  lista.appendChild(item);

  alternarFormularioAplicacao();
}

// Função para limpar o formulário
function limparFormularioAplicacao() {
  document.getElementById("dataApp").value = "";
  document.getElementById("produtoApp").value = "";
  document.getElementById("dosagemApp").value = "";
  document.getElementById("tipoApp").value = "Adubo";
  document.getElementById("setorApp").value = "Setor 01";
}

// Função para cancelar edição
function cancelarEdicaoAplicacao() {
  limparFormularioAplicacao();
  document.getElementById("btnSalvarAplicacao").removeAttribute("data-editing");
  document.getElementById("btnCancelarEdicaoApp").style.display = "none";
}

// Função para editar aplicação
function editarAplicacao(button) {
  const item = button.parentElement.parentElement;
  const [data, produto, dosagem, tipo, setor] = item.innerText.split(" - ");
  document.getElementById("dataApp").value = data.trim();
  document.getElementById("produtoApp").value = produto.trim();
  document.getElementById("dosagemApp").value = dosagem.replace(/[()]/g, "").trim();
  document.getElementById("tipoApp").value = tipo.trim();
  document.getElementById("setorApp").value = setor.trim();

  document.getElementById("btnSalvarAplicacao").setAttribute("data-editing", item);
  document.getElementById("btnCancelarEdicaoApp").style.display = "inline-block";
  alternarFormularioAplicacao();
}

// Função para excluir aplicação
function excluirAplicacao(button) {
  const item = button.parentElement.parentElement;
  if (confirm("Tem certeza que deseja excluir esta aplicação?")) {
    item.remove();
  }
}
