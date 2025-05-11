// ===== FUNÇÃO PARA TROCAR ABAS =====
function mostrarAba(abaId) {
  document.querySelectorAll('.aba').forEach(aba => aba.style.display = 'none');
  document.getElementById(abaId).style.display = 'block';
}
