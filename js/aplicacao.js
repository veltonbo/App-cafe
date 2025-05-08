// ===== INICIAR FIREBASE =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, push, onValue, set } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// Configurações do Firebase (deve estar em firebase-config.js)
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_DOMINIO.firebaseapp.com",
  databaseURL: "https://SEU_DATABASE.firebaseio.com",
  projectId: "SEU_PROJETO_ID",
  storageBucket: "SEU_BUCKET.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

// Inicializando o Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

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

  if (!nova.data || !nova.produto || !nova.dosagem) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  if (indiceEdicaoAplicacao !== null) {
    aplicacoes[indiceEdicaoAplicacao] = nova;
    set(ref(db, 'Aplicacoes'), aplicacoes);
    indiceEdicaoAplicacao = null;
  } else {
    push(ref(db, 'Aplicacoes'), nova);
  }

  atualizarAplicacoes();
  limparCamposAplicacao();
}

// ===== CARREGAR APLICAÇÕES =====
function carregarAplicacoes() {
  const aplicacoesRef = ref(db, 'Aplicacoes');
  onValue(aplicacoesRef, (snapshot) => {
    aplicacoes = [];
    snapshot.forEach((childSnapshot) => {
      aplicacoes.push({ ...childSnapshot.val(), key: childSnapshot.key });
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
      <button onclick="excluirAplicacao('${app.key}')"><i class="fas fa-trash"></i></button>
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
function excluirAplicacao(key) {
  set(ref(db, 'Aplicacoes/' + key), null);
  atualizarAplicacoes();
}

// ===== LIMPAR CAMPOS =====
function limparCamposAplicacao() {
  document.getElementById("dataApp").value = '';
  document.getElementById("produtoApp").value = '';
  document.getElementById("dosagemApp").value = '';
  document.getElementById("tipoApp").value = 'Adubo';
  document.getElementById("setorApp").value = 'Setor 01';
}

// ===== INICIAR AO CARREGAR =====
document.addEventListener("DOMContentLoaded", carregarAplicacoes);
