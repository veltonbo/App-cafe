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
