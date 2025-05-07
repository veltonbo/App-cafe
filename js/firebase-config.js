// ===== CONFIGURAÇÃO DO FIREBASE (Apenas uma vez) =====
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_DOMINIO_FIREBASE.firebaseapp.com",
  databaseURL: "https://SEU_DOMINIO_FIREBASE.firebaseio.com",
  projectId: "SEU_PROJETO_ID",
  storageBucket: "SEU_STORAGE_BUCKET.appspot.com",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
};

// ===== INICIALIZAR FIREBASE =====
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// ===== VERIFICAR CONEXÃO =====
db.ref(".info/connected").on("value", (snap) => {
  if (snap.val() === true) {
    console.log("🔥 Conectado ao Firebase");
  } else {
    console.warn("⚠️ Desconectado do Firebase");
  }
});
