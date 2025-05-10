// ====== INICIALIZAÇÃO DO APLICATIVO ======
document.addEventListener('DOMContentLoaded', () => {
  if (typeof inicializarApp === 'function') {
    inicializarApp();
  } else {
    console.error("Erro: função inicializarApp não encontrada.");
  }
});

// ====== FUNÇÃO DE INICIALIZAÇÃO DO SISTEMA ======
function inicializarApp() {
  console.log("Aplicativo inicializado.");
  mostrarAba('aplicacoes'); // Abre o menu Aplicações por padrão

  // Carregar dados de cada menu
  if (typeof carregarAplicacoes === 'function') carregarAplicacoes();
  if (typeof carregarTarefas === 'function') carregarTarefas();
  if (typeof carregarFinanceiro === 'function') carregarFinanceiro();
  if (typeof carregarColheita === 'function') carregarColheita();
  if (typeof gerarRelatorio === 'function') gerarRelatorio();
  if (typeof carregarConfiguracoes === 'function') carregarConfiguracoes();
}

// ====== FUNÇÃO PARA MOSTRAR AS ABAS ======
function mostrarAba(aba) {
  const abas = document.querySelectorAll('.aba');
  abas.forEach(element => element.style.display = 'none');
  document.getElementById(aba).style.display = 'block';
}
