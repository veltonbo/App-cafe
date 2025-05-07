// ===== VARIÁVEIS GLOBAIS =====
let aplicacoes = [];
let indiceEdicaoAplicacao = null;

// ===== INICIALIZAR MENU APLICAÇÃO =====
function inicializarAplicacao() {
  carregarAplicacoes();
}

// ===== CARREGAR APLICAÇÕES (Simulação) =====
function carregarAplicacoes() {
  atualizarAplicacoes();
}

// ===== ADICIONAR OU EDITAR APLICAÇÃO =====
function adicionarAplicacao() {
  const data = dataAplicacao.value;
  const produto = produtoAplicacao.value.trim();
  const descricao = descricaoAplicacao.value.trim();
  const dosagem = parseFloat(dosagemAplicacao.value);
  const setor = setorAplicacao.value;

  if (!data || !produto || isNaN(dosagem)) {
    alert("Preencha todos os campos corretamente!");
    return;
  }

  if (indiceEdicaoAplicacao !== null) {
    aplicacoes[indiceEdicaoAplicacao] = { data, produto, descricao, dosagem, setor };
  } else {
    aplicacoes.push({ data, produto, descricao, dosagem, setor });
  }

  atualizarAplicacoes();
  resetarFormularioAplicacao();
}

// ===== ATUALIZAR LISTAGEM =====
function atualizarAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  lista.innerHTML = "";

  aplicacoes.forEach((aplic, index) => {
    const item = document.createElement("div");
    item.className = "item-aplicacao";
    item.innerHTML = `
      <span>${aplic.data} - ${aplic.produto} (${aplic.setor})</span>
      <button onclick="editarAplicacao(${index})">Editar</button>
      <button onclick="excluirAplicacao(${index})">Excluir</button>
    `;
    lista.appendChild(item);
  });
}

// ===== EDITAR APLICAÇÃO =====
function editarAplicacao(index) {
  const aplic = aplicacoes[index];
  dataAplicacao.value = aplic.data;
  produtoAplicacao.value = aplic.produto;
  descricaoAplicacao.value = aplic.descricao;
  dosagemAplicacao.value = aplic.dosagem;
  setorAplicacao.value = aplic.setor;
  indiceEdicaoAplicacao = index;
}

// ===== EXCLUIR APLICAÇÃO =====
function excluirAplicacao(index) {
  aplicacoes.splice(index, 1);
  atualizarAplicacoes();
}

// ===== RESETAR FORMULÁRIO =====
function resetarFormularioAplicacao() {
  dataAplicacao.value = "";
  produtoAplicacao.value = "";
  descricaoAplicacao.value = "";
  dosagemAplicacao.value = "";
  setorAplicacao.value = "Café 1";
  indiceEdicaoAplicacao = null;
}
