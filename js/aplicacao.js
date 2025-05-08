// ===== CONFIGURAÇÃO DO FIREBASE (Firebase inicializado em firebase-config.js) =====
const db = firebase.database();

// ===== VARIÁVEIS GLOBAIS =====
let aplicacoes = {};
let indiceEdicaoAplicacao = null;

// ===== CARREGAR APLICAÇÕES =====
function carregarAplicacoes() {
  db.ref('Aplicacoes').on('value', (snapshot) => {
    aplicacoes = snapshot.exists() ? snapshot.val() : {};
    atualizarAplicacoes();
    atualizarSugestoesProdutoApp();
  });
}

// ===== ADICIONAR OU EDITAR APLICAÇÃO =====
function adicionarAplicacao() {
  const nova = {
    data: document.getElementById("dataApp").value,
    produto: document.getElementById("produtoApp").value.trim(),
    dosagem: document.getElementById("dosagemApp").value.trim(),
    tipo: document.getElementById("tipoApp").value,
    setor: document.getElementById("setorApp").value
  };

  if (!nova.data || !nova.produto || !nova.dosagem || isNaN(parseFloat(nova.dosagem))) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  if (indiceEdicaoAplicacao) {
    db.ref(`Aplicacoes/${indiceEdicaoAplicacao}`).set(nova)
      .then(() => {
        console.log("✅ Aplicação editada com sucesso no Firebase.");
        indiceEdicaoAplicacao = null;
        limparCamposAplicacao();
      });
  } else {
    const novaChave = db.ref('Aplicacoes').push().key;
    db.ref(`Aplicacoes/${novaChave}`).set(nova)
      .then(() => {
        console.log("✅ Aplicação salva com sucesso no Firebase.");
        limparCamposAplicacao();
      });
  }
}

// ===== LIMPAR CAMPOS =====
function limparCamposAplicacao() {
  document.getElementById("dataApp").value = '';
  document.getElementById("produtoApp").value = '';
  document.getElementById("dosagemApp").value = '';
  document.getElementById("tipoApp").value = 'Adubo';
  document.getElementById("setorApp").value = 'Setor 01';
  indiceEdicaoAplicacao = null;
}

// ===== ATUALIZAR LISTA DE APLICAÇÕES =====
function atualizarAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  lista.innerHTML = '';

  Object.entries(aplicacoes).forEach(([id, app]) => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <span>${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}</span>
      <div class="botoes">
        <button onclick="editarAplicacao('${id}')"><i class="fas fa-edit"></i></button>
        <button onclick="excluirAplicacao('${id}')"><i class="fas fa-trash"></i></button>
      </div>
    `;
    lista.appendChild(item);
  });
}

// ===== EDITAR APLICAÇÃO =====
function editarAplicacao(id) {
  const app = aplicacoes[id];
  document.getElementById("dataApp").value = app.data;
  document.getElementById("produtoApp").value = app.produto;
  document.getElementById("dosagemApp").value = app.dosagem;
  document.getElementById("tipoApp").value = app.tipo;
  document.getElementById("setorApp").value = app.setor;

  indiceEdicaoAplicacao = id;
}

// ===== EXCLUIR APLICAÇÃO =====
function excluirAplicacao(id) {
  if (confirm("Deseja excluir esta aplicação?")) {
    db.ref(`Aplicacoes/${id}`).remove()
      .then(() => {
        console.log("✅ Aplicação excluída com sucesso.");
      });
  }
}

// ===== SUGESTÕES DE PRODUTO =====
function atualizarSugestoesProdutoApp() {
  const lista = document.getElementById("sugestoesProdutoApp");
  const produtosUnicos = [...new Set(Object.values(aplicacoes).map(a => a.produto))];
  lista.innerHTML = produtosUnicos.map(p => `<option value="${p}">`).join('');
}

// ===== INICIAR AO CARREGAR =====
document.addEventListener("DOMContentLoaded", carregarAplicacoes);
