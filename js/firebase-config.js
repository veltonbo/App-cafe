// ===== Firebase Config =====
// IMPORTANTE: Configure essas variáveis no seu ambiente de deploy
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyD773S1h91tovlKTPbaeAZbN2o1yxROcOc",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "manej-cafe.firebaseapp.com",
  databaseURL: process.env.FIREBASE_DB_URL || "https://manej-cafe-default-rtdb.firebaseio.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "manej-cafe",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "manej-cafe.appspot.com",
  messagingSenderId: process.env.FIREBASE_SENDER_ID || "808931200634",
  appId: process.env.FIREBASE_APP_ID || "1:808931200634:web:71357af2ff0dc2e4f5f5c3"
};

// Inicialização segura
if (!firebase.apps.length) {
  try {
    firebase.initializeApp(firebaseConfig);
    // Ativa persistência offline (opcional)
    firebase.database().enablePersistence()
      .catch(err => console.error("Persistência offline falhou: ", err));
  } catch (error) {
    console.error("Erro na inicialização do Firebase: ", error);
  }
}
const db = firebase.database();

// Função segura para desconectar
function desconectarFirebase() {
  firebase.database().goOffline();
}
