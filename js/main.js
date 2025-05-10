// js/main.js

document.addEventListener("DOMContentLoaded", () => {
    console.log("Sistema Manejo Café Iniciado");
    initAplicacao();
    initColheita();
    initFinanceiro();
    initTarefas();
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

// Função para trocar entre os menus com animação suave
function mostrarMenu(menu) {
    // Oculta todos os menus com transição
    document.querySelectorAll(".menu").forEach(el => {
        el.classList.remove("active");
    });

    // Mostra o menu desejado com efeito suave
    const targetMenu = document.getElementById(menu);
    if (targetMenu) {
        setTimeout(() => {
            targetMenu.classList.add("active");
        }, 100);
    }
}

// Função para exibir o formulário flutuante
function mostrarFormulario(formId) {
    document.getElementById(formId).style.display = "flex";
}

// Função para fechar o formulário flutuante
function fecharFormulario(formId) {
    document.getElementById(formId).style.display = "none";
}
