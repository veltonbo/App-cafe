// ===== CONFIGURAÇÃO DO FIREBASE (Firebase inicializado em firebase-config.js) =====
const db = firebase.database();

// ===== VARIÁVEIS GLOBAIS =====
let aplicacoes = [];
let indiceEdicaoAplicacao = null;

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

  if (indiceEdicaoAplicacao !== null) {
    db.ref('Aplicacoes').child(aplicacoes[indiceEdicaoAplicacao].id).set(nova);
    indiceEdicaoAplicacao = null;
  } else {
    db.ref('Aplicacoes').push(nova);
  }

  limparCamposAplicacao();
  carregarAplicacoes();
}

// ===== CARREGAR APLICAÇÕES =====
function carregarAplicacoes() {
  db.ref('Aplicacoes').on('value', (snapshot) => {
    aplicacoes = [];
    snapshot.forEach((childSnapshot) => {
      aplicacoes.push({ ...childSnapshot.val(), id: childSnapshot.key });
    });
    atualizarAplicacoes();
  });
}

// ===== ATUALIZAR LISTA DE APLICAÇÕES =====
function atualizarAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  lista.innerHTML = '';

  aplicacoes.forEach((app, index) => {
    const item = document.createElement("div");
    item.className = "item-aplicacao";
    item.innerHTML = `
      <span>${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}</span>
      <button onclick="editarAplicacao(${index})"><i class="fas fa-edit"></i></button>
      <button onclick="excluirAplicacao('${app.id}')"><i class="fas fa-trash"></i></button>
    `;
    lista.appendChild(item);
  });
}

// ===== EDITAR APLICAÇÃO =====
function editarAplicacao(index) {
  const app = aplicacoes[index];
  document.getElementById("dataApp").value = app.data;
  document.getElementById("produtoApp").value = app.produto;
  document.getElementById("dosagemApp").value = app.dosagem;
  document.getElementById("tipoApp").value = app.tipo;
  document.getElementById("setorApp").value = app.setor;
  indiceEdicaoAplicacao = index;
}

// ===== EXCLUIR APLICAÇÃO =====
function excluirAplicacao(id) {
  db.ref('Aplicacoes').child(id).remove();
  carregarAplicacoes();
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

// ===== INICIAR AO CARREGAR =====
document.addEventListener("DOMContentLoaded", carregarAplicacoes);
