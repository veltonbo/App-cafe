// Função para carregar o conteúdo de uma aba de forma dinâmica
function carregarAba(arquivo) {
  fetch(arquivo)
    .then(response => response.text())
    .then(html => {
      document.getElementById('conteudoPrincipal').innerHTML = html;
      inicializarAba(arquivo);
    })
    .catch(error => {
      console.error("Erro ao carregar a aba:", error);
    });

  // Atualiza o botão ativo no menu
  document.querySelectorAll('.menu-superior button').forEach(btn => {
    btn.classList.remove('active');
  });

  const btnId = 'btn-' + arquivo.replace('.html', '');
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.add('active');

  localStorage.setItem('aba', arquivo);
}

// Função para inicializar a aba carregada
function inicializarAba(arquivo) {
  switch (arquivo) {
    case 'aplicacao.html':
      if (typeof carregarAplicacoes === "function") carregarAplicacoes();
      break;
    case 'tarefas.html':
      if (typeof carregarTarefas === "function") carregarTarefas();
      break;
    case 'financeiro.html':
      if (typeof carregarFinanceiro === "function") carregarFinanceiro();
      break;
    case 'colheita.html':
      if (typeof carregarColheita === "function") carregarColheita();
      if (typeof carregarValorLata === "function") carregarValorLata();
      break;
    case 'relatorio.html':
      if (typeof carregarRelatorio === "function") carregarRelatorio();
      break;
    case 'configuracoes.html':
      if (typeof carregarAnoSafra === "function") carregarAnoSafra();
      if (typeof carregarSafrasDisponiveis === "function") carregarSafrasDisponiveis();
      break;
  }
}

// Inicializa o aplicativo ao carregar a página
function inicializarApp() {
  const abaInicial = localStorage.getItem('aba') || 'aplicacao.html';
  carregarAba(abaInicial);

  // Verifica o tema salvo
  if (localStorage.getItem('tema') === 'claro') {
    document.body.classList.add('claro');
  }
}

// Executa ao carregar a página
document.addEventListener('DOMContentLoaded', inicializarApp);
