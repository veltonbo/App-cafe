document.addEventListener("DOMContentLoaded", () => {
  console.log("App inicializado.");

  // Carregar aba inicial (Aplicação)
  mudarAba("aplicacao");

  // Controlar navegação do menu
  document.querySelectorAll(".menu-superior button").forEach(button => {
    button.addEventListener("click", () => {
      const aba = button.getAttribute("data-aba");
      mudarAba(aba);
      destacarIconeAtivo(aba);
    });
  });
});

// Função para mudar a aba
function mudarAba(aba) {
  localStorage.setItem("ultimaAba", aba);
  document.getElementById("conteudo").innerHTML = "";

  fetch(`${aba}.html`)
    .then(response => response.text())
    .then(html => {
      document.getElementById("conteudo").innerHTML = html;
      carregarScriptAba(aba);
    })
    .catch(error => {
      console.error("Erro ao carregar a aba:", error);
    });
}

// Função para carregar o script da aba selecionada
function carregarScriptAba(aba) {
  const script = document.createElement("script");
  script.src = `js/${aba}.js`;
  script.defer = true;
  document.getElementById("conteudo").appendChild(script);
}

// Função para destacar o ícone do menu ativo
function destacarIconeAtivo(aba) {
  document.querySelectorAll(".menu-superior button").forEach(button => {
    button.classList.remove("ativo");
  });
  document.querySelector(`button[data-aba="${aba}"]`).classList.add("ativo");
}
