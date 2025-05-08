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

// Função para mudar aba e destacar ícone ativo
function mudarAba(aba) {
  localStorage.setItem("ultimaAba", aba);
  document.getElementById("conteudo").innerHTML = "";

  fetch(`${aba}.html`)
    .then((response) => response.text())
    .then((html) => {
      document.getElementById("conteudo").innerHTML = html;
      carregarScriptAba(aba);
      destacarIconeAtivo(aba);
    })
    .catch((error) => {
      console.error("Erro ao carregar a aba:", error);
    });
}

// Função para destacar o ícone do menu ativo
function destacarIconeAtivo(aba) {
  const botoesMenu = document.querySelectorAll(".menu-superior button");
  botoesMenu.forEach((botao) => botao.classList.remove("ativo"));
  
  const botaoAtivo = document.querySelector(`button[data-aba='${aba}']`);
  if (botaoAtivo) botaoAtivo.classList.add("ativo");
}

// Verificar aba salva e destacar ao iniciar
document.addEventListener("DOMContentLoaded", () => {
  const ultimaAba = localStorage.getItem("ultimaAba") || "aplicacao";
  destacarIconeAtivo(ultimaAba);
});

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
