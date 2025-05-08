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

function mudarAba(aba) {
  // Marcar ícone ativo
  document.querySelectorAll(".menu-item").forEach(btn => btn.classList.remove("ativo"));
  const ativo = document.getElementById(`menu-${aba}`);
  if (ativo) ativo.classList.add("ativo");

  // Carregar o conteúdo da aba
  fetch(`${aba}.html`)
    .then(res => res.text())
    .then(html => {
      document.getElementById("conteudo").innerHTML = html;
      const script = document.createElement("script");
      script.src = `js/${aba}.js`;
      script.defer = true;
      document.body.appendChild(script);
    });
}
