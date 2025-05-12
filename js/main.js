// Substitua todo o conteúdo por:
function mostrarAba(abaId) {
  document.querySelectorAll('.aba').forEach(aba => {
    aba.style.display = 'none';
  });
  document.getElementById(abaId).style.display = 'block';
}

function inicializarApp() {
  const abaInicial = localStorage.getItem('aba') || 'aplicacoes';
  mostrarAba(abaInicial);
  
  if (localStorage.getItem('tema') === 'claro') {
    document.body.classList.add('claro');
  }

  document.dispatchEvent(new Event('dadosCarregados'));
}

window.addEventListener('DOMContentLoaded', inicializarApp);
