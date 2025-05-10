// firebase-config.js
// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD773S1h91tovlKTPbaeAZbN2o1yxROcOc",
  authDomain: "manej-cafe.firebaseapp.com",
  databaseURL: "https://manej-cafe-default-rtdb.firebaseio.com",
  projectId: "manej-cafe",
  storageBucket: "manej-cafe.firebasestorage.app",
  messagingSenderId: "808931200634",
  appId: "1:808931200634:web:71357af2ff0dc2e4f5f5c3"
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
