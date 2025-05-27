// ====== VARIÁVEIS GLOBAIS ======
window.tarefas = window.tarefas || [];
let indiceEdicaoTarefa = null; // Agora está corretamente definida

// ====== ADICIONAR OU SALVAR EDIÇÃO DE TAREFA ======
function adicionarTarefa() {
  const dataTarefa = document.getElementById('dataTarefa');
  const descricaoTarefa = document.getElementById('descricaoTarefa');
  const prioridadeTarefa = document.getElementById('prioridadeTarefa');
  const setorTarefa = document.getElementById('setorTarefa');
  const eAplicacaoCheckbox = document.getElementById('eAplicacaoCheckbox');
  const dosagemAplicacao = document.getElementById('dosagemAplicacao');
  const tipoAplicacao = document.getElementById('tipoAplicacao');

  if (!dataTarefa || !descricaoTarefa || !prioridadeTarefa || !setorTarefa) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  const nova = {
    data: dataTarefa.value,
    descricao: descricaoTarefa.value.trim(),
    prioridade: prioridadeTarefa.value,
    setor: setorTarefa.value,
    feita: false,
    eAplicacao: eAplicacaoCheckbox.checked,
    dosagem: eAplicacaoCheckbox.checked ? dosagemAplicacao.value.trim() : '',
    tipo: eAplicacaoCheckbox.checked ? tipoAplicacao.value : ''
  };

  if (!nova.data || !nova.descricao) {
    alert("Preencha todos os campos obrigatórios!");
    return;
  }

  if (indiceEdicaoTarefa !== null) {
    // Edição de tarefa existente
    tarefas[indiceEdicaoTarefa] = nova;
    indiceEdicaoTarefa = null;
    var btnCancelar = document.getElementById("btnCancelarEdicaoTarefa");
    if (btnCancelar) btnCancelar.style.display = "none";
  } else {
    // Adicionar nova tarefa
    tarefas.push(nova);
  }

  db.ref('Tarefas').set(tarefas);
  atualizarTarefas();
  limparCamposTarefa();
}

// ====== EDITAR TAREFA ======
function editarTarefa(index) {
  const t = tarefas[index];
  if (!t) return;

  abrirModalTarefa(true);

  document.getElementById('dataTarefa').value = t.data;
  document.getElementById('descricaoTarefa').value = t.descricao;
  document.getElementById('prioridadeTarefa').value = t.prioridade;
  document.getElementById('setorTarefa').value = t.setor;
  document.getElementById('eAplicacaoCheckbox').checked = t.eAplicacao;
  document.getElementById('dosagemAplicacao').value = t.dosagem || '';
  document.getElementById('tipoAplicacao').value = t.tipo || 'Adubo';
  mostrarCamposAplicacao();

  indiceEdicaoTarefa = index;
  var btnCancelar = document.getElementById("btnCancelarEdicaoTarefa");
  if (btnCancelar) btnCancelar.style.display = "inline-block";
  var btnSalvar = document.getElementById('btnSalvarTarefa');
  if (btnSalvar) btnSalvar.innerText = 'Salvar Edição';
}

// ====== CANCELAR EDIÇÃO ======
function cancelarEdicaoTarefa() {
  limparCamposTarefa();
  indiceEdicaoTarefa = null;
  var btnCancelar = document.getElementById("btnCancelarEdicaoTarefa");
  if (btnCancelar) btnCancelar.style.display = "none";
}

// ====== LIMPAR CAMPOS DE TAREFA ======
function limparCamposTarefa() {
  document.getElementById('dataTarefa').value = '';
  document.getElementById('descricaoTarefa').value = '';
  document.getElementById('prioridadeTarefa').value = 'Alta';
  document.getElementById('setorTarefa').value = 'Setor 01';
  document.getElementById('eAplicacaoCheckbox').checked = false;
  document.getElementById('dosagemAplicacao').value = '';
  document.getElementById('tipoAplicacao').value = 'Adubo';
  mostrarCamposAplicacao();
}

// ====== FORMATAÇÃO DE VALOR E DATA NO PADRÃO BRASILEIRO ======
function formatarValorBR(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatarDataBR(dataISO) {
  if (!dataISO) return '';
  const [ano, mes, dia] = dataISO.split('-');
  if (!ano || !mes || !dia) return dataISO;
  return `${dia}/${mes}/${ano}`;
}

// ====== ATUALIZAR LISTA DE TAREFAS ======
function atualizarTarefas() {
  var listaAFazer = document.getElementById('listaTarefas');
  var listaFeitas = document.getElementById('listaTarefasFeitas');
  if (listaAFazer) listaAFazer.innerHTML = '';
  if (listaFeitas) listaFeitas.innerHTML = '';

  (window.tarefas || []).forEach(function(t, index) {
    const item = document.createElement('div'); // Correção: criar o elemento item
    const prioridadeCor = t.prioridade === 'Alta' ? '#f44336' : t.prioridade === 'Média' ? '#ff9800' : '#4caf50';
    const feitaClass = t.feita ? 'feita' : '';
    item.className = `item item-tarefa ${feitaClass}`;
    item.setAttribute('data-prioridade', t.prioridade);
    item.innerHTML = `
      <div class="tarefa-info">
        <div class="tarefa-topo">
          <span class="tarefa-data">${formatarDataBR(t.data)}</span>
          <span class="tarefa-prioridade" style="color:${prioridadeCor};">${t.prioridade}</span>
        </div>
        <div class="tarefa-desc">${t.descricao}</div>
        <div class="tarefa-setor">${t.setor ? `<i class='fas fa-map-marker-alt'></i> ${t.setor}` : ''}</div>
      </div>
      <div class="opcoes-wrapper">
        <button class="seta-menu-opcoes-padrao" aria-label="Abrir opções">&#8250;</button>
        <ul class="menu-opcoes-padrao-lista" style="display:none;">
          ${t.feita
            ? `<li class='opcao-menu-padrao' data-acao='estornar'>Estornar</li><li class='opcao-menu-padrao' data-acao='deletar'>Deletar</li>`
            : `<li class='opcao-menu-padrao' data-acao='editar'>Editar</li><li class='opcao-menu-padrao' data-acao='deletar'>Deletar</li>`}
        </ul>
      </div>
    `;
    const opcoesWrapper = item.querySelector('.opcoes-wrapper');
    const seta = opcoesWrapper.querySelector('.seta-menu-opcoes-padrao');
    const menu = opcoesWrapper.querySelector('.menu-opcoes-padrao-lista');
    if (seta && menu) {
      seta.onclick = (e) => {
        e.stopPropagation();
        document.querySelectorAll('.menu-opcoes-padrao-lista').forEach(m => {
          if (m !== menu) {
            m.classList.remove('aberta');
            m.style.display = '';
          }
        });
        const aberto = menu.classList.contains('aberta');
        if (aberto) {
          menu.classList.remove('aberta');
          menu.style.display = '';
          seta.setAttribute('aria-expanded', 'false');
        } else {
          menu.classList.add('aberta');
          menu.style.display = 'block';
          seta.setAttribute('aria-expanded', 'true');
        }
      };
      menu.querySelectorAll('.opcao-menu-padrao').forEach(opcao => {
        opcao.onclick = (e) => {
          e.stopPropagation();
          menu.classList.remove('aberta');
          menu.style.display = '';
          seta.setAttribute('aria-expanded', 'false');
          if (opcao.dataset.acao === 'editar') editarTarefa(index);
          if (opcao.dataset.acao === 'deletar') excluirTarefa(index);
          if (opcao.dataset.acao === 'estornar') {
            tarefas[index].feita = false;
            db.ref('Tarefas').set(tarefas);
            atualizarTarefas();
          }
        };
      });
      document.addEventListener('click', function fecharMenu(e) {
        if (!item.contains(e.target)) {
          menu.classList.remove('aberta');
          menu.style.display = '';
          seta.setAttribute('aria-expanded', 'false');
        }
      }, { once: true });
    }
    // Clique para marcar como feita (apenas se não for feita)
    if (!t.feita) {
      item.addEventListener('click', function(e) {
        if (e.target.closest('.seta-menu-opcoes-padrao') || e.target.closest('.menu-opcoes-padrao-lista')) return;
        tarefas[index].feita = true;
        db.ref('Tarefas').set(tarefas);
        atualizarTarefas();
      });
    }
    if (t.feita) item.classList.add('feita');
    if (!t.feita && listaAFazer) listaAFazer.appendChild(item);
    if (t.feita && listaFeitas) listaFeitas.appendChild(item);
  });
}

// ====== EXCLUIR TAREFA ======
function excluirTarefa(index) {
  if (!confirm("Deseja excluir esta tarefa?")) return;
  tarefas.splice(index, 1);
  db.ref('Tarefas').set(tarefas);
  atualizarTarefas();
}

// ====== INICIALIZAR TAREFAS ======
// Removido para evitar loop infinito:
// document.addEventListener("dadosCarregados", carregarTarefas);

// Atualiza selects de setor ao carregar setores dinâmicos
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function() {
    if (typeof atualizarSelectsSetor === 'function') atualizarSelectsSetor();
  });
}

// ====== MOSTRAR CAMPOS DE APLICAÇÃO ======
function mostrarCamposAplicacao() {
  const checkbox = document.getElementById('eAplicacaoCheckbox');
  const campos = document.getElementById('camposAplicacao');
  campos.style.display = checkbox.checked ? 'block' : 'none';
}

// ====== CARREGAR TAREFAS ======
function carregarTarefas() {
  db.ref('Tarefas').on('value', (snapshot) => {
    const dados = snapshot.exists() ? Object.values(snapshot.val()) : [];
    // Só atualiza window.tarefas se mudou
    if (JSON.stringify(window.tarefas) !== JSON.stringify(dados)) {
      window.tarefas = dados;
    }
    atualizarTarefas();
    // Controle de carregamento de dados principais para notificações automáticas
    window.__dadosCarregados = window.__dadosCarregados || { tarefas: false, gastos: false };
    window.__dadosCarregados.tarefas = true;
    if (window.__dadosCarregados.gastos) {
      document.dispatchEvent(new Event('dadosCarregados'));
      window.__dadosCarregados = { tarefas: false, gastos: false };
    }
  });
}

// Controle de carregamento de dados principais para notificações automáticas
window.__dadosCarregados = window.__dadosCarregados || { tarefas: false, gastos: false };

function notificarSeAmbosCarregados() {
  if (window.__dadosCarregados.tarefas && window.__dadosCarregados.gastos) {
    document.dispatchEvent(new Event('dadosCarregados'));
    // Evita disparar mais de uma vez
    window.__dadosCarregados = { tarefas: false, gastos: false };
  }
}
// Ao final do carregamento real das tarefas:
if (Array.isArray(window.tarefas) && window.tarefas.length > 0) {
  window.__dadosCarregados.tarefas = true;
  notificarSeAmbosCarregados();
}
// Ao final do carregamento real dos gastos:
if (Array.isArray(window.gastos) && window.gastos.length > 0) {
  window.__dadosCarregados.gastos = true;
  notificarSeAmbosCarregados();
}
