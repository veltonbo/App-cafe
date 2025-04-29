function inicializarApp() {
  mostrarAba(localStorage.getItem('aba') || 'aplicacoes');
}

function mostrarAba(id) {
  document.querySelectorAll('.aba').forEach(aba => aba.classList.remove('active'));
  document.querySelectorAll('.menu-superior button').forEach(btn => btn.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.getElementById('btn-' + id).classList.add('active');
  localStorage.setItem('aba', id);

  document.getElementById(id).innerHTML = `<h2>${capitalize(id)}</h2><p>Conteúdo da aba ${id}.</p>`;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
