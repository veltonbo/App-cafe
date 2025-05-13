// aplicacao.js

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
  const sugestoesProduto = document.getElementById('sugestoesProdutoApp');
  const sugestoesSetor = document.getElementById('sugestoesSetor');

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
    btnCancelar.classList.add('hidden');
    limparErros();
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

  function atualizarSugestoes() {
    const produtosSet = new Set();
    const setoresSet = new Set();
    aplicacoesCache.forEach(app => {
      if (app.produto) produtosSet.add(app.produto);
      if (app.setor) setoresSet.add(app.setor);
    });
    sugestoesProduto.innerHTML = '';
    produtosSet.forEach(prod => {
      sugestoesProduto.innerHTML += `<option value="${prod}"></option>`;
    });
    sugestoesSetor.innerHTML = '';
    setoresSet.forEach(setor => {
      sugestoesSetor.innerHTML += `<option value="${setor}"></option>`;
    });
  }

  function renderizarLista(filtroTexto = '') {
    lista.innerHTML = '';
    let encontrou = false;
    const filtroLower = filtroTexto.trim().toLowerCase();

    aplicacoesCache
      .filter(app => {
        if (!filtroLower) return true;
        const texto = `${app.data} ${app.produto} ${app.dosagem} ${app.tipo} ${app.setor}`.toLowerCase();
        return texto.includes(filtroLower);
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .forEach(app => {
        encontrou = true;
        const div = document.createElement('div');
        div.className = 'item';
        div.innerHTML = `
          <span>
            <strong>${app.produto}</strong> (${app.tipo})<br>
            Data: ${app.data} | Dosagem: ${app.dosagem} | Setor: ${app.setor}
          </span>
          <div>
            <button class="botao-circular azul" aria-label="Editar aplicação" title="Editar" data-id="${app._id}" tabindex="0"><i class="fas fa-edit"></i></button>
            <button class="botao-circular vermelho" aria-label="Remover aplicação" title="Remover" data-id="${app._id}" tabindex="0"><i class="fas fa-trash"></i></button>
          </div>
        `;
        lista.appendChild(div);
      });

    if (!encontrou) {
      lista.innerHTML = '<p style="text-align:center;color:#888;">Nenhuma aplicação encontrada.</p>';
    }
  }

  // --- CRUD ---

  // Carregar aplicações do Firebase e manter cache
  function carregarAplicacoes() {
    loading = true;
    lista.innerHTML = '<div class="loading">Carregando...</div>';
    db.ref('aplicacoes').orderByChild('timestamp').on('value', snap => {
      aplicacoesCache = [];
      snap.forEach(child => {
        const app = child.val();
        app._id = child.key;
        aplicacoesCache.push(app);
      });
      atualizarSugestoes();
      renderizarLista(filtro.value);
      loading = false;
    });
  }

  // Adicionar ou atualizar aplicação
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    if (loading) return;
    btnSalvar.disabled = true;
    const dados = {
      data: dataApp.value,
      produto: produtoApp.value.trim(),
      dosagem: dosagemApp.value.trim(),
      tipo: tipoApp.value,
      setor: setorApp.value.trim(),
      timestamp: Date.now()
    };
    if (!validarDados(dados)) {
      btnSalvar.disabled = false;
      return;
    }

    if (editando && idEdit.value) {
      db.ref('aplicacoes/' + idEdit.value).set(dados)
        .then(() => {
          mostrarToast('Aplicação atualizada!', 'sucesso');
          limparForm();
          btnSalvar.disabled = false;
        })
        .catch(() => {
          mostrarToast('Erro ao atualizar aplicação!', 'erro');
          btnSalvar.disabled = false;
        });
    } else {
      db.ref('aplicacoes').push(dados)
        .then(() => {
          mostrarToast('Aplicação salva!', 'sucesso');
          limparForm();
          btnSalvar.disabled = false;
        })
        .catch(() => {
          mostrarToast('Erro ao salvar aplicação!', 'erro');
          btnSalvar.disabled = false;
        });
    }
  });

  // Cancelar edição
  btnCancelar.addEventListener('click', limparForm);

  // Filtro de aplicações
  filtro.addEventListener('input', () => {
    renderizarLista(filtro.value);
  });

  // Delegação de eventos para editar/remover (sem onclick inline)
  lista.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    if (btn.classList.contains('azul')) {
      // Editar
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
        dataApp.focus();
        mostrarToast('Editando aplicação...', 'info');
      }
    } else if (btn.classList.contains('vermelho')) {
      // Remover com modal customizável
      mostrarModalConfirmacao('Deseja remover esta aplicação?', () => {
        db.ref('aplicacoes/' + id).remove()
          .then(() => {
            mostrarToast('Aplicação removida!', 'sucesso');
            if (idEdit.value === id) limparForm();
          })
          .catch(() => {
            mostrarToast('Erro ao remover aplicação!', 'erro');
          });
      });
    }
  });

  // Acessibilidade: permite remover/editar com Enter/Espaço
  lista.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.tagName === 'BUTTON') {
      e.preventDefault();
      e.target.click();
    }
  });

  // Modal de confirmação customizável
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
    // Acessibilidade: foco no botão cancelar
    setTimeout(() => modal.querySelector('#modal-btn-cancelar').focus(), 100);
  }

  // Inicialização
  carregarAplicacoes();
  limparForm();
});
