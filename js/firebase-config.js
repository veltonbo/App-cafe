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


  // Verifica a conexão com o Firebase Realtime Database
  const db = firebase.database();
  db.ref(".info/connected").on("value", (snap) => {
    if (snap.val()) {
      console.log("✅ Conectado ao Firebase");
    } else {
      console.error("❌ Desconectado do Firebase");
    }
  });
});
