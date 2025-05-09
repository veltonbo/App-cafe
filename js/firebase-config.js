// js/firebase-config.js

// Verifica se o Firebase já foi inicializado
if (!firebase.apps.length) {
  const firebaseConfig = {
    apiKey: "AIzaSyD735HjSt1yolt1X7RbsaeZN2oIyxRDcOc",
    authDomain: "manejo-cafe.firebaseapp.com",
    databaseURL: "https://manejo-cafe-default-rtdb.firebaseio.com",
    projectId: "manejo-cafe",
    storageBucket: "manejo-cafe.appspot.com",
    messagingSenderId: "808391206364",
    appId: "1:808391206364:web:1537f2dfcbdc2e4f5fc5c3"
  };

  // Inicializa o Firebase
  firebase.initializeApp(firebaseConfig);
}

// Inicializa o Database
const db = firebase.database().ref("aplicacoes");
console.log("Firebase inicializado corretamente.");
