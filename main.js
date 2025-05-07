// ===== INICIALIZAR MENU PRINCIPAL =====
document.addEventListener("DOMContentLoaded", () => {
  console.log("Manejo Café - Sistema de Gestão Carregado.");
  verificarTema();
});

// ===== VERIFICAR TEMA SALVO (CLARO/ESCURO) =====
function verificarTema() {
  const temaAtual = localStorage.getItem("tema") || "claro";
  document.body.classList.toggle("tema-escuro", temaAtual === "escuro");
}

// ===== MENSAGEM DE BOAS-VINDAS =====
console.log("%cManejo Café - Sistema de Gestão Iniciado", "color: #4caf50; font-size: 16px; font-weight: bold;");
