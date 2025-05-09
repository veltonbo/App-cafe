// ===== VARIÁVEL GLOBAL DE APLICAÇÕES =====
let aplicacoes = [];

// ===== FUNÇÃO: CONFIGURAR A APLICAÇÃO (APLICACAO.HTML) =====
function configurarAplicacoes() {
  document.getElementById('conteudoPrincipal').innerHTML += `
    <div id="formAplicacao" style="display: none; margin-top: 15px;">
      <input type="date" id="dataApp" placeholder="Data da Aplicação">
      <input placeholder="Produto" id="produtoApp">
      <input placeholder="Dosagem" id="dosagemApp">
      <button onclick="adicionarAplicacao()">Salvar Aplicação</button>
    </div>
    <div id="listaAplicacoes"></div>
  `;
  carregarAplicacoes();
}

// ===== FUNÇÃO: CARREGAR APLICAÇÕES =====
function carregarAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  lista.innerHTML = "";

  if (aplicacoes.length === 0) {
    lista.innerHTML = "<p>Nenhuma aplicação registrada.</p>";
    return;
  }

  aplicacoes.forEach((app, index) => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      ${app.data} - ${app.produto} (${app.dosagem}) 
      <button onclick="excluirAplicacao(${index})">Excluir</button>
    `;
    lista.appendChild(item);
  });
}

// ===== FUNÇÃO: ADICIONAR APLICAÇÃO =====
function adicionarAplicacao() {
  const data = document.getElementById("dataApp").value.trim();
  const produto = document.getElementById("produtoApp").value.trim();
  const dosagem = document.getElementById("dosagemApp").value.trim();

  if (!data || !produto || !dosagem) {
    alert("Preencha todos os campos.");
    return;
  }

  aplicacoes.push({ data, produto, dosagem });
  carregarAplicacoes();
  limparFormulario('formAplicacao');
}

// ===== FUNÇÃO: EXCLUIR APLICAÇÃO =====
function excluirAplicacao(index) {
  aplicacoes.splice(index, 1);
  carregarAplicacoes();
}

// ===== FUNÇÃO: LIMPAR FORMULÁRIO =====
function limparFormulario(formId) {
  const form = document.getElementById(formId);
  if (form) {
    form.querySelectorAll("input").forEach(input => input.value = "");
    form.style.display = "none";
  }
}
