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

  if (!data || !produto || !dosagem) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  const novaAplicacao = { data, produto, dosagem, tipo };
  if (indiceEdicaoAplicacao !== null) {
    aplicacoes[indiceEdicaoAplicacao] = novaAplicacao;
    indiceEdicaoAplicacao = null;
  } else {
    aplicacoes.push(novaAplicacao);
  }

  db.ref('Aplicacoes').set(aplicacoes);
  atualizarAplicacoes();
  limparFormularioAplicacao();
}

// ===== ATUALIZAR LISTAGEM =====
function atualizarAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  lista.innerHTML = '';

  aplicacoes.forEach((app, index) => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <span>${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem}</span>
      <div class="buttons">
        <button class="btn" onclick="editarAplicacao(${index})"><i class="fas fa-edit"></i></button>
        <button class="btn red" onclick="excluirAplicacao(${index})"><i class="fas fa-trash"></i></button>
      </div>
    `;
    lista.appendChild(item);
  });
}

// ===== LIMPAR FORMULÁRIO =====
function limparFormularioAplicacao() {
  document.getElementById("dataApp").value = "";
  document.getElementById("produtoApp").value = "";
  document.getElementById("dosagemApp").value = "";
  document.getElementById("tipoApp").value = "Adubo";
}
