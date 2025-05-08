// Função para mudar de aba e carregar conteúdo
function mudarAba(aba) {
  localStorage.setItem("ultimaAba", aba);
  document.getElementById("conteudo").innerHTML = "";

  // Carregar o HTML da aba
  fetch(`./${aba}.html`)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Aba não encontrada: " + aba);
      }
      return response.text();
    })
    .then((html) => {
      document.getElementById("conteudo").innerHTML = html;
      carregarScriptAba(aba);
    })
    .catch((error) => {
      console.error("Erro ao carregar a aba:", error);
    });
}

// Função para carregar o script da aba selecionada
function carregarScriptAba(aba) {
  const script = document.createElement("script");
  script.src = `./js/${aba}.js`;
  script.defer = true;
  document.body.appendChild(script);
}

// Verificar se há uma aba salva no LocalStorage
document.addEventListener("DOMContentLoaded", () => {
  const ultimaAba = localStorage.getItem("ultimaAba") || "aplicacao";
  mudarAba(ultimaAba);
});
