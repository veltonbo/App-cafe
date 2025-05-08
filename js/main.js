// ===== INICIAR APLICAÇÃO =====
document.addEventListener("DOMContentLoaded", () => {
  inicializarApp();
  const ultimaAba = localStorage.getItem("ultimaAba") || "aplicacao";
  mudarAba(ultimaAba);
});

// ===== INICIALIZAR APP =====
function inicializarApp() {
  console.log("App inicializado.");
  destacarIconeAtivo(localStorage.getItem("ultimaAba") || "aplicacao");
}

// ===== MUDAR ABA =====
function mudarAba(aba) {
  localStorage.setItem("ultimaAba", aba);
  document.getElementById("conteudo").innerHTML = "";

  fetch(`${aba}.html`)
    .then((response) => response.text())
    .then((html) => {
      document.getElementById("conteudo").innerHTML = html;
      carregarScriptAba(aba);
      destacarIconeAtivo(aba);
    })
    .catch((error) => {
      console.error("Erro ao carregar a aba:", error);
    });
}

// ===== CARREGAR SCRIPT DA ABA =====
function carregarScriptAba(aba) {
  const script = document.createElement("script");
  script.src = `js/${aba}.js`;
  script.defer = true;
  document.getElementById("conteudo").appendChild(script);
}

// ===== DESTACAR ÍCONE DO MENU ATIVO =====
function destacarIconeAtivo(aba) {
  const botoesMenu = document.querySelectorAll(".menu-superior button");
  botoesMenu.forEach((botao) => botao.classList.remove("ativo"));

  const botaoAtivo = document.querySelector(`button[data-aba='${aba}']`);
  if (botaoAtivo) botaoAtivo.classList.add("ativo");
}

// ===== MENU SUPERIOR - EVENTOS =====
document.querySelectorAll(".menu-superior button").forEach((botao) => {
  botao.addEventListener("click", () => {
    const aba = botao.getAttribute("data-aba");
    mudarAba(aba);
  });
});
