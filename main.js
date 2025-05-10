// ====== FUNÇÃO DE INICIALIZAÇÃO DO APLICATIVO ======
function inicializarApp() {
  console.log("Aplicativo inicializado.");

  // Verificar se os menus e dados são carregados corretamente
  mostrarAba('aplicacoes'); // Abre a aba Aplicações por padrão

  // Carregar dados de cada menu
  carregarAplicacoes();
  carregarTarefas();
  carregarFinanceiro();
  carregarColheita();
  gerarRelatorio();
  carregarConfiguracoes();
}

// ====== GARANTIR QUE A FUNÇÃO SEJA CHAMADA AO INICIAR ======
document.addEventListener('DOMContentLoaded', () => {
  if (typeof inicializarApp === 'function') {
    inicializarApp();
  } else {
    console.error("Erro: função inicializarApp não encontrada.");
  }
});

// ====== FUNÇÃO PARA MOSTRAR AS ABAS ======
function mostrarAba(aba) {
  const abas = document.querySelectorAll('.aba');
  abas.forEach(element => element.style.display = 'none');

  const abaSelecionada = document.getElementById(aba);
  if (abaSelecionada) {
    abaSelecionada.style.display = 'block';
  }
}
