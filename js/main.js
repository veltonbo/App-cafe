// js/main.js

document.addEventListener("DOMContentLoaded", () => {
    mostrarMenu('aplicacao');
});

function mostrarMenu(menu) {
    document.querySelectorAll(".menu").forEach(el => el.style.display = "none");
    document.getElementById(menu).style.display = "block";

    document.querySelectorAll("nav button").forEach(btn => btn.classList.remove("active"));
    document.querySelector(`nav button[onclick="mostrarMenu('${menu}')"]`).classList.add("active");
}

// Alternar Tema (Claro/Escuro)
function toggleTheme() {
    document.body.classList.toggle("dark");
    const themeToggle = document.getElementById("theme-toggle");
    themeToggle.textContent = document.body.classList.contains("dark") ? "☀️ Modo Claro" : "🌙 Modo Escuro";
}
