// ===== FUNÇÃO: CARREGAR ABA DE FORMA DINÂMICA =====
function carregarAba(arquivo) {
  fetch(arquivo)
    .then(response => response.text())
    .then(html => {
      const conteudo = document.getElementById('conteudoPrincipal');
      conteudo.classList.add('fade-out');
      setTimeout(() => {
        conteudo.innerHTML = html;
        conteudo.classList.remove('fade-out');
        conteudo.classList.add('fade-in');
        inicializarAba(arquivo);
      }, 300); // Tempo para a animação de transição
    })
    .catch(error => {
      console.error("Erro ao carregar a aba:", error);
    });

  // Atualiza o botão ativo no menu superior
  document.querySelectorAll('.menu-superior button').forEach(btn => {
    btn.classList.remove('active');
  });

  const btnId = 'btn-' + arquivo.replace('.html', '');
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.add('active');

  localStorage.setItem('aba', arquivo);
}

// ===== FUNÇÃO: INICIALIZAR A ABA CARREGADA =====
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
      break;
    case 'relatorio.html':
      if (typeof gerarRelatorioCompleto === "function") gerarRelatorioCompleto();
      break;
    case 'configuracoes.html':
      if (typeof carregarAnoSafra === "function") carregarAnoSafra();
      if (typeof carregarSafrasDisponiveis === "function") carregarSafrasDisponiveis();
      break;
  }
}

// ===== FUNÇÃO: INICIALIZAR A APLICAÇÃO =====
function inicializarApp() {
  const abaInicial = localStorage.getItem('aba') || 'aplicacao.html';
  carregarAba(abaInicial);

  // Verificar o tema salvo
  if (localStorage.getItem('tema') === 'claro') {
    document.body.classList.add('claro');
  }

  // Controlar animação ao mudar de aba
  document.querySelectorAll('.menu-superior button').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.menu-superior button').forEach(btn => {
        btn.classList.remove('active');
      });
      button.classList.add('active');
    });
  });
}

// ===== FUNÇÃO: ALTERNAR TEMA CLARO/ESCURO =====
function alternarTema() {
  document.body.classList.toggle("claro");
  const temaAtual = document.body.classList.contains("claro") ? "claro" : "escuro";
  localStorage.setItem("tema", temaAtual);
}

// ===== EVENTO: CARREGAMENTO DA PÁGINA =====
document.addEventListener('DOMContentLoaded', inicializarApp);
