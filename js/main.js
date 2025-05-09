// main.js

// Controla a exibição das abas
function mostrarAba(abaId) {
  // Oculta todas as abas
  document.querySelectorAll('.aba').forEach(aba => {
    aba.style.display = 'none';
  });

  // Exibe a aba selecionada
  const abaSelecionada = document.getElementById(abaId);
  if (abaSelecionada) {
    abaSelecionada.style.display = 'block';
  }

  // Salva a aba atual no armazenamento local
  localStorage.setItem('abaAtual', abaId);
}

// Carrega o menu inicial ao abrir o app
document.addEventListener('DOMContentLoaded', () => {
  const abaInicial = localStorage.getItem('abaAtual') || 'inicio';
  mostrarAba(abaInicial);
});
