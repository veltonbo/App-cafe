// firebase-config.js
// Configuração do Firebase
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_DOMINIO.firebaseapp.com",
  databaseURL: "https://SEU_DATABASE.firebaseio.com",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_STORAGE_BUCKET.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

// Inicializar Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.database();
console.log("Conectado ao Firebase");

// Verificar se o Firebase foi inicializado corretamente
document.addEventListener("DOMContentLoaded", () => {
  if (typeof db === 'undefined') {
    console.error("Firebase não está configurado corretamente.");
    alert("Erro ao conectar ao Firebase.");
  } else {
    console.log("Firebase conectado com sucesso.");
  }
});
