// Inicializa o app e ativa a aba inicial
function inicializarApp() {
  mostrarAba('aplicacoes');
  carregarAplicacoes();
  carregarTarefas();
  carregarFinanceiro();
  carregarColheita();
  carregarConfiguracoes();
}

// Exibe a aba escolhida e oculta as outras
function mostrarAba(id) {
  document.querySelectorAll('.aba').forEach(aba => {
    aba.classList.remove('active');
  });
  document.getElementById(id).classList.add('active');

  // Salva a aba atual para manter ao recarregar
  localStorage.setItem('abaAtual', id);
}

// Ao carregar a página, restaura a aba anterior
document.addEventListener('DOMContentLoaded', () => {
  const abaAnterior = localStorage.getItem('abaAtual') || 'aplicacoes';
  mostrarAba(abaAnterior);

  // Garante que a função inicializarApp está disponível
  if (typeof inicializarApp === 'function') {
    inicializarApp();
  } else {
    console.error('Função inicializarApp não encontrada.');
  }
});
