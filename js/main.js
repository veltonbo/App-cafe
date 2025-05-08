// ===== MAIN.JS - Controle de Navegação e Carregamento de Abas =====

// ===== Verificar Conexão com o Firebase =====
document.addEventListener("DOMContentLoaded", () => {
    console.log("Main.js carregado e pronto.");
    inicializarFirebase();
    carregarScriptsAba();
});

// ===== Inicializar Firebase (Garantir que o Firebase está configurado) =====
function inicializarFirebase() {
    if (!firebase.apps.length) {
        console.error("Firebase não está configurado corretamente. Verifique o arquivo firebase-config.js");
        return;
    }
    console.log("Firebase inicializado corretamente.");
}

// ===== Controlar Navegação entre Abas =====
const abas = document.querySelectorAll(".aba");
const botoesMenu = document.querySelectorAll(".botao-menu");

botoesMenu.forEach(botao => {
    botao.addEventListener("click", () => {
        mudarAba(botao.dataset.target);
    });
});

// ===== Mudar Aba =====
function mudarAba(abaId) {
    // Esconder todas as abas
    abas.forEach(aba => {
        aba.style.display = "none";
    });

    // Mostrar apenas a aba selecionada
    const abaSelecionada = document.getElementById(abaId);
    if (abaSelecionada) {
        abaSelecionada.style.display = "block";
        carregarScriptsAba(abaId);
    } else {
        console.error("Aba não encontrada:", abaId);
    }
}

// ===== Carregar Scripts da Aba Selecionada =====
function carregarScriptsAba(abaId) {
    switch (abaId) {
        case "aplicacoes":
            if (typeof carregarAplicacoes === "function") {
                carregarAplicacoes();
            } else {
                console.error("Função carregarAplicacoes não está definida.");
            }
            break;

        case "tarefas":
            if (typeof carregarTarefas === "function") {
                carregarTarefas();
            } else {
                console.error("Função carregarTarefas não está definida.");
            }
            break;

        case "financeiro":
            if (typeof carregarFinanceiro === "function") {
                carregarFinanceiro();
            } else {
                console.error("Função carregarFinanceiro não está definida.");
            }
            break;

        case "colheita":
            if (typeof carregarColheita === "function") {
                carregarColheita();
            } else {
                console.error("Função carregarColheita não está definida.");
            }
            break;

        case "relatorio":
            if (typeof carregarRelatorio === "function") {
                carregarRelatorio();
            } else {
                console.error("Função carregarRelatorio não está definida.");
            }
            break;

        case "configuracoes":
            if (typeof carregarConfiguracoes === "function") {
                carregarConfiguracoes();
            } else {
                console.error("Função carregarConfiguracoes não está definida.");
            }
            break;

        default:
            console.error("Aba desconhecida:", abaId);
            break;
    }
}

// ===== Inicializar a Primeira Aba (Aplicações) =====
document.addEventListener("DOMContentLoaded", () => {
    mudarAba("aplicacoes");
});
