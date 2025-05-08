// ===== MUDAR ABA =====
function mudarAba(aba) {
  // Remove classe "ativo" de todos os ícones
  document.querySelectorAll(".menu-item").forEach(item => item.classList.remove("ativo"));

  // Adiciona classe "ativo" ao ícone da aba selecionada
  document.getElementById(`menu-${aba}`).classList.add("ativo");

  // Carrega o conteúdo da aba
  carregarAba(aba);
}

// ===== CARREGAR ABA (AJAX) =====
function carregarAba(aba) {
  fetch(`${aba}.html`)
    .then(response => response.text())
    .then(html => {
      document.getElementById("conteudo").innerHTML = html;
    })
    .catch(error => {
      console.error("Erro ao carregar a aba:", error);
    });
}

// Inicializa com a primeira aba ativa
document.addEventListener("DOMContentLoaded", () => {
  mudarAba('aplicacao');
});
