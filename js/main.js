// ===== MAIN.JS - Controle de Navegação e Carregamento Dinâmico =====

// ===== Inicialização da Aplicação =====
document.addEventListener("DOMContentLoaded", () => {
    carregarAbaInicial();
});

// ===== Função para Mudar de Aba =====
function mudarAba(aba) {
    const abas = document.querySelectorAll(".aba");
    abas.forEach(section => section.style.display = "none");

    const abaSelecionada = document.getElementById(aba);
    if (abaSelecionada) {
        abaSelecionada.style.display = "block";
        localStorage.setItem("ultimaAba", aba);
        carregarScriptsAba(aba);
    }
}

// ===== Carregar Aba Inicial (Última Acessada) =====
function carregarAbaInicial() {
    const ultimaAba = localStorage.getItem("ultimaAba") || "aplicacoes";
    mudarAba(ultimaAba);
}

// ===== Carregar Scripts Específicos da Aba =====
function carregarScriptsAba(aba) {
    switch (aba) {
        case "aplicacoes":
            if (typeof carregarAplicacoes === "function") carregarAplicacoes();
            break;
        case "tarefas":
            if (typeof carregarTarefas === "function") carregarTarefas();
            break;
        case "financeiro":
            if (typeof carregarFinanceiro === "function") carregarFinanceiro();
            break;
        case "colheita":
            if (typeof carregarColheita === "function") carregarColheita();
            break;
        case "relatorio":
            if (typeof carregarRelatorio === "function") carregarRelatorio();
            break;
        case "configuracoes":
            if (typeof carregarConfiguracoes === "function") carregarConfiguracoes();
            break;
        default:
            console.warn("Aba desconhecida:", aba);
    }
}

// ===== Mensagem de Debug (Console) =====
console.log("🚀 Main.js carregado e pronto.");
