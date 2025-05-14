import { ref, onValue, set, push, remove, update } from "firebase/database";
import { database } from "./js/firebase-config.js"; // ajuste o caminho conforme necessário

// tarefas.js

document.addEventListener('DOMContentLoaded', () => {
  // Elementos do formulário
  const form = document.getElementById('formTarefa');
  const idEdit = document.getElementById('tarefaIdEdit');
  const dataTarefa = document.getElementById('dataTarefa');
  const descricaoTarefa = document.getElementById('descricaoTarefa');
  const prioridadeTarefa = document.getElementById('prioridadeTarefa');
  const setorTarefa = document.getElementById('setorTarefa');
  const eAplicacaoCheckbox = document.getElementById('eAplicacaoTarefaCheckbox');
  const camposAplicacao = document.getElementById('camposAplicacaoTarefa');
  const produtoAplicacao = document.getElementById('produtoAplicacaoTarefa');
  const dosagemAplicacao = document.getElementById('dosagemAplicacaoTarefa');
  const tipoAplicacao = document.getElementById('tipoAplicacaoTarefa');
  const btnSalvar = document.getElementById('btnSalvarTarefa');
  const btnCancelar = document.getElementById('btnCancelarEdicaoTarefa');
  const listaPendentes = document.getElementById('listaTarefasPendentes');
  const listaConcluidas = document.getElementById('listaTarefasConcluidas');
  const filtroPendentes = document.getElementById('filtroTarefasPendentes');
  const filtroConcluidas = document.getElementById('filtroTarefasConcluidas');
  const sugestoesSetor = document.getElementById('sugestoesSetor');
  const sugestoesProduto = document.getElementById('sugestoesProdutoApp');

  // Estado
  let tarefasCache = [];
  let editando = false;
  let loading = false;

  // --- Funções auxiliares ---

  function limparForm() {
    form.reset();
    idEdit.value = '';
    editando = false;
    btnSalvar.textContent = 'Salvar Tarefa';
    btnCancelar.classList.add('hidden');
    camposAplicacao.classList.add('hidden');
    limparErros();
    dataTarefa.focus();
  }

  function limparErros() {
    form.querySelectorAll('.erro-campo').forEach(el => el.classList.remove('erro-campo'));
    form.querySelectorAll('.msg-erro').forEach(el => el.remove());
  }

  function mostrarErroCampo(input, msg) {
    input.classList.add('erro-campo');
    let msgEl = document.createElement('div');
    msgEl.className = 'msg-erro';
    msgEl.setAttribute('aria-live', 'polite');
    msgEl.style.color = '#f44336';
    msgEl.style.fontSize = '0.9em';
    msgEl.textContent = msg;
    input.parentNode.insertBefore(msgEl, input.nextSibling);
    input.focus();
  }

  function validarDados(dados) {
    limparErros();
    let valido = true;
    if (!dados.data) {
      mostrarErroCampo(dataTarefa, 'Informe a data.');
      valido = false;
    }
    if (!dados.descricao) {
      mostrarErroCampo(descricaoTarefa, 'Informe a descrição.');
      valido = false;
    }
    if (dados.eAplicacao) {
      if (!dados.produtoAplicacao) {
        mostrarErroCampo(produtoAplicacao, 'Informe o produto.');
        valido = false;
      }
      if (!dados.dosagemAplicacao) {
        mostrarErroCampo(dosagemAplicacao, 'Informe a dosagem.');
        valido = false;
      }
    }
    return valido;
  }

  function atualizarSugestoes() {
    const setoresSet = new Set();
    const produtosSet = new Set();
    tarefasCache.forEach(tarefa => {
      if (tarefa.setor) setoresSet.add(tarefa.setor);
      if (tarefa.eAplicacao && tarefa.produtoAplicacao) produtosSet.add(tarefa.produtoAplicacao);
    });
    sugestoesSetor.innerHTML = '';
    setoresSet.forEach(setor => {
      sugestoesSetor.innerHTML += `<option value="${setor}"></option>`;
    });
    sugestoesProduto.innerHTML = '';
    produtosSet.forEach(prod => {
      sugestoesProduto.innerHTML += `<option value="${prod}"></option>`;
    });
  }

  function renderizarListas() {
    renderizarLista(listaPendentes, false, filtroPendentes.value);
    renderizarLista(listaConcluidas, true, filtroConcluidas.value);
  }

  function renderizarLista(container, feita, filtroTexto = '') {
    container.innerHTML = '';
    let encontrou = false;
    const filtroLower = filtroTexto.trim().toLowerCase();

    tarefasCache
      .filter(tarefa => tarefa.feita === feita)
      .filter(tarefa => {
        if (!filtroLower) return true;
        const texto = `${tarefa.data} ${tarefa.descricao} ${tarefa.setor} ${tarefa.produtoAplicacao || ''} ${tarefa.dosagemAplicacao || ''}`.toLowerCase();
        return texto.includes(filtroLower);
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .forEach(tarefa => {
        encontrou = true;
        const div = document.createElement('div');
        div.className = 'item' + (tarefa.feita ? ' tarefa-feita' : '');
        let detalhesAplicacao = '';
        if (tarefa.eAplicacao) {
          detalhesAplicacao = `<br><em>Aplicação: ${tarefa.produtoAplicacao || ''} (${tarefa.tipoAplicacao || ''}) - Dosagem: ${tarefa.dosagemAplicacao || ''}</em>`;
        }
        div.innerHTML = `
          <span>
            <strong>${tarefa.descricao}</strong> (${tarefa.prioridade})<br>
            Data: ${tarefa.data} | Setor: ${tarefa.setor || '-'}
            ${detalhesAplicacao}
          </span>
          <div>
            <button class="botao-circular" aria-label="${tarefa.feita ? 'Marcar como pendente' : 'Marcar como feita'}" title="${tarefa.feita ? 'Marcar como pendente' : 'Marcar como feita'}" data-id="${tarefa._id}" data-action="toggle"><i class="fas fa-${tarefa.feita ? 'undo' : 'check'}"></i></button>
            <button class="botao-circular azul" aria-label="Editar tarefa" title="Editar" data-id="${tarefa._id}" data-action="edit"><i class="fas fa-edit"></i></button>
            <button class="botao-circular vermelho" aria-label="Remover tarefa" title="Remover" data-id="${tarefa._id}" data-action="remove"><i class="fas fa-trash"></i></button>
          </div>
        `;
        container.appendChild(div);
      });

    if (!encontrou) {
      container.innerHTML = `<p style="text-align:center;color:#888;">Nenhuma tarefa ${feita ? 'concluída' : 'pendente'} encontrada.</p>`;
    }
  }

  // --- CRUD ---

  function carregarTarefas() {
    loading = true;
    listaPendentes.innerHTML = '<div class="loading">Carregando...</div>';
    listaConcluidas.innerHTML = '<div class="loading">Carregando...</div>';
    ref(database, 'tarefas').orderByChild('timestamp').on('value', snap => {
      tarefasCache = [];
      snap.forEach(child => {
        const tarefa = child.val();
        tarefa._id = child.key;
        tarefasCache.push(tarefa);
      });
      atualizarSugestoes();
      renderizarListas();
      loading = false;
    });
  }

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    if (loading) return;
    btnSalvar.disabled = true;
    const dados = {
      data: dataTarefa.value,
      descricao: descricaoTarefa.value.trim(),
      prioridade: prioridadeTarefa.value,
      setor: setorTarefa.value.trim(),
      eAplicacao: eAplicacaoCheckbox.checked,
      feita: false,
      timestamp: Date.now()
    };
    if (dados.eAplicacao) {
      dados.produtoAplicacao = produtoAplicacao.value.trim();
      dados.dosagemAplicacao = dosagemAplicacao.value.trim();
      dados.tipoAplicacao = tipoAplicacao.value;
    }
    if (!validarDados(dados)) {
      btnSalvar.disabled = false;
      return;
    }

    if (editando && idEdit.value) {
      ref(database, 'tarefas/' + idEdit.value).set(dados)
        .then(() => {
          mostrarToast('Tarefa atualizada!', 'sucesso');
          limparForm();
          btnSalvar.disabled = false;
        })
        .catch(() => {
          mostrarToast('Erro ao atualizar tarefa!', 'erro');
          btnSalvar.disabled = false;
        });
    } else {
      ref(database, 'tarefas').push(dados)
        .then(() => {
          mostrarToast('Tarefa salva!', 'sucesso');
          limparForm();
          btnSalvar.disabled = false;
        })
        .catch(() => {
          mostrarToast('Erro ao salvar tarefa!', 'erro');
          btnSalvar.disabled = false;
        });
    }
  });

  btnCancelar.addEventListener('click', limparForm);

  // Mostrar/ocultar campos de aplicação
  eAplicacaoCheckbox.addEventListener('change', () => {
    if (eAplicacaoCheckbox.checked) {
      camposAplicacao.classList.remove('hidden');
      produtoAplicacao.focus();
    } else {
      camposAplicacao.classList.add('hidden');
    }
  });

  // Filtros
  filtroPendentes.addEventListener('input', () => renderizarLista(listaPendentes, false, filtroPendentes.value));
  filtroConcluidas.addEventListener('input', () => renderizarLista(listaConcluidas, true, filtroConcluidas.value));

  // Delegação de eventos para ações nas listas
  [listaPendentes, listaConcluidas].forEach(container => {
    container.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      if (action === 'edit') {
        const tarefa = tarefasCache.find(t => t._id === id);
        if (tarefa) {
          dataTarefa.value = tarefa.data;
          descricaoTarefa.value = tarefa.descricao;
          prioridadeTarefa.value = tarefa.prioridade;
          setorTarefa.value = tarefa.setor;
          eAplicacaoCheckbox.checked = !!tarefa.eAplicacao;
          if (tarefa.eAplicacao) {
            camposAplicacao.classList.remove('hidden');
            produtoAplicacao.value = tarefa.produtoAplicacao || '';
            dosagemAplicacao.value = tarefa.dosagemAplicacao || '';
            tipoAplicacao.value = tarefa.tipoAplicacao || 'Adubo';
          } else {
            camposAplicacao.classList.add('hidden');
          }
          idEdit.value = id;
          editando = true;
          btnSalvar.textContent = 'Atualizar Tarefa';
          btnCancelar.classList.remove('hidden');
          dataTarefa.focus();
          mostrarToast('Editando tarefa...', 'info');
        }
      } else if (action === 'remove') {
        mostrarModalConfirmacao('Deseja remover esta tarefa?', () => {
          ref(database, 'tarefas/' + id).remove()
            .then(() => {
              mostrarToast('Tarefa removida!', 'sucesso');
              if (idEdit.value === id) limparForm();
            })
            .catch(() => {
              mostrarToast('Erro ao remover tarefa!', 'erro');
            });
        });
      } else if (action === 'toggle') {
        const tarefa = tarefasCache.find(t => t._id === id);
        if (tarefa) {
          ref(database, 'tarefas/' + id).update({ feita: !tarefa.feita })
            .then(() => {
              mostrarToast(tarefa.feita ? 'Tarefa marcada como pendente.' : 'Tarefa concluída!', 'sucesso');
            })
            .catch(() => {
              mostrarToast('Erro ao atualizar tarefa!', 'erro');
            });
        }
      }
    });
    // Acessibilidade: permite remover/editar/toggle com Enter/Espaço
    container.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.tagName === 'BUTTON') {
        e.preventDefault();
        e.target.click();
      }
    });
  });

  // Modal de confirmação (igual ao do aplicacao.js)
  function mostrarModalConfirmacao(msg, onConfirm) {
    let modal = document.getElementById('modal-confirmacao');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-confirmacao';
      modal.innerHTML = `
        <div class="modal-bg"></div>
        <div class="modal-box" role="dialog" aria-modal="true">
          <p id="modal-msg"></p>
          <div style="text-align:right;">
            <button id="modal-btn-cancelar" class="btn-secondary">Cancelar</button>
            <button id="modal-btn-confirmar" class="btn-primary">Confirmar</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    modal.querySelector('#modal-msg').textContent = msg;
    modal.style.display = 'flex';
    modal.querySelector('#modal-btn-cancelar').onclick = () => { modal.style.display = 'none'; };
    modal.querySelector('#modal-btn-confirmar').onclick = () => {
      modal.style.display = 'none';
      if (typeof onConfirm === 'function') onConfirm();
    };
    setTimeout(() => modal.querySelector('#modal-btn-cancelar').focus(), 100);
  }

  // CSS básico para modal (adicione ao seu style.css se ainda não tiver)
  if (!document.getElementById('modal-confirmacao-style')) {
    const style = document.createElement('style');
    style.id = 'modal-confirmacao-style';
    style.innerHTML = `
      #modal-confirmacao { display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; align-items:center; justify-content:center; z-index:9999; }
      #modal-confirmacao .modal-bg { position:absolute; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5);}
      #modal-confirmacao .modal-box { position:relative; background:#fff; color:#222; border-radius:8px; padding:24px; min-width:260px; max-width:90vw; box-shadow:0 4px 24px rgba(0,0,0,0.2);}
      #modal-confirmacao .btn-primary { margin-left:8px; }
      body.claro #modal-confirmacao .modal-box { background:#fff; color:#222; }
      body:not(.claro) #modal-confirmacao .modal-box { background:#222; color:#fff; }
    `;
    document.head.appendChild(style);
  }

  // Inicialização
  carregarTarefas();
  limparForm();
});
