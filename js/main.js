// ===== CARREGAR MENU SELECIONADO =====
function mudarAba(menu) {
  const abas = ['aplicacoes', 'tarefas', 'financeiro', 'colheita', 'relatorio', 'configuracoes'];
  
  abas.forEach(aba => {
    document.getElementById(aba).style.display = (aba === menu) ? 'block' : 'none';
  });

  // Armazenar o menu ativo no localStorage
  localStorage.setItem('menuAtivo', menu);

  // Carregar o script correspondente
  carregarScriptsAba(menu);
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

// ===== ANIMAÇÃO SUAVE ENTRE MENUS =====
function transicaoSuave() {
  document.querySelector('.conteudo').classList.add('fade-in');
  setTimeout(() => {
    document.querySelector('.conteudo').classList.remove('fade-in');
  }, 300);
}

// ===== APLICAR TRANSIÇÃO AO MUDAR ABA =====
document.querySelectorAll('nav button').forEach(button => {
  button.addEventListener('click', () => {
    transicaoSuave();
  });
});
