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

// ===== INICIALIZAR FIREBASE (Verificar se já está inicializado) =====
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// ===== VERIFICAR CONEXÃO COM O FIREBASE =====
db.ref(".info/connected").on("value", (snap) => {
    if (snap.val() === true) {
        console.log("🔥 Conectado ao Firebase");
    } else {
        console.warn("⚠️ Desconectado do Firebase");
    }
});

// ===== GARANTIR QUE O FIREBASE ESTÁ CARREGADO EM TODAS AS ABAS =====
document.addEventListener("DOMContentLoaded", () => {
    if (typeof firebase === "undefined" || !firebase.apps.length) {
        console.error("🚨 Firebase não carregou corretamente.");
    } else {
        console.log("✅ Firebase carregado com sucesso.");
    }
});
