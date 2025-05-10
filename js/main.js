// js/main.js

// Inicializar o sistema e configurar o tema
document.addEventListener("DOMContentLoaded", () => {
    console.log("Sistema Manejo Café Iniciado");
    mostrarMenu('aplicacao'); // Menu inicial padrão

    // Configurar o tema inicial
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
        document.body.classList.add("dark");
        document.getElementById("theme-toggle").textContent = "☀️ Modo Claro";
    } else {
        document.getElementById("theme-toggle").textContent = "🌙 Modo Escuro";
    }
});

// Alternar Tema (Claro / Escuro)
function toggleTheme() {
    document.body.classList.toggle("dark");
    const themeToggle = document.getElementById("theme-toggle");
    
    if (document.body.classList.contains("dark")) {
        themeToggle.textContent = "☀️ Modo Claro";
        localStorage.setItem("theme", "dark");
    } else {
        themeToggle.textContent = "🌙 Modo Escuro";
        localStorage.setItem("theme", "light");
    }
}

// Função para mostrar e trocar entre os menus
function mostrarMenu(menu) {
    document.querySelectorAll(".menu").forEach(el => el.classList.remove("active"));
    document.getElementById(menu).classList.add("active");

    // Destacar o botão do menu ativo
    document.querySelectorAll("nav button").forEach(btn => btn.classList.remove("active"));
    document.querySelector(`nav button[onclick="mostrarMenu('${menu}')"]`).classList.add("active");
}

// Funções para mostrar e fechar o formulário flutuante
function mostrarFormulario(formId) {
    document.getElementById(formId).classList.add("open");
}

function fecharFormulario(formId) {
    document.getElementById(formId).classList.remove("open");
}
