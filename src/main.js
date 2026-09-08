// ===== CONTROLE DO MENU LATERAL =====
document.addEventListener('DOMContentLoaded', function() {
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const hamburgerButton = document.getElementById('hamburger-button');
  const sidebarMobileBg = document.getElementById('sidebarMobileBg');
  const menuButtons = document.querySelectorAll('.sidebar-nav button');
  
  // Garantir que o menu esteja fechado ao iniciar
  sidebar.classList.remove('open');
  document.body.classList.remove('sidebar-open');
  if (sidebarMobileBg) sidebarMobileBg.style.display = 'none';
  
  // Detectar se é um dispositivo móvel
  const isMobile = window.innerWidth <= 700;
  
  // Função para abrir/fechar o menu
  function toggleSidebar() {
    sidebar.classList.toggle('open');
    document.body.classList.toggle('sidebar-open');
    
    // Prevenir scroll quando menu aberto em mobile
    if (sidebar.classList.contains('open') && isMobile) {
      document.body.style.overflow = 'hidden';
      // Mostrar background em dispositivos móveis
      if (sidebarMobileBg) sidebarMobileBg.style.display = 'block';
      // Animar botão hamburger
      if (hamburgerButton) hamburgerButton.classList.add('active');
    } else {
      document.body.style.overflow = '';
      // Esconder background
      if (sidebarMobileBg) sidebarMobileBg.style.display = 'none';
      // Remover animação do botão hamburger
      if (hamburgerButton) hamburgerButton.classList.remove('active');
    }
  }
  
  // Eventos para os botões do menu
  if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
  if (hamburgerButton) hamburgerButton.addEventListener('click', toggleSidebar);
  
  // Fechar menu ao clicar no overlay
  if (sidebarMobileBg) {
    sidebarMobileBg.addEventListener('click', () => {
      sidebar.classList.remove('open');
      document.body.classList.remove('sidebar-open');
      document.body.style.overflow = '';
      sidebarMobileBg.style.display = 'none';
      if (hamburgerButton) hamburgerButton.classList.remove('active');
    });
  }
  
  // Fechar menu ao selecionar um item no mobile
  menuButtons.forEach(button => {
    button.addEventListener('click', () => {
      if (isMobile) {
        sidebar.classList.remove('open');
        document.body.classList.remove('sidebar-open');
        document.body.style.overflow = '';
        if (sidebarMobileBg) sidebarMobileBg.style.display = 'none';
        if (hamburgerButton) hamburgerButton.classList.remove('active');
      }
    });
  });
  
  // Ajustar altura do viewport para mobile (corrige problema do vh em navegadores móveis)
  adjustViewportHeight();
  window.addEventListener('resize', adjustViewportHeight);
  window.addEventListener('orientationchange', () => {
    setTimeout(adjustViewportHeight, 200);
  });
});

/**
 * Ajusta a altura do viewport para corrigir problema em dispositivos móveis
 */
function adjustViewportHeight() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

// ===== FUNÇÃO PARA TROCAR ABAS COM ANIMAÇÃO =====
function mostrarAba(abaId, isInitialLoad = false) {
  console.log("Mostrando aba:", abaId, "isInitialLoad:", isInitialLoad);
  
  // Garantir que a aba solicitada existe
  const abaSelecionada = document.getElementById(abaId);
  if (!abaSelecionada) {
    console.error(`Aba '${abaId}' não encontrada!`);
    return;
  }
  
  // Remove the initial class from any previously set tabs
  document.querySelectorAll('.aba-inicial').forEach(aba => {
    aba.classList.remove('aba-inicial');
  });
  
  // Ocultar todas as abas primeiro
  document.querySelectorAll('.aba').forEach(aba => {
    // Remove classes that might be applied
    aba.classList.remove('aba-visivel');
    aba.classList.remove('aba-entrando');
    
    if (isInitialLoad) {
      // For initial load, immediately hide all tabs
      aba.style.display = 'none';
      aba.style.opacity = '0';
    } else if (aba.id !== abaId) {
      // For regular tab switching, immediately hide all other tabs
      aba.style.display = 'none';
    }
  });

  // Trigger data loading for the selected tab BEFORE showing it
  // This ensures data starts loading as soon as possible
  triggerTabDataLoad(abaId);
  
  // Show the selected tab
  if (abaSelecionada) {
    // Ensure display is set to block first (necessary for animations)
    abaSelecionada.style.display = 'block';
    
    if (isInitialLoad) {
      // For initial load, immediately show without animation
      abaSelecionada.classList.add('aba-inicial');
      abaSelecionada.style.opacity = '1';
      abaSelecionada.style.transform = 'translateY(0)';
    } else {
      // For regular navigation, use animation
      abaSelecionada.classList.add('aba-entrando');
      
      // Force a reflow to ensure the animation runs
      void abaSelecionada.offsetWidth;
      
      // Apply animation with a slight delay to ensure display:block takes effect
      setTimeout(() => {
        abaSelecionada.classList.remove('aba-entrando');
        abaSelecionada.classList.add('aba-visivel');
        abaSelecionada.style.opacity = '1';
        abaSelecionada.style.transform = 'translateY(0)';
      }, 10);
    }
  }
  
  // Update active menu button state
  document.querySelectorAll('.sidebar-nav button').forEach(btn => {
    btn.classList.remove('active');
  });

  const btnId = 'btn-' + abaId;
  const btn = document.getElementById(btnId);
  if (btn) {
    btn.classList.add('active');
    
    // Add button highlight animation for regular navigation
    if (!isInitialLoad) {
      btn.classList.add('animacao-destaque');
      setTimeout(() => {
        btn.classList.remove('animacao-destaque');
      }, 2000);
    }
  }
  
  // Save the current tab in localStorage
  localStorage.setItem('aba', abaId);
  
  // Trigger data loading for the selected tab if needed
  triggerTabDataLoad(abaId);
}

// ===== HELPER PARA CARREGAR DADOS ESPECÍFICOS DE CADA ABA =====
function triggerTabDataLoad(abaId) {
  console.log(`Carregando dados para a aba: ${abaId}`);
  
  // Mostrar um indicador de carregamento na aba, se aplicável
  const aba = document.getElementById(abaId);
  if (aba) {
    // Verificar se já existe um indicador de carregamento
    let loadingIndicator = aba.querySelector('.loading-indicator');
    if (!loadingIndicator && !aba.getAttribute('data-loaded')) {
      loadingIndicator = document.createElement('div');
      loadingIndicator.className = 'loading-indicator';
      loadingIndicator.innerHTML = '<div class="spinner"></div><span>Carregando dados...</span>';
      
      // Inserir no início da aba, abaixo do título h2 se existir
      const titulo = aba.querySelector('h2');
      if (titulo) {
        titulo.after(loadingIndicator);
      } else {
        aba.prepend(loadingIndicator);
      }
    }
  }
  
  // Função auxiliar para remover o indicador de carregamento quando os dados estiverem prontos
  const removeLoading = () => {
    if (aba) {
      aba.setAttribute('data-loaded', 'true');
      const loadingIndicator = aba.querySelector('.loading-indicator');
      if (loadingIndicator) {
        loadingIndicator.style.opacity = '0';
        setTimeout(() => loadingIndicator.remove(), 300);
      }
    }
  };

  // Carregar dados específicos para cada aba quando ela é selecionada
  switch(abaId) {
    case 'aplicacoes':
      if (typeof carregarAplicacoes === "function") carregarAplicacoes(removeLoading);
      else removeLoading();
      break;
    case 'tarefas':
      if (typeof carregarTarefas === "function") carregarTarefas(removeLoading);
      else removeLoading();
      break;
    case 'financeiro':
      if (typeof carregarFinanceiro === "function") carregarFinanceiro(removeLoading);
      else removeLoading();
      break;
    case 'colheita':
      if (typeof carregarColheita === "function") carregarColheita(removeLoading);
      else removeLoading();
      break;
    case 'inicio':
      if (typeof atualizarResumoInicio === "function") {
        atualizarResumoInicio();
        removeLoading();
      } else removeLoading();
      break;
    case 'relatorio':
      if (typeof carregarDadosRelatorio === "function") carregarDadosRelatorio(removeLoading);
      else removeLoading();
      break;
    case 'configuracoes':
      if (typeof carregarConfiguracoes === "function") carregarConfiguracoes(removeLoading);
      else removeLoading();
      break;
    default:
      removeLoading();
  }
}

// ===== INICIALIZAR O APLICATIVO =====
function inicializarApp() {
  console.log("Inicializando aplicativo...");
  // Obter a última aba visitada ou definir uma padrão
  const abaInicial = localStorage.getItem('aba') || 'inicio';
  
  // Esconder todas as abas primeiro para prevenir flash
  document.querySelectorAll('.aba').forEach(aba => {
    aba.style.display = 'none';
    aba.style.opacity = '0';
    // Limpar quaisquer classes que possam afetar a exibição
    aba.classList.remove('aba-inicial', 'aba-entrando', 'aba-visivel');
    // Remover status de carregado para forçar recarregamento
    aba.removeAttribute('data-loaded');
  });
  
  // Aplicar tema se estiver salvo
  if (localStorage.getItem('tema') === 'claro') {
    document.body.classList.add('claro');
  }
  
  // Adicionar CSS para o indicador de carregamento se não existir
  if (!document.getElementById('loading-indicator-styles')) {
    const styles = document.createElement('style');
    styles.id = 'loading-indicator-styles';
    styles.innerHTML = `
      .loading-indicator {
        display: flex;
        align-items: center;
        margin: 10px 0;
        padding: 10px;
        background: rgba(79, 70, 229, 0.1);
        border-radius: 8px;
        border-left: 3px solid #4f46e5;
        opacity: 1;
        transition: opacity 0.3s ease;
      }
      .spinner {
        width: 18px;
        height: 18px;
        border: 2px solid rgba(79, 70, 229, 0.3);
        border-top: 2px solid #4f46e5;
        border-radius: 50%;
        margin-right: 10px;
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(styles);
  }
  
  // Sempre mostrar a aba inicial, mesmo se os dados não estiverem carregados
  // Isso garante que a UI seja responsiva enquanto os dados carregam em segundo plano
  setTimeout(() => {
    mostrarAba(abaInicial, true);
    
    // Pré-carregar dados essenciais para responsividade
    const essentialDataCallbacks = [];
    
    // Acompanhar quando todos os dados essenciais forem carregados
    let loadedCount = 0;
    const checkAllLoaded = () => {
      loadedCount++;
      if (loadedCount >= 2) { // Tarefas e Financeiro
        console.log("Todos os dados essenciais foram carregados");
        document.dispatchEvent(new Event('essentialDataLoaded'));
      }
    };
    
    // Carregar dados essenciais
    if (typeof carregarTarefas === 'function') carregarTarefas(checkAllLoaded);
    if (typeof carregarFinanceiro === 'function') carregarFinanceiro(checkAllLoaded);
    
    // Carregar dados adicionais após um pequeno delay para priorizar UI
    setTimeout(() => {
      if (typeof carregarAplicacoes === 'function') carregarAplicacoes();
      if (typeof carregarColheita === 'function') carregarColheita();
    }, 500);
  }, 100);
}

// Executa ao carregar a página
window.addEventListener('DOMContentLoaded', function() {
  console.log("DOM carregado!");
  // Adicionar classe de carregamento para controle CSS
  document.documentElement.classList.add('loading');
  
  // Esconder todas as abas inicialmente
  document.querySelectorAll('.aba').forEach(aba => {
    aba.style.display = 'none';
    aba.style.opacity = '0';
  });
  
  // Garantir que botões de navegação tenham handlers corretos
  verificarBotoesNavegacao();
  
  // Inicializar após um pequeno delay para garantir que o CSS foi aplicado
  setTimeout(() => {
    document.documentElement.classList.remove('loading');
    inicializarApp();
  }, 50);
});

// ===== VERIFICAR E CORRIGIR BOTÕES DE NAVEGAÇÃO =====
function verificarBotoesNavegacao() {
  console.log("Verificando botões de navegação...");
  document.querySelectorAll('.sidebar-nav button').forEach(btn => {
    const id = btn.id;
    if (id && id.startsWith('btn-')) {
      const abaId = id.replace('btn-', '');
      // Garantir que o botão tenha o handler correto
      btn.onclick = function() { mostrarAba(abaId); };
      console.log(`Handler configurado para ${id} -> ${abaId}`);
    }
  });
}

// ===== FUNÇÃO DE DEBUG PARA VERIFICAR ESTADO DAS ABAS =====
function debugAbaStatus() {
  console.group("==== STATUS DAS ABAS ====");
  document.querySelectorAll('.aba').forEach(aba => {
    console.log(
      `%c${aba.id}%c: display=%c${aba.style.display}%c, opacity=%c${aba.style.opacity}%c, transform=%c${aba.style.transform}%c, classes=%c${aba.className}%c, data-loaded=%c${aba.getAttribute('data-loaded')}`, 
      'color: blue; font-weight: bold', 
      'color: black', 
      'color: green', 
      'color: black',
      'color: purple',
      'color: black',
      'color: brown',
      'color: black',
      'color: orange',
      'color: black',
      'color: red'
    );
  });
  console.groupEnd();
  
  console.group("==== BOTÕES DE NAVEGAÇÃO ====");
  document.querySelectorAll('.sidebar-nav button').forEach(btn => {
    const isActive = btn.classList.contains('active');
    console.log(
      `%c${btn.id}%c: %c${isActive ? 'ATIVO' : 'inativo'}`, 
      'color: blue', 
      'color: black', 
      isActive ? 'background: green; color: white; padding: 2px 5px; border-radius: 3px' : 'color: gray'
    );
  });
  console.groupEnd();
  
  console.group("==== DADOS DE NAVEGAÇÃO ====");
  console.log(`Aba salva: %c${localStorage.getItem('aba')}`, 'color: blue; font-weight: bold');
  console.groupEnd();
  
  // Adicionar verificação de event listeners para botões de navegação
  console.group("==== VERIFICAÇÃO DE CLICK HANDLERS ====");
  document.querySelectorAll('.sidebar-nav button').forEach(btn => {
    const id = btn.id;
    const abaId = id.replace('btn-', '');
    const hasCorrectHandler = btn.onclick && btn.onclick.toString().includes(`mostrarAba('${abaId}'`);
    console.log(
      `%c${id}%c: Handler para %c${abaId}%c ${hasCorrectHandler ? '✅' : '❌'}`, 
      'color: blue', 
      'color: black', 
      'color: purple; font-weight: bold',
      'color: black'
    );
  });
  console.groupEnd();
  
  // Tentar diagnosticar qualquer problema óbvio
  console.group("==== DIAGNÓSTICO ====");
  const problemas = [];
  
  // Verifica se há múltiplas abas visíveis
  const abasVisiveis = Array.from(document.querySelectorAll('.aba')).filter(
    aba => aba.style.display === 'block' || aba.style.display === ''
  );
  if (abasVisiveis.length > 1) {
    problemas.push(`❌ Múltiplas abas visíveis: ${abasVisiveis.map(a => a.id).join(', ')}`);
  } else if (abasVisiveis.length === 0) {
    problemas.push('❌ Nenhuma aba visível!');
  }
  
  // Verifica se há múltiplos botões ativos
  const botoesAtivos = document.querySelectorAll('.sidebar-nav button.active');
  if (botoesAtivos.length > 1) {
    problemas.push(`❌ Múltiplos botões ativos: ${Array.from(botoesAtivos).map(b => b.id).join(', ')}`);
  } else if (botoesAtivos.length === 0) {
    problemas.push('❌ Nenhum botão ativo!');
  }
  
  // Verifica se a aba salva no localStorage corresponde à aba visível
  const abaSalva = localStorage.getItem('aba');
  if (abaSalva && abasVisiveis.length === 1 && abasVisiveis[0].id !== abaSalva) {
    problemas.push(`❌ Aba visível (${abasVisiveis[0].id}) diferente da aba salva (${abaSalva})`);
  }
  
  if (problemas.length > 0) {
    problemas.forEach(p => console.error(p));
  } else {
    console.log('✅ Nenhum problema óbvio detectado');
  }
  console.groupEnd();
}

// Adiciona função ao objeto window para uso no console
window.debugAbaStatus = debugAbaStatus;

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
  if (adicionarTarefa() === true) fecharModalTarefa();
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
  if (adicionarColheita() === true) fecharModalColheita();
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