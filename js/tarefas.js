// js/tarefas.js - Versão Melhorada

document.addEventListener('DOMContentLoaded', () => {
  // Elementos
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
  const filtroDescricao = document.getElementById('filtroTarefasDescricao');
  const filtroData = document.getElementById('filtroTarefasData');
  const filtroSetor = document.getElementById('filtroTarefasSetor');
  const filtroPrioridade = document.getElementById('filtroTarefasPrioridade');
  const filtroProduto = document.getElementById('filtroTarefasProduto');
  const btnLimparFiltro = document.getElementById('btnLimparFiltroTarefas');
  const sugestoesSetor = document.getElementById('sugestoesSetor');
  const sugestoesProduto = document.getElementById('sugestoesProdutoApp');
  const resumo = document.getElementById('resumoTarefas');
  const fab = document.getElementById('fab-tarefa');

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
    btnSalvar.disabled = false;
    btnCancelar.classList.add('hidden');
    camposAplicacao.classList.add('hidden');
    limparErros();
    form.classList.add('fade-out');
    setTimeout(() => {
      form.classList.add('hidden');
      form.classList.remove('fade-out');
      fab.classList.remove('hidden');
    }, 200);
  }

  function mostrarForm() {
    form.classList.remove('hidden');
    form.classList.add('fade-in');
    fab.classList.add('hidden');
    setTimeout(() => form.classList.remove('fade-in'), 200);
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

  // Sugestão dinâmica/autocomplete simples
  function autocomplete(input, arr) {
    input.addEventListener("input", function() {
      let val = this.value;
      closeAllLists();
      if (!val) return false;
      let list = document.createElement("div");
      list.setAttribute("class", "autocomplete-items");
      this.parentNode.appendChild(list);
      let count = 0;
      arr.forEach(item => {
        if (item.toLowerCase().includes(val.toLowerCase()) && count < 5) {
          let itemDiv = document.createElement("div");
          itemDiv.innerHTML = "<strong>" + item.substr(0, val.length) + "</strong>" + item.substr(val.length);
          itemDiv.addEventListener("click", () => {
            input.value = item;
            closeAllLists();
          });
          list.appendChild(itemDiv);
          count++;
        }
      });
    });
    function closeAllLists(elmnt) {
      let items = document.querySelectorAll(".autocomplete-items");
      items.forEach(item => item.parentNode.removeChild(item));
    }
    document.addEventListener("click", function (e) { closeAllLists(e.target); });
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
    // Autocomplete dinâmico
    autocomplete(setorTarefa, Array.from(setoresSet));
    autocomplete(produtoAplicacao, Array.from(produtosSet));
    // Filtros dinâmicos
    if (filtroSetor) {
      filtroSetor.innerHTML = '<option value="">Setor</option>';
      setoresSet.forEach(setor => {
        filtroSetor.innerHTML += `<option value="${setor}">${setor}</option>`;
      });
    }
    if (filtroProduto) {
      filtroProduto.innerHTML = '<option value="">Produto</option>';
      produtosSet.forEach(prod => {
        filtroProduto.innerHTML += `<option value="${prod}">${prod}</option>`;
      });
    }
  }

  // Resumo no topo
  function renderizarResumo() {
    if (!resumo) return;
    const total = tarefasCache.length;
    const pendentes = tarefasCache.filter(t => !t.feita).length;
    const concluidas = tarefasCache.filter(t => t.feita).length;
    if (total === 0) {
      resumo.innerHTML = `<div class="resumo-vazio">Nenhuma tarefa registrada.</div>`;
      return;
    }
    const ultima = tarefasCache.reduce((a, b) => a.timestamp > b.timestamp ? a : b);
    resumo.innerHTML = `
      <div><strong>Total de tarefas:</strong> ${total}</div>
      <div><strong>Pendentes:</strong> ${pendentes} | <strong>Concluídas:</strong> ${concluidas}</div>
      <div><strong>Última tarefa:</strong> ${ultima.data} (${ultima.descricao})</div>
    `;
  }

  // Filtro avançado
  function renderizarListas() {
    renderizarLista(listaPendentes, false);
    renderizarLista(listaConcluidas, true);
  }

  function renderizarLista(container, feita) {
    container.innerHTML = '';
    let encontrou = false;
    const termo = filtroDescricao ? filtroDescricao.value.trim().toLowerCase() : '';
    const data = filtroData ? filtroData.value : '';
    const setor = filtroSetor ? filtroSetor.value : '';
    const prioridade = filtroPrioridade ? filtroPrioridade.value : '';
    const produto = filtroProduto ? filtroProduto.value : '';

    tarefasCache
      .filter(tarefa => tarefa.feita === feita)
      .filter(tarefa => {
        let ok = true;
        if (termo) {
          const texto = `${tarefa.data} ${tarefa.descricao} ${tarefa.setor} ${tarefa.produtoAplicacao || ''} ${tarefa.dosagemAplicacao || ''}`.toLowerCase();
          ok = ok && texto.includes(termo);
        }
        if (data) ok = ok && tarefa.data === data;
        if (setor) ok = ok && tarefa.setor === setor;
        if (prioridade) ok = ok && tarefa.prioridade === prioridade;
        if (produto) ok = ok && tarefa.produtoAplicacao === produto;
        return ok;
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .forEach(tarefa => {
        encontrou = true;
        const div = document.createElement('div');
        div.className = 'item fade-in' + (tarefa.feita ? ' tarefa-feita' : '');
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
            <button class="botao-circular menu-opcoes" aria-label="Mais opções" title="Mais opções" data-id="${tarefa._id}" tabindex="0">
              <i class="fas fa-ellipsis-v"></i>
            </button>
            <ul class="opcoes-lista" style="display:none;">
              <li><button class="toggle" data-id="${tarefa._id}"><i class="fas fa-${tarefa.feita ? 'undo' : 'check'}"></i> ${tarefa.feita ? 'Marcar como pendente' : 'Marcar como feita'}</button></li>
              <li><button class="editar" data-id="${tarefa._id}"><i class="fas fa-edit"></i> Editar</button></li>
              <li><button class="deletar" data-id="${tarefa._id}"><i class="fas fa-trash"></i> Deletar</button></li>
            </ul>
          </div>
        `;
        container.appendChild(div);
      });

    if (!encontrou) {
      container.innerHTML = `<p style="text-align:center;color:#888;">Nenhuma tarefa ${feita ? 'concluída' : 'pendente'} encontrada.</p>`;
    }
  }

  // --- CRUD ---

  function setLoading(loadingState) {
    loading = loadingState;
    btnSalvar.disabled = loading;
    btnSalvar.textContent = loading ? 'Salvando...' : (editando ? 'Atualizar Tarefa' : 'Salvar Tarefa');
  }

  function carregarTarefas() {
    setLoading(true);
    listaPendentes.innerHTML = '<div class="loading">Carregando...</div>';
    listaConcluidas.innerHTML = '<div class="loading">Carregando...</div>';
    getRef('tarefas').orderByChild('timestamp').on('value', snap => {
      tarefasCache = [];
      snap.forEach(child => {
        const tarefa = child.val();
        tarefa._id = child.key;
        tarefasCache.push(tarefa);
      });
      atualizarSugestoes();
      renderizarResumo();
      renderizarListas();
      setLoading(false);
    });
  }

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
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
      setLoading(false);
      return;
    }

    if (editando && idEdit.value) {
      getRef('tarefas/' + idEdit.value).set(dados)
        .then(() => {
          mostrarToast('Tarefa atualizada!', 'sucesso');
          limparForm();
          setLoading(false);
        })
        .catch(() => {
          mostrarToast('Erro ao atualizar tarefa!', 'erro');
          setLoading(false);
        });
    } else {
      getRef('tarefas').push(dados)
        .then(() => {
          mostrarToast('Tarefa salva!', 'sucesso');
          limparForm();
          setLoading(false);
        })
        .catch(() => {
          mostrarToast('Erro ao salvar tarefa!', 'erro');
          setLoading(false);
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
  [filtroDescricao, filtroData, filtroSetor, filtroPrioridade, filtroProduto].forEach(el => {
    if (el) el.addEventListener('input', renderizarListas);
  });
  if (btnLimparFiltro) {
    btnLimparFiltro.addEventListener('click', () => {
      if (filtroDescricao) filtroDescricao.value = '';
      if (filtroData) filtroData.value = '';
      if (filtroSetor) filtroSetor.value = '';
      if (filtroPrioridade) filtroPrioridade.value = '';
      if (filtroProduto) filtroProduto.value = '';
      renderizarListas();
    });
  }

  // FAB (botão adicionar)
  if (fab) fab.addEventListener('click', mostrarForm);

  // Delegação de eventos para menu de opções (setinha)
  [listaPendentes, listaConcluidas].forEach(container => {
    container.addEventListener('click', e => {
      const btn = e.target.closest('.menu-opcoes');
      if (btn) {
        // Toggle menu
        const ul = btn.parentNode.querySelector('.opcoes-lista');
        document.querySelectorAll('.opcoes-lista').forEach(list => {
          if (list !== ul) list.style.display = 'none';
        });
        ul.style.display = ul.style.display === 'block' ? 'none' : 'block';
        return;
      }
      // Editar
      const btnEditar = e.target.closest('.editar');
      if (btnEditar) {
        const id = btnEditar.getAttribute('data-id');
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
          mostrarForm();
          mostrarToast('Editando tarefa...', 'info');
        }
        e.target.closest('.opcoes-lista').style.display = 'none';
        return;
      }
      // Deletar
      const btnDeletar = e.target.closest('.deletar');
      if (btnDeletar) {
        const id = btnDeletar.getAttribute('data-id');
        // SweetAlert2 se disponível, senão modal padrão
        if (window.Swal) {
          Swal.fire({
            title: 'Remover tarefa?',
            text: 'Deseja remover esta tarefa?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sim, remover',
            cancelButtonText: 'Cancelar'
          }).then(result => {
            if (result.isConfirmed) {
              getRef('tarefas/' + id).remove()
                .then(() => {
                  mostrarToast('Tarefa removida!', 'sucesso');
                  if (idEdit.value === id) limparForm();
                })
                .catch(() => {
                  mostrarToast('Erro ao remover tarefa!', 'erro');
                });
            }
          });
        } else {
          mostrarModalConfirmacao('Deseja remover esta tarefa?', () => {
            getRef('tarefas/' + id).remove()
              .then(() => {
                mostrarToast('Tarefa removida!', 'sucesso');
                if (idEdit.value === id) limparForm();
              })
              .catch(() => {
                mostrarToast('Erro ao remover tarefa!', 'erro');
              });
          });
        }
        e.target.closest('.opcoes-lista').style.display = 'none';
        return;
      }
      // Toggle feita/pendente
      const btnToggle = e.target.closest('.toggle');
      if (btnToggle) {
        const id = btnToggle.getAttribute('data-id');
        const tarefa = tarefasCache.find(t => t._id === id);
        if (tarefa) {
          getRef('tarefas/' + id).update({ feita: !tarefa.feita })
            .then(() => {
              mostrarToast(tarefa.feita ? 'Tarefa marcada como pendente.' : 'Tarefa concluída!', 'sucesso');
            })
            .catch(() => {
              mostrarToast('Erro ao atualizar tarefa!', 'erro');
            });
        }
        e.target.closest('.opcoes-lista').style.display = 'none';
        return;
      }
    });
    // Acessibilidade: permite remover/editar/toggle com Enter/Espaço
    container.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('menu-opcoes')) {
        e.preventDefault();
        e.target.click();
      }
    });
  });

  // Fecha menus de opções ao clicar fora
  document.addEventListener('click', e => {
    if (!e.target.closest('.menu-opcoes')) {
      document.querySelectorAll('.opcoes-lista').forEach(list => list.style.display = 'none');
    }
  });

  // Modal de confirmação customizável (fallback)
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

  // CSS para animações fade-in/fade-out (adicione ao seu style.css)
  if (!document.getElementById('tarefas-anim-style')) {
    const style = document.createElement('style');
    style.id = 'tarefas-anim-style';
    style.innerHTML = `
      .fade-in { animation: fadeIn 0.2s; }
      .fade-out { animation: fadeOut 0.2s; }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
      .autocomplete-items { position: absolute; background: #fff; border: 1px solid #ccc; z-index: 10; max-height: 150px; overflow-y: auto; }
      .autocomplete-items div { padding: 8px; cursor: pointer; }
      .autocomplete-items div:hover { background: #f0f0f0; }
    `;
    document.head.appendChild(style);
  }

  // Inicialização
  carregarTarefas();
  limparForm();
});
