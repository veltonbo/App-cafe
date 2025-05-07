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
  if (ultimoMenu) {
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

// ===== MENSAGEM DE BOAS-VINDAS =====
console.log("%cManejo Café - Sistema de Gestão Iniciado", "color: #4caf50; font-size: 16px; font-weight: bold;");
