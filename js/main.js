// ===== MUDAR ABA =====
function mudarAba(aba) {
  document.getElementById("conteudo").innerHTML = "";

  fetch(`${aba}.html`)
    .then(response => response.text())
    .then(html => {
      document.getElementById("conteudo").innerHTML = html;
    })
    .catch(error => {
      console.error("Erro ao carregar a aba:", error);
    });
}

// Inicializar com a primeira aba (Aplicação)
document.addEventListener("DOMContentLoaded", () => {
  mudarAba('aplicacao');
});
