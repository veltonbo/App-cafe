document.addEventListener("DOMContentLoaded", () => {
  console.log("App inicializado.");

  // Carregar aba inicial (Aplicação)
  const ultimaAba = localStorage.getItem("ultimaAba") || "aplicacao";
  mudarAba(ultimaAba);

  // Controlar navegação do menu
  document.querySelectorAll(".menu-superior button").forEach(button => {
    button.addEventListener("click", () => {
      const aba = button.getAttribute("data-aba");
      mudarAba(aba);
      destacarIconeAtivo(aba);
    });
  });
});

// ===== MUDAR ABA E DESTACAR ÍCONE =====
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

// ===== DESTACAR ÍCONE DO MENU ATIVO =====
function destacarIconeAtivo(aba) {
  document.querySelectorAll(".menu-superior button").forEach((botao) => {
    botao.classList.remove("ativo");
  });
  const botaoAtivo = document.querySelector(`button[data-aba="${aba}"]`);
  if (botaoAtivo) botaoAtivo.classList.add("ativo");
}

// ===== CARREGAR SCRIPT DA ABA SELECIONADA =====
function carregarScriptAba(aba) {
  const scriptExistente = document.querySelector(`script[src="js/${aba}.js"]`);
  if (scriptExistente) return;

  const script = document.createElement("script");
  script.src = `js/${aba}.js`;
  script.defer = true;
  document.body.appendChild(script);
}
