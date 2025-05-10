// ========== CONFIGURAÇÃO DO FIREBASE ==========
// Importando o SDK do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js";
import { getDatabase, ref, set, get, onValue, push, update, remove } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js";

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD773S1h91tovlKTPbaeAZbN2o1yxROcOc",
  authDomain: "manej-cafe.firebaseapp.com",
  databaseURL: "https://manej-cafe-default-rtdb.firebaseio.com",
  projectId: "manej-cafe",
  storageBucket: "manej-cafe.appspot.com", // Corrigido o domínio do Storage
  messagingSenderId: "808931200634",
  appId: "1:808931200634:web:71357af2ff0dc2e4f5f5c3"
};

// Inicializando o Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Verificando a Conexão
if (db) {
  console.log("Firebase configurado e conectado corretamente.");
} else {
  console.error("Erro ao configurar o Firebase.");
}

// Exportando o banco de dados para ser utilizado nos outros módulos
export { db, ref, set, get, onValue, push, update, remove };
