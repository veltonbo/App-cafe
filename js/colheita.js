// js/colheita.js - Versão Melhorada

document.addEventListener('DOMContentLoaded', () => {
  // Elementos
  const form = document.getElementById('formColheita');
  const dataColheita = document.getElementById('dataColheita');
  const colhedor = document.getElementById('colhedor');
  const quantidadeLatas = document.getElementById('quantidadeLatas');
  const valorLataInput = document.getElementById('valorLata');
  const btnSalvar = document.getElementById('btnSalvarColheita');
  const btnCancelar = document.getElementById('btnCancelarEdicaoColheita');
  const listaPendentes = document.getElementById('colheitaPendentes');
  const listaPagos = document.getElementById('colheitaPagos');
  const filtroColhedor = document.getElementById('filtroColheitaColhedor');
  const filtroData = document.getElementById('filtroColheitaData');
  const btnLimparFiltro = document.getElementById('btnLimparFiltroColheita');
  const sugestoesColhedor = document.getElementById('sugestoesColhedor');
  const resumo = document.getElementById('resumoColheita');
  const fab = document.getElementById('fab-colheita');

  // Estado
  let colheita = [];
  let valorLataGlobal = 0;
  let editando = false;
  let editIndex = null;
  let loading = false;

  // --- Funções auxiliares ---

  function limparForm() {
    form.reset();
    editando = false;
    editIndex = null;
    btnSalvar.textContent = 'Salvar Lançamento';
    btnSalvar.disabled = false;
    btnCancelar.classList.add('hidden');
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
    dataColheita.focus();
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

  function limparErros() {
    form.querySelectorAll('.erro-campo').forEach(el => el.classList.remove('erro-campo'));
    form.querySelectorAll('.msg-erro').forEach(el => el.remove());
  }

  function validarDados(dados) {
    limparErros();
    let valido = true;
    if (!dados.data) {
      mostrarErroCampo(dataColheita, 'Informe a data.');
      valido = false;
    }
    if (!dados.colhedor) {
      mostrarErroCampo(colhedor, 'Informe o colhedor.');
      valido = false;
    }
    if (!dados.quantidade || isNaN(dados.quantidade) || dados.quantidade <= 0) {
      mostrarErroCampo(quantidadeLatas, 'Informe a quantidade de latas.');
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
    const colhedoresSet = new Set();
    colheita.forEach(c => {
      if (c.colhedor) colhedoresSet.add(c.colhedor);
    });
    sugestoesColhedor.innerHTML = '';
    colhedoresSet.forEach(col => {
      sugestoesColhedor.innerHTML += `<option value="${col}"></option>`;
    });
    autocomplete(colhedor, Array.from(colhedoresSet));
    if (filtroColhedor) {
      filtroColhedor.innerHTML = '<option value="">Colhedor</option>';
      colhedoresSet.forEach(col => {
        filtroColhedor.innerHTML += `<option value="${col}">${col}</option>`;
      });
    }
  }

  // Resumo no topo
  function atualizarResumoColheita() {
    if (!resumo) return;
    const totalLatas = colheita.reduce((soma, c) => soma + c.quantidade, 0);
    const totalPago = colheita.reduce((soma, c) => soma + (c.pagoParcial * c.valorLata), 0);
    const totalPendente = colheita.reduce((soma, c) => soma + ((c.quantidade - c.pagoParcial) * c.valorLata), 0);

    resumo.innerHTML = `
      <div><strong>Total de Latas:</strong> ${totalLatas.toFixed(2)}</div>
      <div><strong>Total Pago:</strong> R$ ${totalPago.toFixed(2)}</div>
      <div><strong>Total Pendente:</strong> R$ ${totalPendente.toFixed(2)}</div>
    `;
  }

  // Filtro avançado
  function atualizarColheita() {
    listaPendentes.innerHTML = '';
    listaPagos.innerHTML = '';

    const termoColhedor = filtroColhedor ? filtroColhedor.value : '';
    const termoData = filtroData ? filtroData.value : '';

    const agrupadoPendentes = {};
    const agrupadoPagos = {};

    colheita.forEach((c, i) => {
      if (termoColhedor && c.colhedor !== termoColhedor) return;
      if (termoData && c.data !== termoData) return;
      if (c.pagoParcial > 0) {
        if (!agrupadoPagos[c.colhedor]) agrupadoPagos[c.colhedor] = [];
        agrupadoPagos[c.colhedor].push({ ...c, quantidade: c.pagoParcial, pago: true, i });
      }
      if (c.quantidade > c.pagoParcial) {
        if (!agrupadoPendentes[c.colhedor]) agrupadoPendentes[c.colhedor] = [];
        agrupadoPendentes[c.colhedor].push({ ...c, quantidade: c.quantidade - c.pagoParcial, pago: false, i });
      }
    });

    montarGrupoColheita(agrupadoPendentes, listaPendentes, false);
    montarGrupoColheita(agrupadoPagos, listaPagos, true);
    atualizarResumoColheita();
  }

  // Montar listagem agrupada
  function montarGrupoColheita(grupo, container, pago) {
    container.innerHTML = '';
    for (const nome in grupo) {
      const bloco = document.createElement('div');
      bloco.className = 'bloco-colhedor';
      bloco.innerHTML = `<strong>${nome}</strong>`;

      grupo[nome].forEach(({ data, quantidade, i }) => {
        const div = document.createElement('div');
        div.className = 'item fade-in';
        div.innerHTML = `
          <span>${data} - ${quantidade} latas</span>
          <div>
            <button class="botao-circular menu-opcoes" aria-label="Mais opções" title="Mais opções" data-index="${i}" tabindex="0">
              <i class="fas fa-ellipsis-v"></i>
            </button>
            <ul class="opcoes-lista" style="display:none;">
              <li><button class="editar" data-index="${i}"><i class="fas fa-edit"></i> Editar</button></li>
              <li><button class="deletar" data-index="${i}"><i class="fas fa-trash"></i> Deletar</button></li>
            </ul>
          </div>
        `;
        bloco.appendChild(div);
      });

      container.appendChild(bloco);
    }
  }

  // --- CRUD ---

  function setLoading(loadingState) {
    loading = loadingState;
    btnSalvar.disabled = loading;
    btnSalvar.textContent = loading ? 'Salvando...' : (editando ? 'Atualizar Lançamento' : 'Salvar Lançamento');
  }

  function carregarValorLata() {
    db.ref('ValorLata').on('value', snap => {
      if (snap.exists()) {
        valorLataGlobal = snap.val();
        if (valorLataInput) valorLataInput.value = valorLataGlobal;
      }
    });
  }

  function salvarValorLata() {
    valorLataGlobal = parseFloat(valorLataInput.value) || 0;
    db.ref('ValorLata').set(valorLataGlobal);
  }

  function carregarColheita() {
    db.ref('Colheita').on('value', snap => {
      colheita = snap.exists() ? Object.values(snap.val()) : [];
      atualizarSugestoes();
      atualizarColheita();
    });
  }

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const nova = {
      data: dataColheita.value,
      colhedor: colhedor.value.trim(),
      quantidade: parseFloat(quantidadeLatas.value),
      valorLata: valorLataGlobal,
      pago: false,
      pagoParcial: 0,
      historicoPagamentos: []
    };

    if (!validarDados(nova)) {
      setLoading(false);
      return;
    }

    if (editando && editIndex !== null) {
      colheita[editIndex] = nova;
    } else {
      colheita.push(nova);
    }
    db.ref('Colheita').set(colheita)
      .then(() => {
        mostrarToast(editando ? 'Lançamento atualizado!' : 'Lançamento salvo!', 'sucesso');
        limparForm();
        setLoading(false);
      })
      .catch(() => {
        mostrarToast('Erro ao salvar lançamento!', 'erro');
        setLoading(false);
      });
  });

  btnCancelar.addEventListener('click', limparForm);

  // Filtros
  [filtroColhedor, filtroData].forEach(el => {
    if (el) el.addEventListener('input', atualizarColheita);
  });
  if (btnLimparFiltro) {
    btnLimparFiltro.addEventListener('click', () => {
      if (filtroColhedor) filtroColhedor.value = '';
      if (filtroData) filtroData.value = '';
      atualizarColheita();
    });
  }

  // FAB (botão adicionar)
  if (fab) fab.addEventListener('click', mostrarForm);

  // Delegação de eventos para menu de opções (setinha)
  [listaPendentes, listaPagos].forEach(container => {
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
        const index = parseInt(btnEditar.getAttribute('data-index'));
        const c = colheita[index];
        if (c) {
          dataColheita.value = c.data;
          colhedor.value = c.colhedor;
          quantidadeLatas.value = c.quantidade;
          editando = true;
          editIndex = index;
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
        const index = parseInt(btnDeletar.getAttribute('data-index'));
        // SweetAlert2 se disponível, senão modal padrão
        if (window.Swal) {
          Swal.fire({
            title: 'Remover lançamento?',
            text: 'Deseja remover este lançamento de colheita?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sim, remover',
            cancelButtonText: 'Cancelar'
          }).then(result => {
            if (result.isConfirmed) {
              colheita.splice(index, 1);
              db.ref('Colheita').set(colheita)
                .then(() => {
                  mostrarToast('Lançamento removido!', 'sucesso');
                  limparForm();
                })
                .catch(() => {
                  mostrarToast('Erro ao remover lançamento!', 'erro');
                });
            }
          });
        } else {
          mostrarModalConfirmacao('Deseja remover esse lançamento de colheita?', () => {
            colheita.splice(index, 1);
            db.ref('Colheita').set(colheita)
              .then(() => {
                mostrarToast('Lançamento removido!', 'sucesso');
                limparForm();
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
    // Acessibilidade: permite abrir menu com Enter/Espaço
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
  if (!document.getElementById('colheita-anim-style')) {
    const style = document.createElement('style');
    style.id = 'colheita-anim-style';
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
  carregarValorLata();
  carregarColheita();
  limparForm();
});
