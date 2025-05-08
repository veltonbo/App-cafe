// ===== CONFIGURAÇÃO DO FIREBASE (Firebase inicializado de forma direta) =====
const firebaseConfig = {
  apiKey: "AIzaSyD773S1h91tovlKTPbaeAZbN2o1yxROcOc",
  authDomain: "manej-cafe.firebaseapp.com",
  databaseURL: "https://manej-cafe-default-rtdb.firebaseio.com",
  projectId: "manej-cafe",
  storageBucket: "manej-cafe.appspot.com",
  messagingSenderId: "808931200634",
  appId: "1:808931200634:web:71357af2ff0dc2e4f5f5c3"
};

// ===== INICIALIZAÇÃO DO FIREBASE =====
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// ===== FUNÇÃO: SALVAR DADOS NO FIREBASE =====
function salvarDadosFirebase(caminho, dados) {
  db.ref(caminho).set(dados)
    .then(() => console.log("Dados salvos com sucesso em:", caminho))
    .catch(error => console.error("Erro ao salvar dados:", error));
}

// ===== FUNÇÃO: CARREGAR DADOS DO FIREBASE =====
function carregarDadosFirebase(caminho, callback) {
  db.ref(caminho).once("value")
    .then(snapshot => {
      callback(snapshot.val());
    })
    .catch(error => console.error("Erro ao carregar dados:", error));
}

// ===== INTEGRANDO OS MENUS COM O FIREBASE =====
document.addEventListener('DOMContentLoaded', () => {
  // Carregar dados de cada menu ao iniciar
  carregarDadosFirebase("aplicacoes", (data) => {
    if (data) aplicacoes = data;
    carregarAplicacoes();
  });

  carregarDadosFirebase("tarefas", (data) => {
    if (data) {
      tarefas = data.tarefas || [];
      tarefasFeitas = data.tarefasFeitas || [];
    }
    carregarTarefas();
  });

  carregarDadosFirebase("financeiro", (data) => {
    if (data) {
      financeiro = data.financeiro || [];
      financeiroPago = data.financeiroPago || [];
    }
    carregarFinanceiro();
  });

  carregarDadosFirebase("colheitas", (data) => {
    if (data) {
      colheitas = data.colheitas || [];
      colheitasPagas = data.colheitasPagas || [];
    }
    carregarColheita();
  });
});

// ===== SALVAR AUTOMATICAMENTE QUANDO HOUVER MUDANÇAS =====
window.addEventListener("beforeunload", () => {
  salvarDadosFirebase("aplicacoes", aplicacoes);
  salvarDadosFirebase("tarefas", { tarefas, tarefasFeitas });
  salvarDadosFirebase("financeiro", { financeiro, financeiroPago });
  salvarDadosFirebase("colheitas", { colheitas, colheitasPagas });
});
