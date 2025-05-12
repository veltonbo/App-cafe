// js/financeiro.js - Versão Melhorada

document.addEventListener('DOMContentLoaded', () => {
  // Elementos
  const form = document.getElementById('formFinanceiro');
  const idEdit = document.getElementById('financeiroIdEdit');
  const tipoLancamento = document.getElementById('tipoLancamentoFin');
  const dataFin = document.getElementById('dataFin');
  const descricaoFin = document.getElementById('descricaoFin');
  const valorFin = document.getElementById('valorFin');
  const categoriaFin = document.getElementById('categoriaFin');
  const parceladoFin = document.getElementById('parceladoFin');
  const camposParcelas = document.getElementById('camposParcelasFin');
  const numParcelasFin = document.getElementById('numParcelasFin');
  const btnSalvar = document.getElementById('btnSalvarFinanceiro');
  const btnCancelar = document.getElementById('btnCancelarEdicaoFin');
  const lista = document.getElementById('listaFinanceiro');
  const filtroDescricao = document.getElementById('filtroFinanceiroDescricao');
  const filtroData = document.getElementById('filtroFinanceiroData');
  const filtroCategoria = document.getElementById('filtroFinanceiroCategoria');
  const filtroTipo = document.getElementById('filtroFinanceiroTipo');
  const btnLimparFiltro = document.getElementById('btnLimparFiltroFinanceiro');
  const sugestoesCategoria = document.getElementById('sugestoesCategoriaFin');
  const resumo = document.getElementById('resumoFinanceiro');
  const fab = document.getElementById('fab-financeiro');

  // Estado
  let financeiroCache = [];
  let editando = false;
  let loading = false;

  // --- Funções auxiliares ---

  function limparForm() {
    form.reset();
    idEdit.value = '';
    editando = false;
    btnSalvar.textContent = 'Salvar Lançamento';
    btnSalvar.disabled = false;
    btnCancelar.classList.add('hidden');
    camposParcelas.classList.add('hidden');
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
    dataFin.focus();
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
      mostrarErroCampo(dataFin, 'Informe a data.');
      valido = false;
    }
    if (!dados.descricao) {
      mostrarErroCampo(descricaoFin, 'Informe a descrição.');
      valido = false;
    }
    if (!dados.valor || isNaN(dados.valor) || Number(dados.valor) <= 0) {
      mostrarErroCampo(valorFin, 'Informe um valor válido.');
      valido = false;
    }
    if (dados.parcelado) {
      if (!dados.numParcelas || isNaN(dados.numParcelas) || Number(dados.numParcelas) < 2) {
        mostrarErroCampo(numParcelasFin, 'Informe o número de parcelas (mínimo 2).');
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
    const categoriasSet = new Set();
    financeiroCache.forEach(lanc => {
      if (lanc.categoria) categoriasSet.add(lanc.categoria);
    });
    sugestoesCategoria.innerHTML = '';
    categoriasSet.forEach(cat => {
      sugestoesCategoria.innerHTML += `<option value="${cat}"></option>`;
    });
    // Autocomplete dinâmico
    autocomplete(categoriaFin, Array.from(categoriasSet));
    // Filtros dinâmicos
    if (filtroCategoria) {
      filtroCategoria.innerHTML = '<option value="">Categoria</option>';
      categoriasSet.forEach(cat => {
        filtroCategoria.innerHTML += `<option value="${cat}">${cat}</option>`;
      });
    }
    if (filtroTipo) {
      filtroTipo.innerHTML = '<option value="">Tipo</option>';
      filtroTipo.innerHTML += '<option value="receita">Receita</option>';
      filtroTipo.innerHTML += '<option value="gasto">Gasto</option>';
    }
  }

  // Resumo no topo
  function renderizarResumo() {
    if (!resumo) return;
    let totalReceitas = 0, totalGastos = 0;
    financeiroCache.forEach(lanc => {
      if (lanc.tipo === 'receita') totalReceitas += Number(lanc.valor);
      else totalGastos += Number(lanc.valor);
    });
    const saldo = totalReceitas - totalGastos;
    resumo.innerHTML = `
      <h3>Resumo Financeiro</h3>
      <p><strong>Total de Receitas:</strong> <span id="totalReceitasFin">R$ ${totalReceitas.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span></p>
      <p><strong>Total de Gastos:</strong> <span id="totalGastosFin">R$ ${totalGastos.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span></p>
      <p><strong>Saldo:</strong> <span id="saldoFin" style="color:${saldo>=0?'#4caf50':'#f44336'}">R$ ${saldo.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span></p>
    `;
  }

  // Filtro avançado
  function renderizarLista() {
    lista.innerHTML = '';
    let encontrou = false;
    const termo = filtroDescricao ? filtroDescricao.value.trim().toLowerCase() : '';
    const data = filtroData ? filtroData.value : '';
    const categoria = filtroCategoria ? filtroCategoria.value : '';
    const tipo = filtroTipo ? filtroTipo.value : '';

    financeiroCache
      .filter(lanc => {
        let ok = true;
        if (termo) {
          const texto = `${lanc.data} ${lanc.descricao} ${lanc.categoria || ''}`.toLowerCase();
          ok = ok && texto.includes(termo);
        }
        if (data) ok = ok && lanc.data === data;
        if (categoria) ok = ok && lanc.categoria === categoria;
        if (tipo) ok = ok && lanc.tipo === tipo;
        return ok;
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .forEach(lanc => {
        encontrou = true;
        const div = document.createElement('div');
        div.className = 'item fade-in';
        div.innerHTML = `
          <span>
            <strong>${lanc.descricao}</strong> (${lanc.tipo === 'receita' ? 'Receita' : 'Gasto'})<br>
            Data: ${lanc.data} | Valor: R$ ${Number(lanc.valor).toLocaleString('pt-BR', {minimumFractionDigits:2})} | Categoria: ${lanc.categoria || '-'}
            ${lanc.parcelado ? `<br><em>Parcelado em ${lanc.numParcelas}x</em>` : ''}
          </span>
          <div>
            <button class="botao-circular menu-opcoes" aria-label="Mais opções" title="Mais opções" data-id="${lanc._id}" tabindex="0">
              <i class="fas fa-ellipsis-v"></i>
            </button>
            <ul class="opcoes-lista" style="display:none;">
              <li><button class="editar" data-id="${lanc._id}"><i class="fas fa-edit"></i> Editar</button></li>
              <li><button class="deletar" data-id="${lanc._id}"><i class="fas fa-trash"></i> Deletar</button></li>
            </ul>
          </div>
        `;
        lista.appendChild(div);
      });

    if (!encontrou) {
      lista.innerHTML = '<p style="text-align:center;color:#888;">Nenhum lançamento encontrado.</p>';
    }
  }

  // --- CRUD ---

  function setLoading(loadingState) {
    loading = loadingState;
    btnSalvar.disabled = loading;
    btnSalvar.textContent = loading ? 'Salvando...' : (editando ? 'Atualizar Lançamento' : 'Salvar Lançamento');
  }

  function carregarFinanceiro() {
    setLoading(true);
    lista.innerHTML = '<div class="loading">Carregando...</div>';
    getRef('financeiro').orderByChild('timestamp').on('value', snap => {
      financeiroCache = [];
      snap.forEach(child => {
        const lanc = child.val();
        lanc._id = child.key;
        financeiroCache.push(lanc);
      });
      atualizarSugestoes();
      renderizarLista();
      renderizarResumo();
      setLoading(false);
    });
  }

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const dados = {
      tipo: tipoLancamento.value,
      data: dataFin.value,
      descricao: descricaoFin.value.trim(),
      valor: Number(valorFin.value),
      categoria: categoriaFin.value.trim(),
      parcelado: parceladoFin.checked,
      numParcelas: parceladoFin.checked ? Number(numParcelasFin.value) : null,
      timestamp: Date.now()
    };
    if (!validarDados(dados)) {
      setLoading(false);
      return;
    }

    if (editando && idEdit.value) {
      getRef('financeiro/' + idEdit.value).set(dados)
        .then(() => {
          mostrarToast('Lançamento atualizado!', 'sucesso');
          limparForm();
          setLoading(false);
        })
        .catch(() => {
          mostrarToast('Erro ao atualizar lançamento!', 'erro');
          setLoading(false);
        });
    } else {
      getRef('financeiro').push(dados)
        .then(() => {
          mostrarToast('Lançamento salvo!', 'sucesso');
          limparForm();
          setLoading(false);
        })
        .catch(() => {
          mostrarToast('Erro ao salvar lançamento!', 'erro');
          setLoading(false);
        });
    }
  });

  btnCancelar.addEventListener('click', limparForm);

  // Mostrar/ocultar campos de parcelas
  parceladoFin.addEventListener('change', () => {
    if (parceladoFin.checked) {
      camposParcelas.classList.remove('hidden');
      numParcelasFin.focus();
    } else {
      camposParcelas.classList.add('hidden');
    }
  });

  // Filtros
  [filtroDescricao, filtroData, filtroCategoria, filtroTipo].forEach(el => {
    if (el) el.addEventListener('input', renderizarLista);
  });
  if (btnLimparFiltro) {
    btnLimparFiltro.addEventListener('click', () => {
      if (filtroDescricao) filtroDescricao.value = '';
      if (filtroData) filtroData.value = '';
      if (filtroCategoria) filtroCategoria.value = '';
      if (filtroTipo) filtroTipo.value = '';
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
      const lanc = financeiroCache.find(l => l._id === id);
      if (lanc) {
        tipoLancamento.value = lanc.tipo;
        dataFin.value = lanc.data;
        descricaoFin.value = lanc.descricao;
        valorFin.value = lanc.valor;
        categoriaFin.value = lanc.categoria;
        parceladoFin.checked = !!lanc.parcelado;
        if (lanc.parcelado) {
          camposParcelas.classList.remove('hidden');
          numParcelasFin.value = lanc.numParcelas || 2;
        } else {
          camposParcelas.classList.add('hidden');
        }
        idEdit.value = id;
        editando = true;
        btnSalvar.textContent = 'Atualizar Lançamento';
        btnCancelar.classList.remove('hidden');
        mostrarForm();
        mostrarToast('Editando lançamento...', 'info');
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
          title: 'Remover lançamento?',
          text: 'Deseja remover este lançamento?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Sim, remover',
          cancelButtonText: 'Cancelar'
        }).then(result => {
          if (result.isConfirmed) {
            getRef('financeiro/' + id).remove()
              .then(() => {
                mostrarToast('Lançamento removido!', 'sucesso');
                if (idEdit.value === id) limparForm();
              })
              .catch(() => {
                mostrarToast('Erro ao remover lançamento!', 'erro');
              });
          }
        });
      } else {
        mostrarModalConfirmacao('Deseja remover este lançamento?', () => {
          getRef('financeiro/' + id).remove()
            .then(() => {
              mostrarToast('Lançamento removido!', 'sucesso');
              if (idEdit.value === id) limparForm();
            })
            .catch(() => {
              mostrarToast('Erro ao remover lançamento!', 'erro');
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
  if (!document.getElementById('financeiro-anim-style')) {
    const style = document.createElement('style');
    style.id = 'financeiro-anim-style';
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
  carregarFinanceiro();
  limparForm();
});
