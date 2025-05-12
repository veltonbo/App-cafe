// js/aplicacao.js - Versão Melhorada

document.addEventListener('DOMContentLoaded', () => {
  // Elementos
  const form = document.getElementById('formAplicacao');
  const idEdit = document.getElementById('aplicacaoIdEdit');
  const dataApp = document.getElementById('dataApp');
  const produtoApp = document.getElementById('produtoApp');
  const dosagemApp = document.getElementById('dosagemApp');
  const tipoApp = document.getElementById('tipoApp');
  const setorApp = document.getElementById('setorApp');
  const btnSalvar = document.getElementById('btnSalvarAplicacao');
  const btnCancelar = document.getElementById('btnCancelarEdicaoApp');
  const lista = document.getElementById('listaAplicacoes');
  const filtro = document.getElementById('filtroAplicacoes');
  const filtroTipo = document.getElementById('filtroTipoAplicacao');
  const filtroSetor = document.getElementById('filtroSetorAplicacao');
  const filtroData = document.getElementById('filtroDataAplicacao');
  const btnLimparFiltro = document.getElementById('btnLimparFiltroAplicacao');
  const sugestoesProduto = document.getElementById('sugestoesProdutoApp');
  const sugestoesSetor = document.getElementById('sugestoesSetor');
  const resumo = document.getElementById('resumoAplicacoes');
  const fab = document.getElementById('fab-aplicacao');

  // Estado
  let aplicacoesCache = [];
  let editando = false;
  let loading = false;

  // --- Funções auxiliares ---

  function limparForm() {
    form.reset();
    idEdit.value = '';
    editando = false;
    btnSalvar.textContent = 'Salvar Aplicação';
    btnSalvar.disabled = false;
    btnCancelar.classList.add('hidden');
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
    dataApp.focus();
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
      mostrarErroCampo(dataApp, 'Informe a data.');
      valido = false;
    } else {
      // Não permite datas futuras
      const hoje = new Date();
      const dataSelecionada = new Date(dados.data + "T00:00:00");
      if (dataSelecionada > hoje) {
        mostrarErroCampo(dataApp, 'A data não pode ser no futuro.');
        valido = false;
      }
    }
    if (!dados.produto) {
      mostrarErroCampo(produtoApp, 'Informe o produto.');
      valido = false;
    }
    if (!dados.dosagem) {
      mostrarErroCampo(dosagemApp, 'Informe a dosagem.');
      valido = false;
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
    const produtosSet = new Set();
    const setoresSet = new Set();
    aplicacoesCache.forEach(app => {
      if (app.produto) produtosSet.add(app.produto);
      if (app.setor) setoresSet.add(app.setor);
    });
    // Datalist para fallback
    sugestoesProduto.innerHTML = '';
    produtosSet.forEach(prod => {
      sugestoesProduto.innerHTML += `<option value="${prod}"></option>`;
    });
    sugestoesSetor.innerHTML = '';
    setoresSet.forEach(setor => {
      sugestoesSetor.innerHTML += `<option value="${setor}"></option>`;
    });
    // Autocomplete dinâmico
    autocomplete(produtoApp, Array.from(produtosSet));
    autocomplete(setorApp, Array.from(setoresSet));
    // Filtros dinâmicos
    if (filtroSetor) {
      filtroSetor.innerHTML = '<option value="">Setor</option>';
      setoresSet.forEach(setor => {
        filtroSetor.innerHTML += `<option value="${setor}">${setor}</option>`;
      });
    }
    if (filtroTipo) {
      const tipos = new Set(aplicacoesCache.map(a => a.tipo));
      filtroTipo.innerHTML = '<option value="">Tipo</option>';
      tipos.forEach(tipo => {
        filtroTipo.innerHTML += `<option value="${tipo}">${tipo}</option>`;
      });
    }
  }

  // Resumo no topo
  function renderizarResumo() {
    if (!resumo) return;
    const total = aplicacoesCache.length;
    if (total === 0) {
      resumo.innerHTML = `<div class="resumo-vazio">Nenhuma aplicação registrada.</div>`;
      return;
    }
    const ultima = aplicacoesCache.reduce((a, b) => a.timestamp > b.timestamp ? a : b);
    // Agrupamento por tipo
    const porTipo = {};
    aplicacoesCache.forEach(app => {
      porTipo[app.tipo] = (porTipo[app.tipo] || 0) + 1;
    });
    resumo.innerHTML = `
      <div><strong>Total de aplicações:</strong> ${total}</div>
      <div><strong>Última aplicação:</strong> ${ultima.data} (${ultima.produto})</div>
      <div><strong>Agrupamento por tipo:</strong> ${Object.entries(porTipo).map(([tipo, qtd]) => `${tipo}: ${qtd}`).join(' | ')}</div>
    `;
  }

  // Filtro avançado
  function renderizarLista() {
    lista.innerHTML = '';
    let encontrou = false;
    const termo = filtro.value.trim().toLowerCase();
    const tipo = filtroTipo ? filtroTipo.value : '';
    const setor = filtroSetor ? filtroSetor.value : '';
    const data = filtroData ? filtroData.value : '';

    aplicacoesCache
      .filter(app => {
        let ok = true;
        if (termo) {
          const texto = `${app.data} ${app.produto} ${app.dosagem} ${app.tipo} ${app.setor}`.toLowerCase();
          ok = ok && texto.includes(termo);
        }
        if (tipo) ok = ok && app.tipo === tipo;
        if (setor) ok = ok && app.setor === setor;
        if (data) ok = ok && app.data === data;
        return ok;
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .forEach(app => {
        encontrou = true;
        const div = document.createElement('div');
        div.className = 'item fade-in';
        div.innerHTML = `
          <span>
            <strong>${app.produto}</strong> (${app.tipo})<br>
            Data: ${app.data} | Dosagem: ${app.dosagem} | Setor: ${app.setor}
          </span>
          <div>
            <button class="botao-circular menu-opcoes" aria-label="Mais opções" title="Mais opções" data-id="${app._id}" tabindex="0">
              <i class="fas fa-ellipsis-v"></i>
            </button>
            <ul class="opcoes-lista" style="display:none;">
              <li><button class="editar" data-id="${app._id}"><i class="fas fa-edit"></i> Editar</button></li>
              <li><button class="deletar" data-id="${app._id}"><i class="fas fa-trash"></i> Deletar</button></li>
            </ul>
          </div>
        `;
        lista.appendChild(div);
      });

    if (!encontrou) {
      lista.innerHTML = '<p style="text-align:center;color:#888;">Nenhuma aplicação encontrada.</p>';
    }
  }

  // --- CRUD ---

  function setLoading(loadingState) {
    loading = loadingState;
    btnSalvar.disabled = loading;
    btnSalvar.textContent = loading ? 'Salvando...' : (editando ? 'Atualizar Aplicação' : 'Salvar Aplicação');
  }

  function carregarAplicacoes() {
    setLoading(true);
    lista.innerHTML = '<div class="loading">Carregando...</div>';
    getRef('aplicacoes').orderByChild('timestamp').on('value', snap => {
      aplicacoesCache = [];
      snap.forEach(child => {
        const app = child.val();
        app._id = child.key;
        aplicacoesCache.push(app);
      });
      atualizarSugestoes();
      renderizarResumo();
      renderizarLista();
      setLoading(false);
    });
  }

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const dados = {
      data: dataApp.value,
      produto: produtoApp.value.trim(),
      dosagem: dosagemApp.value.trim(),
      tipo: tipoApp.value,
      setor: setorApp.value.trim(),
      timestamp: Date.now()
    };
    if (!validarDados(dados)) {
      setLoading(false);
      return;
    }

    if (editando && idEdit.value) {
      getRef('aplicacoes/' + idEdit.value).set(dados)
        .then(() => {
          mostrarToast('Aplicação atualizada!', 'sucesso');
          limparForm();
          setLoading(false);
        })
        .catch(() => {
          mostrarToast('Erro ao atualizar aplicação!', 'erro');
          setLoading(false);
        });
    } else {
      getRef('aplicacoes').push(dados)
        .then(() => {
          mostrarToast('Aplicação salva!', 'sucesso');
          limparForm();
          setLoading(false);
        })
        .catch(() => {
          mostrarToast('Erro ao salvar aplicação!', 'erro');
          setLoading(false);
        });
    }
  });

  btnCancelar.addEventListener('click', limparForm);

  // Filtros
  [filtro, filtroTipo, filtroSetor, filtroData].forEach(el => {
    if (el) el.addEventListener('input', renderizarLista);
  });
  if (btnLimparFiltro) {
    btnLimparFiltro.addEventListener('click', () => {
      filtro.value = '';
      if (filtroTipo) filtroTipo.value = '';
      if (filtroSetor) filtroSetor.value = '';
      if (filtroData) filtroData.value = '';
      renderizarLista();
    });
  }

  // FAB (botão adicionar)
  if (fab) fab.addEventListener('click', mostrarForm);

  // Delegação de eventos para menu de opções (setinha)
  lista.addEventListener('click', e => {
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
      const app = aplicacoesCache.find(a => a._id === id);
      if (app) {
        dataApp.value = app.data;
        produtoApp.value = app.produto;
        dosagemApp.value = app.dosagem;
        tipoApp.value = app.tipo;
        setorApp.value = app.setor;
        idEdit.value = id;
        editando = true;
        btnSalvar.textContent = 'Atualizar Aplicação';
        btnCancelar.classList.remove('hidden');
        mostrarForm();
        mostrarToast('Editando aplicação...', 'info');
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
          title: 'Remover aplicação?',
          text: 'Deseja remover esta aplicação?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Sim, remover',
          cancelButtonText: 'Cancelar'
        }).then(result => {
          if (result.isConfirmed) {
            getRef('aplicacoes/' + id).remove()
              .then(() => {
                mostrarToast('Aplicação removida!', 'sucesso');
                if (idEdit.value === id) limparForm();
              })
              .catch(() => {
                mostrarToast('Erro ao remover aplicação!', 'erro');
              });
          }
        });
      } else {
        mostrarModalConfirmacao('Deseja remover esta aplicação?', () => {
          getRef('aplicacoes/' + id).remove()
            .then(() => {
              mostrarToast('Aplicação removida!', 'sucesso');
              if (idEdit.value === id) limparForm();
            })
            .catch(() => {
              mostrarToast('Erro ao remover aplicação!', 'erro');
            });
        });
      }
      e.target.closest('.opcoes-lista').style.display = 'none';
      return;
    }
  });

  // Fecha menus de opções ao clicar fora
  document.addEventListener('click', e => {
    if (!e.target.closest('.menu-opcoes')) {
      document.querySelectorAll('.opcoes-lista').forEach(list => list.style.display = 'none');
    }
  });

  // Acessibilidade: permite abrir menu com Enter/Espaço
  lista.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('menu-opcoes')) {
      e.preventDefault();
      e.target.click();
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
  if (!document.getElementById('aplicacao-anim-style')) {
    const style = document.createElement('style');
    style.id = 'aplicacao-anim-style';
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
  carregarAplicacoes();
  limparForm();
});
