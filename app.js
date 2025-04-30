// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyD773S1h91tovlKTPbaeAZbN2o1yxROcOc",
  authDomain: "manej-cafe.firebaseapp.com",
  databaseURL: "https://manej-cafe-default-rtdb.firebaseio.com",
  projectId: "manej-cafe",
  storageBucket: "manej-cafe.appspot.com",
  messagingSenderId: "808931200634",
  appId: "1:808931200634:web:71357af2ff0dc2e4f5f5c3"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Variáveis globais
const aplicacoes = [], tarefas = [], tarefasFeitas = [], financeiro = [], colheita = [];
let valorLataGlobal = 0, colhedorAtual = '';

// Inicialização
function inicializarApp() {
  mostrarAba(localStorage.getItem('aba') || 'aplicacoes');
  if (localStorage.getItem('tema') === 'claro') document.body.classList.add('claro');
  carregarAplicacoes();
  carregarTarefas();
  carregarFinanceiro();
  carregarColheita();
  carregarValorLata();
}

// Alternar tema
function alternarTema() {
  document.body.classList.toggle('claro');
  localStorage.setItem('tema', document.body.classList.contains('claro') ? 'claro' : 'escuro');
}

// Mostrar aba principal
function mostrarAba(id) {
  document.querySelectorAll('.aba').forEach(a => a.classList.remove('active'));
  document.querySelectorAll('.menu-superior button').forEach(b => b.classList.remove('active'));
  document.getElementById('btn-' + id).classList.add('active');
  document.getElementById(id).classList.add('active');
  localStorage.setItem('aba', id);
}

// Mostrar subaba da colheita
function mostrarSubmenuColheita(id) {
  document.querySelectorAll('.colheita-subaba').forEach(div => div.style.display = 'none');
  document.getElementById(id).style.display = 'block';
  document.querySelectorAll('#colheita .menu-superior button').forEach(btn => btn.classList.remove('active'));
  if (id === 'colheitaRegistrar') document.getElementById('btn-colheita-registrar').classList.add('active');
  else if (id === 'colheitaLancamentos') document.getElementById('btn-colheita-lancamentos').classList.add('active');
  else if (id === 'colheitaRelatorio') document.getElementById('btn-colheita-relatorio').classList.add('active');
}
