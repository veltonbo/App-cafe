// ===== INICIALIZAÇÃO DO APP =====
document.addEventListener("DOMContentLoaded", () => {
  console.log("App inicializado.");

  // Carregar a última aba acessada ou a aba inicial (Aplicação)
  const ultimaAba = localStorage.getItem("ultimaAba") || "aplicacao";
  mudarAba(ultimaAba);

  // Controlar navegação do menu
  document.querySelectorAll(".menu-superior button").forEach(button => {
    button.addEventListener("click", () => {
      const aba = button.getAttribute("data-aba");
      mudarAba(aba);
    });
  });
});

// ===== MUDAR ABA E DESTACAR ÍCONE =====
function mudarAba(aba) {
  localStorage.setItem("ultimaAba", aba);
  document.getElementById("conteudo").innerHTML = ""; // Limpar conteúdo anterior

  fetch(`${aba}.html`)
    .then((response) => {
      if (!response.ok) throw new Error("Erro ao carregar a aba.");
      return response.text();
    })
    .then((html) => {
      document.getElementById("conteudo").innerHTML = html;
      carregarScriptAba(aba);
      destacarIconeAtivo(aba);
    })
    .catch((error) => {
      console.error("Erro ao carregar a aba:", error);
      document.getElementById("conteudo").innerHTML = "<p>Erro ao carregar a página.</p>";
    });
}

// ===== DESTACAR ÍCONE DO MENU ATIVO =====
function destacarIconeAtivo(aba) {
  document.querySelectorAll(".menu-superior button").forEach((botao) => {
    botao.classList.remove("ativo");
  });

  const botaoAtivo = document.querySelector(`.menu-superior button[data-aba="${aba}"]`);
  if (botaoAtivo) botaoAtivo.classList.add("ativo");
}

// ===== CARREGAR SCRIPT DA ABA SELECIONADA =====
function carregarScriptAba(aba) {
  // Remover qualquer script da aba anterior
  const scriptExistente = document.querySelector(`#script-${aba}`);
  if (scriptExistente) scriptExistente.remove();

  // Adicionar novo script da aba atual
  const script = document.createElement("script");
  script.src = `js/${aba}.js`;
  script.id = `script-${aba}`;
  script.defer = true;
  document.body.appendChild(script);
}
