// ===== CONTROLAR O CARREGAMENTO DOS MENUS =====
document.addEventListener("DOMContentLoaded", () => {
  const abas = ["aplicacoes", "tarefas", "financeiro", "colheita", "relatorio", "configuracoes"];
  const abaInicial = localStorage.getItem("ultimaAba") || "aplicacoes";
  mudarAba(abaInicial);
});

// ===== MUDAR ENTRE ABAS =====
function mudarAba(aba) {
  const todasAbas = document.querySelectorAll(".aba");
  todasAbas.forEach((abaDiv) => {
    abaDiv.style.display = "none";
  });

  document.getElementById(aba).style.display = "block";
  localStorage.setItem("ultimaAba", aba);

  // Carregar scripts específicos para cada aba
  carregarScriptsAba(aba);
}

// ===== CARREGAR SCRIPTS ESPECÍFICOS DE CADA ABA =====
function carregarScriptsAba(aba) {
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
      // Nenhum carregamento específico necessário
      break;
    case "configuracoes":
      carregarConfiguracoes();
      break;
  }
}

// ===== ANIMAÇÃO DE TRANSIÇÃO SUAVE =====
function transicaoSuave(aba) {
  const container = document.getElementById(aba);
  container.style.opacity = "0";
  setTimeout(() => {
    mudarAba(aba);
    container.style.opacity = "1";
  }, 200);
}

// ===== APLICAR TEMA AUTOMÁTICO COM BASE NO MODO DO SISTEMA =====
function aplicarTemaAutomatico() {
  const tema = localStorage.getItem("tema") || "Escuro";
  if (tema === "Automático") {
    const hora = new Date().getHours();
    if (hora >= 18 || hora < 6) {
      document.body.classList.add("tema-escuro");
      document.body.classList.remove("tema-claro");
    } else {
      document.body.classList.add("tema-claro");
      document.body.classList.remove("tema-escuro");
    }
  } else {
    document.body.classList.toggle("tema-escuro", tema === "Escuro");
    document.body.classList.toggle("tema-claro", tema === "Claro");
  }
}

// ===== SALVAR E APLICAR TEMA =====
function definirTema(tema) {
  localStorage.setItem("tema", tema);
  aplicarTemaAutomatico();
}

// ===== MONITORAR MUDANÇA DE TEMA NO MENU CONFIGURAÇÕES =====
document.addEventListener("change", (event) => {
  if (event.target.id === "tema") {
    definirTema(event.target.value);
  }
});
