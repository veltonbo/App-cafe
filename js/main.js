// main.js

// Função para navegação entre os menus
function navegar(menu) {
  window.location.href = menu;
}

// Função para navegação e destaque do menu ativo
function navegar(menu) {
  window.location.href = menu;
  setTimeout(() => {
    destacarMenuAtivo(menu);
  }, 100);
}

// Destaca o menu ativo com o ícone verde
function destacarMenuAtivo(menu) {
  document.querySelectorAll(".menu-icone").forEach(btn => {
    btn.classList.remove("active");
  });

  const menuAtivo = document.querySelector(`.menu-superior button[onclick="navegar('${menu}')"]`);
  if (menuAtivo) menuAtivo.classList.add("active");
}

// Inicializa o menu ativo ao carregar a página
document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname.split("/").pop();
  destacarMenuAtivo(path);
});
