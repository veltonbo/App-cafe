// ===== CONTROLE DO MENU LATERAL =====
document.addEventListener('DOMContentLoaded', function() {
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const hamburgerButton = document.getElementById('hamburger-button');
  const sidebarMobileBg = document.getElementById('sidebarMobileBg');
  const menuButtons = document.querySelectorAll('.sidebar-nav button');
  
  // Função para abrir/fechar o menu
  function toggleSidebar() {
    sidebar.classList.toggle('open');
    document.body.classList.toggle('sidebar-open');
    
    // Prevenir scroll quando menu aberto em mobile
    if (sidebar.classList.contains('open') && window.innerWidth <= 700) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }
  
  // Eventos para os botões do menu
  sidebarToggle.addEventListener('click', toggleSidebar);
  hamburgerButton.addEventListener('click', toggleSidebar);
  
  // Fechar menu ao clicar no overlay
  sidebarMobileBg.addEventListener('click', () => {
    sidebar.classList.remove('open');
    document.body.classList.remove('sidebar-open');
    document.body.style.overflow = '';
  });
  
  // Fechar menu ao selecionar um item no mobile
  menuButtons.forEach(button => {
    button.addEventListener('click', () => {
      if (window.innerWidth <= 700) {
        sidebar.classList.remove('open');
        document.body.classList.remove('sidebar-open');
      }
      
      // Remover classe ativa dos botões
      menuButtons.forEach(btn => btn.classList.remove('active'));
      // Adicionar classe ativa ao botão clicado
      button.classList.add('active');
    });
  });
});

// ===== FUNÇÃO PARA TROCAR ABAS COM ANIMAÇÃO =====
function mostrarAba(abaId) {
  // Ocultar todas as abas primeiro
  document.querySelectorAll('.aba').forEach(aba => {
    if (aba.style.display !== 'none') {
      // Fade out da aba atual
      aba.style.opacity = '0';
      aba.style.transform = 'translateY(20px)';
      
      setTimeout(() => {
        aba.style.display = 'none';
      }, 200);
    } else {
      aba.style.display = 'none';
    }
  });

  // Após um pequeno delay, mostrar a nova aba com animação
  setTimeout(() => {
    const abaSelecionada = document.getElementById(abaId);
    if (abaSelecionada) {
      abaSelecionada.style.display = 'block';
      abaSelecionada.classList.add('aba-entrando');
      
      // Trigger reflow para garantir que a animação funcione
      void abaSelecionada.offsetWidth;
      
      // Aplicar a animação de entrada
      abaSelecionada.classList.add('aba-visivel');
      abaSelecionada.classList.remove('aba-entrando');
    }

    // Atualizar botões do menu
    document.querySelectorAll('.sidebar-nav button').forEach(btn => {
      btn.classList.remove('active');
    });

    const btnId = 'btn-' + abaId;
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.classList.add('active');
      // Destacar o botão com uma animação
      btn.classList.add('animacao-destaque');
      setTimeout(() => {
        btn.classList.remove('animacao-destaque');
      }, 2000);
    }

    localStorage.setItem('aba', abaId);
  }, 200);
}

// ===== INICIALIZAR O APLICATIVO =====
function inicializarApp() {
  const abaInicial = localStorage.getItem('aba') || 'aplicacoes';
  mostrarAba(abaInicial);

  if (localStorage.getItem('tema') === 'claro') {
    document.body.classList.add('claro');
  }
  
  // Marcar o botão da aba inicial como ativo
  const btnInicial = document.getElementById('btn-' + abaInicial);
  if (btnInicial) btnInicial.classList.add('active');

  // Carregar dados do banco ao iniciar
  if (typeof carregarTarefas === 'function') carregarTarefas();
  if (typeof carregarFinanceiro === 'function') carregarFinanceiro();

  // Eventos customizados para garantir que as funções carreguem corretamente
  document.addEventListener('dadosCarregados', () => {
    if (typeof carregarAplicacoes === "function") carregarAplicacoes();
    if (typeof carregarColheita === "function") carregarColheita();
    if (typeof carregarValorLata === "function") carregarValorLata();
    if (typeof carregarAnoSafra === "function") carregarAnoSafra();
    if (typeof carregarSafrasDisponiveis === "function") carregarSafrasDisponiveis();
  });
}

// Função para aguardar o carregamento de tarefas e gastos
function aguardarDadosPrincipais(prontoCallback) {
  let tentativas = 0;
  function verificar() {
    tentativas++;
    if (window.tarefas && window.gastos) {
      prontoCallback();
    } else if (tentativas < 50) { // tenta por até 5 segundos
      setTimeout(verificar, 100);
    }
  }
  verificar();
}

// Executa ao carregar a página
window.addEventListener('DOMContentLoaded', function() {
  inicializarApp();
});

// ===== MODAL TAREFA =====
function abrirModalTarefa(editar = false) {
  document.getElementById('modalTarefaBg').style.display = 'flex';
  document.getElementById('btnFlutuanteAddTarefa').style.display = 'none';
  if (!editar) limparCamposTarefa();
}
function fecharModalTarefa() {
  document.getElementById('modalTarefaBg').style.display = 'none';
  document.getElementById('btnFlutuanteAddTarefa').style.display = 'block';
  limparCamposTarefa();
  indiceEdicaoTarefa = null;
  document.getElementById('btnSalvarTarefa').innerText = 'Salvar Tarefa';
}
function salvarOuEditarTarefa() {
  adicionarTarefa();
  fecharModalTarefa();
}

// ===== MODAL COLHEITA =====
function abrirModalColheita(editar = false) {
  document.getElementById('modalColheitaBg').style.display = 'flex';
  document.getElementById('btnFlutuanteAddColheita').style.display = 'none';
  if (!editar) limparCamposColheita();
}
function fecharModalColheita() {
  document.getElementById('modalColheitaBg').style.display = 'none';
  document.getElementById('btnFlutuanteAddColheita').style.display = 'block';
  limparCamposColheita();
  indiceEdicaoColheita = null;
  document.getElementById('btnSalvarColheita').innerText = 'Salvar Colheita';
}
function salvarOuEditarColheita() {
  adicionarColheita();
  fecharModalColheita();
}

// ===== MODAL FINANCEIRO =====
function abrirModalFinanceiro(editar = false) {
  document.getElementById('modalFinanceiroBg').style.display = 'flex';
  document.getElementById('btnFlutuanteAddFinanceiro').style.display = 'none';
  if (!editar) limparCamposFinanceiro();
}
function fecharModalFinanceiro() {
  document.getElementById('modalFinanceiroBg').style.display = 'none';
  document.getElementById('btnFlutuanteAddFinanceiro').style.display = 'block';
  limparCamposFinanceiro();
  indiceEdicaoGasto = null;
  document.getElementById('btnSalvarFinanceiro').innerText = 'Salvar Gasto';
}
function salvarOuEditarFinanceiro() {
  adicionarFinanceiro();
  fecharModalFinanceiro();
}

// ===== BOTÃO E MODAL DE FILTRO =====
function criarBotaoFiltroLista(containerId, onOpen) {
  const container = document.getElementById(containerId);
  if (!container) return;
  let wrapper = container.querySelector('.filtro-lista-btn-container');
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'filtro-lista-btn-container';
    container.prepend(wrapper);
  }
  // Remove qualquer campo de pesquisa antigo
  const antigo = wrapper.querySelector('.campo-pesquisa-filtro');
  if (antigo) antigo.remove();
  // Evita duplicar botão
  let btn = wrapper.querySelector('.filtro-lista-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.className = 'filtro-lista-btn';
    btn.innerHTML = '<span class="filtro-lista-icn"><i class="fas fa-filter"></i></span>Filtros';
    btn.type = 'button';
    wrapper.appendChild(btn);
  }
  btn.onclick = () => {
    btn.style.display = 'none';
    const input = document.createElement('input');
    input.className = 'campo-pesquisa-filtro';
    input.type = 'text';
    input.placeholder = 'Pesquisar...';
    input.autofocus = true;
    wrapper.appendChild(input);
    input.focus();
    input.addEventListener('input', (e) => {
      filtrarListaGenerica(containerId, e.target.value);
    });
    input.addEventListener('blur', () => {
      input.remove();
      btn.style.display = '';
      filtrarListaGenerica(containerId, '');
    });
  };
}

// Botão de filtro para cada lista
document.addEventListener("dadosCarregados", () => {
  setTimeout(() => {
    criarBotaoFiltroLista('financeiroLista', () => {
      abrirModalFiltroLista('', null, (valor) => filtrarListaGenerica('financeiroLista', valor));
    });
    // INSERÇÃO CORRETA DO BOTÃO DE FILTRO DE TAREFAS
    criarBotaoFiltroLista('filtroTarefasContainer', () => {
      abrirModalFiltroLista('', null, (valor) => filtrarListaGenerica('listaTarefas', valor));
    });
    criarBotaoFiltroLista('listaAplicacoes', () => {
      abrirModalFiltroLista('', null, (valor) => filtrarListaGenerica('listaAplicacoes', valor));
    });
    criarBotaoFiltroLista('colheitaPendentes', () => {
      abrirModalFiltroLista('', null, (valor) => filtrarListaGenerica('colheitaPendentes', valor));
    });
    criarBotaoFiltroLista('colheitaPagos', () => {
      abrirModalFiltroLista('', null, (valor) => filtrarListaGenerica('colheitaPagos', valor));
    });
  }, 200);
});

function filtrarListaGenerica(listaId, termo) {
  const lista = document.getElementById(listaId);
  if (!lista) return;
  const items = lista.querySelectorAll('.item');
  const termoLower = (termo || '').toLowerCase();
  items.forEach(item => {
    const texto = item.innerText.toLowerCase();
    item.style.display = texto.includes(termoLower) ? '' : 'none';
  });
}

// Ao final do carregamento dos dados principais:
if (window.tarefas && window.gastos) {
  document.dispatchEvent(new Event('dadosCarregados'));
}

['tarefas','aplicacoes','gastos','colheita'].forEach(nome => {
  Object.defineProperty(window, nome, {
    set(v) { this['__'+nome]=v; if(typeof atualizarResumoInicio==='function') atualizarResumoInicio(); },
    get() { return this['__'+nome]||[]; }
  });
});

function abrirPainelNotificacoes() {
  // Exibe as notificações já existentes no container, ou pode futuramente abrir um painel lateral/modal
  const container = document.getElementById('notificacoes-container');
  if (container) {
    container.style.animation = 'none';
    container.offsetHeight; // força reflow
    container.style.animation = 'notificacaoPulse 0.5s';
    setTimeout(() => { container.style.animation = ''; }, 500);
  }
}

// Atualiza o badge de notificações no sino
function atualizarBadgeNotificacoes(qtd) {
  const badge = document.getElementById('notificacoes-badge');
  if (!badge) return;
  if (qtd > 0) {
    badge.innerText = qtd > 99 ? '99+' : qtd;
    badge.style.display = 'inline-block';
    if (qtd > 9) {
      badge.setAttribute('data-qtd', 'true');
    } else {
      badge.removeAttribute('data-qtd');
    }
  } else {
    badge.style.display = 'none';
    badge.removeAttribute('data-qtd');
  }
}

// Marca notificações como lidas ao abrir o modal
function marcarNotificacoesComoLidas() {
  const lista = document.getElementById('notificacoesModalLista');
  if (lista) {
    lista.querySelectorAll('.notificacao.nao-lida').forEach(n => n.classList.remove('nao-lida'));
    contarNotificacoesNaoLidas();
  }
}

// Hook para contar notificações NÃO LIDAS
function contarNotificacoesNaoLidas() {
  let qtd = 0;
  const lista = document.getElementById('notificacoesModalLista');
  if (lista) {
    qtd = lista.querySelectorAll('.notificacao.nao-lida').length;
  }
  atualizarBadgeNotificacoes(qtd);
}

// Observa mudanças no modal para atualizar badge
const observer = new MutationObserver(contarNotificacoesNaoLidas);
const notifLista = document.getElementById('notificacoesModalLista');
if (notifLista) {
  observer.observe(notifLista, { childList: true, subtree: true, attributes: true });
}

window.abrirPainelNotificacoes = function() {
  // Efeito visual
  const container = document.getElementById('notificacoes-container');
  if (container) {
    container.style.animation = 'none';
    container.offsetHeight;
    container.style.animation = 'notificacaoPulse 0.5s';
    setTimeout(() => { container.style.animation = ''; }, 500);
    // Marca como lidas
    container.querySelectorAll('.notificacao.nao-lida').forEach(n => n.classList.remove('nao-lida'));
    contarNotificacoesNaoLidas();
  }
};

window.addEventListener('dadosCarregados', () => {
  if (typeof verificarNotificacoes === 'function') {
    verificarNotificacoes();
  }
});
