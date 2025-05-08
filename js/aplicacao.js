// ===== CONFIGURAÇÃO DO FIREBASE =====
const db = firebase.database();

// ===== VARIÁVEIS GLOBAIS =====
let aplicacoes = [];
let indiceEdicaoAplicacao = null;

// ===== ADICIONAR OU EDITAR APLICAÇÃO =====
function adicionarAplicacao() {
  const novaAplicacao = {
    data: document.getElementById("dataApp").value,
    produto: document.getElementById("produtoApp").value.trim(),
    dosagem: parseFloat(document.getElementById("dosagemApp").value),
    setor: document.getElementById("setorApp").value
  };

  if (!novaAplicacao.data || !novaAplicacao.produto || isNaN(novaAplicacao.dosagem)) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  if (indiceEdicaoAplicacao !== null) {
    // Editando aplicação existente
    db.ref(`Aplicacoes/${indiceEdicaoAplicacao}`).set(novaAplicacao)
      .then(() => console.log("✅ Aplicação atualizada com sucesso."))
      .catch((error) => console.error("❌ Erro ao atualizar aplicação:", error));
  } else {
    // Adicionando nova aplicação
    db.ref('Aplicacoes').push(novaAplicacao)
      .then(() => console.log("✅ Aplicação salva com sucesso."))
      .catch((error) => console.error("❌ Erro ao salvar aplicação:", error));
  }

  limparCamposAplicacao();
  carregarAplicacoes();
}

// ===== CARREGAR APLICAÇÕES =====
function carregarAplicacoes() {
  db.ref('Aplicacoes').on('value', (snapshot) => {
    aplicacoes = snapshot.exists() ? snapshot.val() : {};
    atualizarListaAplicacoes();
  });
}

// ===== ATUALIZAR LISTA DE APLICAÇÕES =====
function atualizarListaAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  lista.innerHTML = '';

  for (const id in aplicacoes) {
    const app = aplicacoes[id];
    const item = document.createElement("div");
    item.classList.add("item-aplicacao");
    item.innerHTML = `
      <span>${app.data} - ${app.produto} - ${app.dosagem} L/ha - ${app.setor}</span>
      <div class="botoes">
        <button onclick="editarAplicacao('${id}')"><i class="fas fa-edit"></i></button>
        <button onclick="excluirAplicacao('${id}')"><i class="fas fa-trash"></i></button>
      </div>
    `;
    lista.appendChild(item);
  }
}

// ===== EDITAR APLICAÇÃO =====
function editarAplicacao(id) {
  const app = aplicacoes[id];
  document.getElementById("dataApp").value = app.data;
  document.getElementById("produtoApp").value = app.produto;
  document.getElementById("dosagemApp").value = app.dosagem;
  document.getElementById("setorApp").value = app.setor;

  indiceEdicaoAplicacao = id;
}

// ===== EXCLUIR APLICAÇÃO =====
function excluirAplicacao(id) {
  if (confirm("Tem certeza que deseja excluir esta aplicação?")) {
    db.ref(`Aplicacoes/${id}`).remove();
    carregarAplicacoes();
  }
}

// ===== LIMPAR CAMPOS =====
function limparCamposAplicacao() {
  document.getElementById("dataApp").value = '';
  document.getElementById("produtoApp").value = '';
  document.getElementById("dosagemApp").value = '';
  document.getElementById("setorApp").value = 'Setor 01';
  indiceEdicaoAplicacao = null;
}

// ===== INICIAR AO CARREGAR =====
document.addEventListener("DOMContentLoaded", carregarAplicacoes);
