// ===== INICIALIZAÇÃO DO APP =====
document.addEventListener("DOMContentLoaded", () => {
  inicializarApp();
  configurarNavegacao();
});

// ===== INICIALIZAR APP =====
function inicializarApp() {
  const abaAtiva = localStorage.getItem("abaAtiva") || "aplicacoes";
  mostrarAba(abaAtiva);
}

// ===== CONFIGURAR NAVEGAÇÃO =====
function configurarNavegacao() {
  document.querySelectorAll(".menu-superior button").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const aba = e.target.getAttribute("data-aba");
      mostrarAba(aba);
    });
  });
}

// ===== MOSTRAR ABA =====
function mostrarAba(aba) {
  document.querySelectorAll(".aba").forEach(div => {
    div.style.display = "none";
  });

  const abaAtiva = document.getElementById(aba);
  if (abaAtiva) {
    abaAtiva.style.display = "block";
    localStorage.setItem("abaAtiva", aba);

    // Carregar a função de cada aba automaticamente
    switch (aba) {
      case "aplicacoes":
        carregarAplicacoes();
        break;
      case "tarefas":
        carregarTarefas();
        break;
      case "financeiro":
        carregarFinanceiro();
        break;
      case "colheita":
        carregarColheita();
        break;
      case "relatorio":
        carregarRelatorio();
        break;
      case "configuracoes":
        carregarConfiguracoes();
        break;
    }
  }
}

// ===== TEMA ESCURO/CLARO =====
function alternarTema() {
  document.body.classList.toggle("dark-mode");
  localStorage.setItem("temaEscuro", document.body.classList.contains("dark-mode"));
}

// ===== APLICAR TEMA SALVO =====
document.addEventListener("DOMContentLoaded", () => {
  const temaEscuro = localStorage.getItem("temaEscuro") === "true";
  if (temaEscuro) {
    document.body.classList.add("dark-mode");
  }
});

// ===== RECARREGAR ABA ATIVA =====
function recarregarAba() {
  const abaAtiva = localStorage.getItem("abaAtiva") || "aplicacoes";
  mostrarAba(abaAtiva);
}

// ===== GERAR RELATÓRIO COMPLETO (PDF e CSV) =====
function gerarRelatorioCompleto() {
  const abaAtual = localStorage.getItem("abaAtiva");

  switch (abaAtual) {
    case "relatorio":
      gerarRelatorioPDF();
      gerarRelatorioCSV();
      break;
    default:
      alert("Acesse o menu Relatório para gerar o relatório completo.");
  }
}

// ===== LIMPAR DADOS (USADO NAS CONFIGURAÇÕES) =====
function limparDados() {
  if (confirm("Tem certeza que deseja limpar todos os dados? Esta ação não pode ser desfeita.")) {
    db.ref('/').set(null);
    alert("Todos os dados foram apagados.");
    recarregarAba();
  }
}
