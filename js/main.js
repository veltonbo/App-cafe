// ===== MAIN.JS - Controle de Navegação e Carregamento Dinâmico =====
document.addEventListener("DOMContentLoaded", inicializarApp);

// ===== Inicializar Aplicação =====
function inicializarApp() {
  const ultimaAba = localStorage.getItem("ultimaAba") || "aplicacoes";
  mudarAba(ultimaAba);
}

// ===== Mudar Aba =====
function mudarAba(aba) {
  localStorage.setItem("ultimaAba", aba);
  document.getElementById("conteudo").innerHTML = "";

  fetch(`${aba}.html`)
    .then(response => response.text())
    .then(html => {
      document.getElementById("conteudo").innerHTML = html;
      carregarScriptAba(aba);
    })
    .catch(error => console.error("Erro ao carregar a aba:", error));
}

// ===== Carregar Script da Aba =====
function carregarScriptAba(aba) {
  const script = document.createElement("script");
  script.src = `${aba}.js`;
  script.defer = true;
  document.body.appendChild(script);
}
