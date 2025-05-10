// ========== MAIN.JS - INICIALIZAÇÃO GLOBAL ==========

// Importando o Firebase corretamente
import { db, ref, set, get, onValue, push, update, remove } from "./firebase-config.js";

// Inicializando o Aplicativo
document.addEventListener("DOMContentLoaded", () => {
  console.log("Inicializando o aplicativo...");

  if (typeof inicializarApp === "function") {
    inicializarApp();
  } else {
    console.error("Erro: função inicializarApp não encontrada.");
  }
});

// Função de inicialização geral
function inicializarApp() {
  console.log("Aplicativo inicializado.");

  // Verifica se o Firebase está corretamente configurado
  if (db) {
    console.log("Firebase configurado corretamente.");
  } else {
    console.error("Erro: Firebase não configurado corretamente.");
  }
  
  // Verifica se o usuário está autenticado (se necessário)
  // Aqui podemos adicionar lógica para controle de usuário, se necessário.
}

// Função para trocar de menu
function mostrarAba(aba) {
  document.querySelectorAll(".aba").forEach((el) => el.style.display = "none");
  document.getElementById(aba).style.display = "block";
}

// Exemplo: Inicializando com a aba de aplicações
mostrarAba("aplicacoes");
