// js/main.js

document.addEventListener("DOMContentLoaded", () => {
    console.log("Sistema Manejo Café Iniciado");
    initAplicacao();
    initColheita();
    initConfiguracoes();
    initFinanceiro();
    initRelatorio();
    initTarefas();
});

function mostrarMenu(menu) {
    document.querySelectorAll(".menu").forEach(el => el.style.display = "none");
    document.getElementById(menu).style.display = "block";
}

// Alternar Tema (Claro / Escuro)
function toggleTheme() {
    document.body.classList.toggle("dark");
    const themeToggle = document.getElementById("theme-toggle");
    if (document.body.classList.contains("dark")) {
        themeToggle.textContent = "☀️ Modo Claro";
    } else {
        themeToggle.textContent = "🌙 Modo Escuro";
    }
}

// Iniciar com o tema salvo (se houver)
document.addEventListener("DOMContentLoaded", () => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
        document.body.classList.add("dark");
        document.getElementById("theme-toggle").textContent = "☀️ Modo Claro";
    }

    document.getElementById("theme-toggle").addEventListener("click", () => {
        document.body.classList.toggle("dark");
        localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
    });
});
