// ===== CARREGAR MENU SELECIONADO =====
function mudarAba(menu) {
  const abas = ['aplicacoes', 'tarefas', 'financeiro', 'colheita', 'relatorio', 'configuracoes'];
  
  abas.forEach(aba => {
    document.getElementById(aba).style.display = (aba === menu) ? 'block' : 'none';
  });

  localStorage.setItem('menuAtivo', menu);
  carregarScriptsAba(menu);

  // Atualizar menu inferior
  document.querySelectorAll('footer .menu-item').forEach(item => {
    item.classList.remove('active');
  });
  document.querySelector(`#menu-${menu}`).classList.add('active');
}

// ===== INICIALIZAR MENU ATIVO AO CARREGAR =====
document.addEventListener("DOMContentLoaded", () => {
  const menuAtivo = localStorage.getItem('menuAtivo') || 'aplicacoes';
  mudarAba(menuAtivo);
});

// ===== CARREGAR SCRIPTS DE CADA ABA =====
function carregarScriptsAba(menu) {
  switch (menu) {
    case 'aplicacoes':
      carregarAplicacoes();
      break;
    case 'tarefas':
      carregarTarefas();
      break;
    case 'financeiro':
      carregarFinanceiro();
      break;
    case 'colheita':
      carregarColheita();
      break;
    case 'relatorio':
      carregarRelatorio();
      break;
    case 'configuracoes':
      carregarConfiguracoes();
      break;
  }
}
