// ===== VARIÁVEIS GLOBAIS =====
let aplicacoes = [];
let indiceEdicaoAplicacao = null;

// ===== INICIALIZAR APLICAÇÕES =====
document.addEventListener("DOMContentLoaded", () => {
  carregarAplicacoes();
});

// ===== CARREGAR APLICAÇÕES =====
function carregarAplicacoes() {
  const lista = JSON.parse(localStorage.getItem("aplicacoes")) || [];
  aplicacoes = lista;
  atualizarAplicacoes();
}

// ===== ADICIONAR OU EDITAR APLICAÇÃO =====
function adicionarAplicacao() {
  const data = dataAplicacao.value;
  const produto = produtoAplicacao.value.trim();
  const descricao = descricaoAplicacao.value.trim();
  const dosagem = parseFloat(dosagemAplicacao.value);

  if (!data || !produto || isNaN(dosagem)) {
    alert("Preencha todos os campos corretamente!");
    return;
  }

  if (indiceEdicaoAplicacao !== null) {
    aplicacoes[indiceEdicaoAplicacao] = { data, produto, descricao, dosagem };
  } else {
    aplicacoes.push({ data, produto, descricao, dosagem });
  }

  salvarAplicacoes();
  atualizarAplicacoes();
  resetarFormularioAplicacao();
}

// ===== ATUALIZAR LISTA DE APLICAÇÕES =====
function atualizarAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  lista.innerHTML = "";

  aplicacoes.forEach((aplic, index) => {
    const item = document.createElement("div");
    item.className = "item-aplicacao";
    item.innerHTML = `
      <span>${aplic.data} - ${aplic.produto} (${aplic.dosagem} L/ha)</span>
      <button onclick="excluirAplicacao(${index})">Excluir</button>
    `;
    lista.appendChild(item);
  });
}

// ===== SALVAR APLICAÇÕES NO LOCALSTORAGE =====
function salvarAplicacoes() {
  localStorage.setItem("aplicacoes", JSON.stringify(aplicacoes));
}

// ===== EXCLUIR APLICAÇÃO =====
function excluirAplicacao(index) {
  aplicacoes.splice(index, 1);
  salvarAplicacoes();
  atualizarAplicacoes();
}

// ===== RESETAR FORMULÁRIO =====
function resetarFormularioAplicacao() {
  dataAplicacao.value = "";
  produtoAplicacao.value = "";
  descricaoAplicacao.value = "";
  dosagemAplicacao.value = "";
  indiceEdicaoAplicacao = null;
}

// ===== CANCELAR EDIÇÃO =====
function cancelarEdicaoAplicacao() {
  resetarFormularioAplicacao();
}
