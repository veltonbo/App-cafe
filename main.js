// ===== INICIALIZAR MENU PRINCIPAL =====
document.addEventListener("DOMContentLoaded", () => {
  console.log("Manejo Café - Sistema de Gestão Carregado.");
  verificarTema();
  lembrarUltimoMenu();
});

// ===== VERIFICAR TEMA SALVO (CLARO/ESCURO) =====
function verificarTema() {
  const temaAtual = localStorage.getItem("tema") || "claro";
  document.body.classList.toggle("tema-escuro", temaAtual === "escuro");
}

// ===== LEMBRAR ÚLTIMO MENU ACESSADO =====
function lembrarUltimoMenu() {
  const ultimoMenu = localStorage.getItem("ultimoMenu");
  if (ultimoMenu && window.location.pathname === "/App-cafe/") {
    window.location.href = ultimoMenu;
  }
}

// ===== SALVAR MENU ACESSADO =====
document.querySelectorAll(".navegacao a").forEach(link => {
  link.addEventListener("click", (event) => {
    const menuDestino = event.target.href;
    localStorage.setItem("ultimoMenu", menuDestino);
  });
});

// ===== VERIFICAR SE CSS E JS CARREGARAM =====
window.addEventListener('load', () => {
  const cssLink = document.querySelector('link[href="./css/style.css"]');
  const jsScript = document.querySelector('script[src="./js/main.js"]');
  
  if (!cssLink) {
    alert("O CSS (style.css) não foi carregado corretamente.");
  }

  if (!jsScript) {
    alert("O JavaScript (main.js) não foi carregado corretamente.");
  }
});

// ===== MENSAGEM DE BOAS-VINDAS =====
console.log("%cManejo Café - Sistema de Gestão Iniciado", "color: #4caf50; font-size: 16px; font-weight: bold;");
