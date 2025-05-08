// ===== INICIALIZAÇÃO AO CARREGAR A PÁGINA =====
document.addEventListener("DOMContentLoaded", () => {
  carregarAbaInicial();
  configurarNavegacao();
});

// ===== CONFIGURAR NAVEGAÇÃO =====
function configurarNavegacao() {
  const navLinks = document.querySelectorAll(".navbar a");
  if (!navLinks) return;

  navLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const destino = link.getAttribute("href");
      mudarAba(destino);
    });
  });
}

// ===== MUDAR ABA =====
function mudarAba(destino) {
  const main = document.querySelector("main");
  if (!main) return;

  main.innerHTML = '<div class="loading">Carregando...</div>';
  localStorage.setItem("abaAtiva", destino);

  fetch(destino)
    .then(response => response.text())
    .then(html => {
      main.innerHTML = html;
      carregarScriptsAba(destino);
    })
    .catch(() => {
      main.innerHTML = '<div class="erro">Erro ao carregar o menu.</div>';
    });
}

// ===== CARREGAR SCRIPTS DA ABA =====
function carregarScriptsAba(destino) {
  switch (destino) {
    case "aplicacao.html":
      carregarAplicacoes();
      break;
    case "tarefas.html":
      carregarTarefas();
      break;
    case "financeiro.html":
      carregarFinanceiro();
      break;
    case "colheita.html":
      carregarColheita();
      break;
    case "relatorio.html":
      carregarRelatorio();
      break;
    case "configuracao.html":
      carregarConfiguracoes();
      break;
  }
}

// ===== CARREGAR ABA INICIAL (SALVA NO LOCAL STORAGE) =====
function carregarAbaInicial() {
  const abaAtiva = localStorage.getItem("abaAtiva") || "aplicacao.html";
  mudarAba(abaAtiva);
}
