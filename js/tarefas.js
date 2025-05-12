// ===== IMPORTAÇÕES =====
import { db, auth } from './firebase-config.js';
import { saveDataOffline, loadDataOffline } from './offline-db.js';

// ===== VARIÁVEIS GLOBAIS =====
let tarefas = [];
let tarefasFeitas = [];
let indiceEdicaoTarefa = null;

// ===== CARREGAR TAREFAS =====
async function carregarTarefas() {
  try {
    if (navigator.onLine) {
      db.ref('Tarefas').on('value', (snapshot) => {
        const dados = snapshot.val() || [];
        tarefas = dados.filter(t => !t.feita);
        tarefasFeitas = dados.filter(t => t.feita);
        atualizarTarefas();
        
        // Salvar offline
        if (dados.length > 0) {
          saveDataOffline('tarefas', dados).catch(console.error);
        }
      });
    } else {
      // Modo offline
      const dados = await loadDataOffline('tarefas');
      tarefas = dados.filter(t => !t.feita) || [];
      tarefasFeitas = dados.filter(t => t.feita) || [];
      atualizarTarefas();
      mostrarNotificacao('Você está visualizando dados offline das tarefas');
    }
  } catch (error) {
    console.error('Erro ao carregar tarefas:', error);
    mostrarNotificacao('Erro ao carregar tarefas', 'error');
  }
}

// ===== ADICIONAR OU EDITAR TAREFA =====
async function adicionarTarefa() {
  if (!auth.currentUser) {
    mostrarNotificacao('Você precisa estar logado para adicionar tarefas', 'error');
    return;
  }

  const dataTarefa = document.getElementById('dataTarefa');
  const descricaoTarefa = document.getElementById('descricaoTarefa');
  const prioridadeTarefa = document.getElementById('prioridadeTarefa');
  const setorTarefa = document.getElementById('setorTarefa');
  const eAplicacaoCheckbox = document.getElementById('eAplicacaoCheckbox');
  const dosagemAplicacao = document.getElementById('dosagemAplicacao');
  const tipoAplicacao = document.getElementById('tipoAplicacao');

  if (!dataTarefa || !descricaoTarefa || !prioridadeTarefa || !setorTarefa) {
    mostrarNotificacao("Preencha todos os campos corretamente.", 'error');
    return;
  }

  const novaTarefa = {
    data: dataTarefa.value,
    descricao: descricaoTarefa.value.trim(),
    prioridade: prioridadeTarefa.value,
    setor: setorTarefa.value,
    feita: false,
    eAplicacao: eAplicacaoCheckbox.checked,
    dosagem: eAplicacaoCheckbox.checked ? dosagemAplicacao.value.trim() : '',
    tipo: eAplicacaoCheckbox.checked ? tipoAplicacao.value : '',
    usuario: auth.currentUser.uid,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  };

  if (!novaTarefa.data || !novaTarefa.descricao) {
    mostrarNotificacao("Preencha todos os campos obrigatórios!", 'error');
    return;
  }

  try {
    if (indiceEdicaoTarefa !== null) {
      // Edição de tarefa existente
      tarefas[indiceEdicaoTarefa] = novaTarefa;
      indiceEdicaoTarefa = null;
      document.getElementById("btnCancelarEdicaoTarefa").style.display = "none";
    } else {
      // Adicionar nova tarefa
      tarefas.push(novaTarefa);
    }

    const todasTarefas = [...tarefas, ...tarefasFeitas];
    
    if (navigator.onLine) {
      await db.ref('Tarefas').set(todasTarefas);
    } else {
      await saveDataOffline('tarefas', todasTarefas);
      mostrarNotificacao('Tarefa salva localmente. Será sincronizada quando online.', 'info');
    }

    atualizarTarefas();
    limparCamposTarefa();
  } catch (error) {
    console.error('Erro ao salvar tarefa:', error);
    mostrarNotificacao('Erro ao salvar tarefa: ' + error.message, 'error');
  }
}

// ===== MARCAR TAREFA COMO CONCLUÍDA =====
async function marcarTarefaComoConcluida(index, concluida = true) {
  try {
    const tarefa = tarefas[index];
    if (!tarefa) return;

    tarefa.feita = concluida;
    tarefa.dataConclusao = concluida ? new Date().toISOString().split('T')[0] : null;

    if (concluida) {
      tarefasFeitas.push(tarefa);
      tarefas.splice(index, 1);
      
      // Disparar evento personalizado
      document.dispatchEvent(new CustomEvent('tarefaConcluida', {
        detail: {
          descricao: tarefa.descricao,
          data: tarefa.data,
          setor: tarefa.setor
        }
      }));
    } else {
      tarefas.push(tarefa);
      tarefasFeitas = tarefasFeitas.filter(t => t !== tarefa);
    }

    const todasTarefas = [...tarefas, ...tarefasFeitas];
    
    if (navigator.onLine) {
      await db.ref('Tarefas').set(todasTarefas);
    } else {
      await saveDataOffline('tarefas', todasTarefas);
      mostrarNotificacao('Alteração salva localmente. Será sincronizada quando online.', 'info');
    }

    atualizarTarefas();
  } catch (error) {
    console.error('Erro ao atualizar tarefa:', error);
    mostrarNotificacao('Erro ao atualizar tarefa: ' + error.message, 'error');
  }
}

// ===== EDITAR TAREFA =====
function editarTarefa(index) {
  if (!auth.currentUser) {
    mostrarNotificacao('Você precisa estar logado para editar tarefas', 'error');
    return;
  }

  const t = tarefas[index];
  if (!t) return;

  document.getElementById('dataTarefa').value = t.data;
  document.getElementById('descricaoTarefa').value = t.descricao;
  document.getElementById('prioridadeTarefa').value = t.prioridade;
  document.getElementById('setorTarefa').value = t.setor;
  document.getElementById('eAplicacaoCheckbox').checked = t.eAplicacao;
  document.getElementById('dosagemAplicacao').value = t.dosagem || '';
  document.getElementById('tipoAplicacao').value = t.tipo || 'Adubo';

  indiceEdicaoTarefa = index;
  document.getElementById("btnCancelarEdicaoTarefa").style.display = "inline-block";
  mostrarCamposAplicacao();
}

// ===== CANCELAR EDIÇÃO =====
function cancelarEdicaoTarefa() {
  limparCamposTarefa();
  indiceEdicaoTarefa = null;
  document.getElementById("btnCancelarEdicaoTarefa").style.display = "none";
}

// ===== LIMPAR CAMPOS DE TAREFA =====
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

// ===== ATUALIZAR LISTA DE TAREFAS =====
function atualizarTarefas() {
  const lista = document.getElementById('listaTarefas');
  const listaFeitas = document.getElementById('listaTarefasFeitas');
  
  lista.innerHTML = '';
  listaFeitas.innerHTML = '';

  // Ordenar tarefas por prioridade e data
  tarefas.sort((a, b) => {
    const prioridades = { 'Alta': 1, 'Média': 2, 'Baixa': 3 };
    return prioridades[a.prioridade] - prioridades[b.prioridade] || 
           new Date(a.data) - new Date(b.data);
  });

  // Ordenar tarefas feitas por data de conclusão (mais recente primeiro)
  tarefasFeitas.sort((a, b) => new Date(b.dataConclusao || b.data) - new Date(a.dataConclusao || a.data));

  // Tarefas pendentes
  tarefas.forEach((t, index) => {
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
      <span>
        <strong>${t.prioridade}</strong> - ${t.data} - ${t.descricao} - ${t.setor}
        ${t.eAplicacao ? ` (${t.tipo}: ${t.dosagem})` : ''}
      </span>
      <div class="botoes-tarefa">
        <button class="botao-circular verde" onclick="marcarTarefaComoConcluida(${index})">
          <i class="fas fa-check"></i>
        </button>
        <button class="botao-circular azul" onclick="editarTarefa(${index})">
          <i class="fas fa-edit"></i>
        </button>
        <button class="botao-circular vermelho" onclick="excluirTarefa(${index})">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    lista.appendChild(item);
  });

  // Tarefas concluídas
  tarefasFeitas.forEach((t, index) => {
    const item = document.createElement('div');
    item.className = 'item concluida';
    item.innerHTML = `
      <span>
        <s>${t.prioridade} - ${t.data} - ${t.descricao} - ${t.setor}
        ${t.eAplicacao ? ` (${t.tipo}: ${t.dosagem})` : ''}</s>
        ${t.dataConclusao ? `<br><small>Concluída em: ${t.dataConclusao}</small>` : ''}
      </span>
      <div class="botoes-tarefa">
        <button class="botao-circular amarelo" onclick="marcarTarefaComoConcluida(${index}, false)">
          <i class="fas fa-undo"></i>
        </button>
        <button class="botao-circular vermelho" onclick="excluirTarefa(${index}, true)">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    listaFeitas.appendChild(item);
  });
}

// ===== EXCLUIR TAREFA =====
async function excluirTarefa(index, isFeita = false) {
  if (!confirm("Deseja excluir esta tarefa?")) return;
  
  try {
    if (isFeita) {
      tarefasFeitas.splice(index, 1);
    } else {
      tarefas.splice(index, 1);
    }

    const todasTarefas = [...tarefas, ...tarefasFeitas];
    
    if (navigator.onLine) {
      await db.ref('Tarefas').set(todasTarefas);
    } else {
      await saveDataOffline('tarefas', todasTarefas);
      mostrarNotificacao('Exclusão salva localmente. Será sincronizada quando online.', 'info');
    }

    atualizarTarefas();
  } catch (error) {
    console.error('Erro ao excluir tarefa:', error);
    mostrarNotificacao('Erro ao excluir tarefa: ' + error.message, 'error');
  }
}

// ===== MOSTRAR CAMPOS DE APLICAÇÃO =====
function mostrarCamposAplicacao() {
  const checkbox = document.getElementById('eAplicacaoCheckbox');
  const campos = document.getElementById('camposAplicacao');
  campos.style.display = checkbox.checked ? 'block' : 'none';
}

// ===== INICIALIZAR TAREFAS =====
document.addEventListener("dadosCarregados", carregarTarefas);

// Exportar funções para uso no HTML
window.adicionarTarefa = adicionarTarefa;
window.editarTarefa = editarTarefa;
window.excluirTarefa = excluirTarefa;
window.cancelarEdicaoTarefa = cancelarEdicaoTarefa;
window.marcarTarefaComoConcluida = marcarTarefaComoConcluida;
window.mostrarCamposAplicacao = mostrarCamposAplicacao;
