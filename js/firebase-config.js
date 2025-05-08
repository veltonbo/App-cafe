// ===== CONFIGURAÇÃO DO FIREBASE (Apenas uma vez) =====
const firebaseConfig = {
  apiKey: "AIzaSyD773S1h91tovlKTPbaeAZbN2o1yxROcOc",
  authDomain: "manej-cafe.firebaseapp.com",
  databaseURL: "https://manej-cafe-default-rtdb.firebaseio.com",
  projectId: "manej-cafe",
  storageBucket: "manej-cafe.appspot.com",
  messagingSenderId: "808931200634",
  appId: "1:808931200634:web:71357af2ff0dc2e4f5f5c3"
};

// ===== CARREGAR APLICAÇÕES (CORRIGIDO) =====
function carregarAplicacoes() {
  db.ref('Aplicacoes').on('value', snap => {
    if (snap.exists()) {
      aplicacoes = snap.val();
      atualizarAplicacoes();
      atualizarSugestoesProdutoApp();
    } else {
      aplicacoes = []; // Garante que o array não seja nulo
      atualizarAplicacoes();
      atualizarSugestoesProdutoApp();
      console.warn("⚠️ Nenhuma aplicação encontrada.");
    }
  }, (error) => {
    console.error("Erro ao carregar aplicações:", error);
  });
}
