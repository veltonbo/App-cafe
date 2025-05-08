// ===== MENU DE NAVEGAÇÃO DINÂMICA =====
document.addEventListener("DOMContentLoaded", () => {
  carregarAbaInicial();
  configurarNavegacao();
});

// ===== CARREGAR ABA INICIAL =====
function carregarAbaInicial() {
  const abaSalva = localStorage.getItem("abaAtiva") || "aplicacao.html";
  mudarAba(abaSalva);
}

// ===== CONFIGURAR NAVEGAÇÃO =====
function configurarNavegacao() {
  document.querySelectorAll(".navbar a").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const destino = e.target.getAttribute("href");
      mudarAba(destino);
    });
  });
}

// ===== MUDAR DE ABA =====
function mudarAba(destino) {
  document.querySelectorAll(".navbar a").forEach(link => link.classList.remove("active"));
  document.querySelector(`.navbar a[href="${destino}"]`).classList.add("active");
  
  document.querySelector("main").innerHTML = '<div class="loading">Carregando...</div>';
  localStorage.setItem("abaAtiva", destino);

  fetch(destino)
    .then(response => response.text())
    .then(html => {
      document.querySelector("main").innerHTML = html;
      carregarScriptsAba(destino);
    })
    .catch(() => {
      document.querySelector("main").innerHTML = '<div class="erro">Erro ao carregar o menu.</div>';
    });
}

// ===== CARREGAR SCRIPTS DA ABA =====
function carregarScriptsAba(destino) {
  const scriptPath = destino.replace(".html", ".js").replace("html", "js");
  const script = document.createElement("script");
  script.src = scriptPath;
  script.defer = true;
  document.body.appendChild(script);
}

// ===== TEMA ESCURO/CLARO =====
document.querySelector("#toggleTheme").addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  localStorage.setItem("temaEscuro", document.body.classList.contains("dark-mode"));
});

// ===== APLICAR TEMA SALVO =====
document.addEventListener("DOMContentLoaded", () => {
  const temaEscuro = localStorage.getItem("temaEscuro") === "true";
  if (temaEscuro) {
    document.body.classList.add("dark-mode");
  }
});
