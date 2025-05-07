// ===== VARIÁVEIS GLOBAIS =====
let aplicacoes = [];
let indiceEdicaoAplicacao = null;

// ===== CARREGAR APLICAÇÕES =====
function carregarAplicacoes() {
  db.ref('Aplicacoes').on('value', snap => {
    aplicacoes = snap.exists() ? snap.val() : [];
    atualizarAplicacoes();
  });
}

// ===== ADICIONAR OU EDITAR APLICAÇÃO =====
function adicionarAplicacao() {
  const data = document.getElementById("dataApp").value;
  const produto = document.getElementById("produtoApp").value.trim();
  const dosagem = document.getElementById("dosagemApp").value.trim();
  const tipo = document.getElementById("tipoApp").value;

  if (!data || !produto || isNaN(parseFloat(dosagem))) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  const novaAplicacao = { data, produto, dosagem, tipo };

  if (indiceEdicaoAplicacao !== null) {
    aplicacoes[indiceEdicaoAplicacao] = novaAplicacao;
  } else {
    aplicacoes.push(novaAplicacao);
  }

  db.ref('Aplicacoes').set(aplicacoes);
  atualizarAplicacoes();
  cancelarEdicaoAplicacao();
}

// ===== ATUALIZAR LISTA =====
function atualizarAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  lista.innerHTML = "";

  aplicacoes.forEach((app, index) => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <span>${app.data} - ${app.produto} - ${app.dosagem} L/ha - ${app.tipo}</span>
      <button class="botao-circular" onclick="excluirAplicacao(${index})">Excluir</button>
    `;
    lista.appendChild(item);
  });
}

// ===== EXCLUIR APLICAÇÃO =====
function excluirAplicacao(index) {
  aplicacoes.splice(index, 1);
  db.ref('Aplicacoes').set(aplicacoes);
  atualizarAplicacoes();
}

// ===== CANCELAR EDIÇÃO =====
function cancelarEdicaoAplicacao() {
  indiceEdicaoAplicacao = null;
  document.getElementById("dataApp").value = "";
  document.getElementById("produtoApp").value = "";
  document.getElementById("dosagemApp").value = "";
}
