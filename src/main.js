// ===== FUNÇÃO PARA TROCAR ABAS =====
function mostrarAba(abaId) {
  document.querySelectorAll('.aba').forEach(aba => {
    aba.style.display = 'none';
  });

  const abaSelecionada = document.getElementById(abaId);
  if (abaSelecionada) abaSelecionada.style.display = 'block';

  document.querySelectorAll('.menu-superior button').forEach(btn => {
    btn.classList.remove('active');
  });

  const btnId = 'btn-' + abaId;
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.add('active');

  localStorage.setItem('aba', abaId);
}

// ===== INICIALIZAR O APLICATIVO =====
function inicializarApp() {
  const abaInicial = localStorage.getItem('aba') || 'aplicacoes';
  mostrarAba(abaInicial);

  if (localStorage.getItem('tema') === 'claro') {
    document.body.classList.add('claro');
  }

  // Eventos customizados para garantir que as funções carreguem corretamente
  document.addEventListener('dadosCarregados', () => {
    if (typeof carregarAplicacoes === "function") carregarAplicacoes();
    if (typeof carregarTarefas === "function") carregarTarefas();
    if (typeof carregarFinanceiro === "function") carregarFinanceiro();
    if (typeof carregarColheita === "function") carregarColheita();
    if (typeof carregarValorLata === "function") carregarValorLata();
    if (typeof carregarAnoSafra === "function") carregarAnoSafra();
    if (typeof carregarSafrasDisponiveis === "function") carregarSafrasDisponiveis();
  });

  // Disparar o evento após garantir que o DOM está pronto
  document.dispatchEvent(new Event('dadosCarregados'));
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

['tarefas','aplicacoes','gastos','colheita'].forEach(nome => {
  Object.defineProperty(window, nome, {
    set(v) { this['__'+nome]=v; if(typeof atualizarResumoInicio==='function') atualizarResumoInicio(); },
    get() { return this['__'+nome]||[]; }
  });
});
