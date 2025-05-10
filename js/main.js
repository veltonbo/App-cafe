// ===== NAVEGAÇÃO ENTRE MENUS =====
function inicializarApp() {
  const abaInicial = localStorage.getItem('aba') || 'aplicacao';
  mostrarAba(abaInicial);
}

function mostrarAba(abaId) {
  document.querySelectorAll('.menu-superior button').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.conteudo').forEach(section => section.style.display = 'none');

  document.querySelector(`[onclick="window.location.href='${abaId}.html'"]`).classList.add('active');
}

window.addEventListener('DOMContentLoaded', inicializarApp);
