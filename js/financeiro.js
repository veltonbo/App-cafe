// financeiro.js

document.addEventListener('DOMContentLoaded', () => {
  // Elementos do formulário
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
  const btnToggleForm = document.getElementById('btnToggleFormFinanceiro');
  const lista = document.getElementById('listaFinanceiro');
  const filtro = document.getElementById('filtroFinanceiro');
  const sugestoesCategoria = document.getElementById('sugestoesCategoriaFin');
  const resumo = document.getElementById('resumoFinanceiro');

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
    btnCancelar.classList.add('hidden');
    form.classList.add('hidden');
    limparErros();
    btnToggleForm.focus();
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

  function atualizarSugestoes() {
    const categoriasSet = new Set();
    financeiroCache.forEach(lanc => {
      if (lanc.categoria) categoriasSet.add(lanc.categoria);
    });
    sugestoesCategoria.innerHTML = '';
    categoriasSet.forEach(cat => {
      sugestoesCategoria.innerHTML += `<option value="${cat}"></option>`;
    });
  }

  function renderizarLista(filtroTexto = '') {
    lista.innerHTML = '';
    let encontrou = false;
    const filtroLower = filtroTexto.trim().toLowerCase();

    financeiroCache
      .filter(lanc => {
        if (!filtroLower) return true;
        const texto = `${lanc.data} ${lanc.descricao} ${lanc.categoria || ''}`.toLowerCase();
        return texto.includes(filtroLower);
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .forEach(lanc => {
        encontrou = true;
        const div = document.createElement('div');
        div.className = 'item';
        div.innerHTML = `
          <span>
            <strong>${lanc.descricao}</strong> (${lanc.tipo === 'receita' ? 'Receita' : 'Gasto'})<br>
            Data: ${lanc.data} | Valor: R$ ${Number(lanc.valor).toLocaleString('pt-BR', {minimumFractionDigits:2})} | Categoria: ${lanc.categoria || '-'}
            ${lanc.parcelado ? `<br><em>Parcelado em ${lanc.numParcelas}x</em>` : ''}
          </span>
          <div>
            <button class="botao-circular azul" aria-label="Editar lançamento" title="Editar" data-id="${lanc._id}"><i class="fas fa-edit"></i></button>
            <button class="botao-circular vermelho" aria-label="Remover lançamento" title="Remover" data-id="${lanc._id}"><i class="fas fa-trash"></i></button>
          </div>
        `;
        lista.appendChild(div);
      });

    if (!encontrou) {
      lista.innerHTML = '<p style="text-align:center;color:#888;">Nenhum lançamento encontrado.</p>';
    }
  }

  function renderizarResumo() {
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

  // --- CRUD ---

  function carregarFinanceiro() {
    loading = true;
    lista.innerHTML = '<div class="loading">Carregando...</div>';
    ref(database, 'financeiro').orderByChild('timestamp').on('value', snap => {
      financeiroCache = [];
      snap.forEach(child => {
        const lanc = child.val();
        lanc._id = child.key;
        financeiroCache.push(lanc);
      });
      atualizarSugestoes();
      renderizarLista(filtro.value);
      renderizarResumo();
      loading = false;
    });
  }

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    if (loading) return;
    btnSalvar.disabled = true;
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
      btnSalvar.disabled = false;
      return;
    }

    if (editando && idEdit.value) {
      ref(database, 'financeiro/' + idEdit.value).set(dados)
        .then(() => {
          mostrarToast('Lançamento atualizado!', 'sucesso');
          limparForm();
          btnSalvar.disabled = false;
        })
        .catch(() => {
          mostrarToast('Erro ao atualizar lançamento!', 'erro');
          btnSalvar.disabled = false;
        });
    } else {
      ref(database, 'financeiro').push(dados)
        .then(() => {
          mostrarToast('Lançamento salvo!', 'sucesso');
          limparForm();
          btnSalvar.disabled = false;
        })
        .catch(() => {
          mostrarToast('Erro ao salvar lançamento!', 'erro');
          btnSalvar.disabled = false;
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

  // Filtro
  filtro.addEventListener('input', () => renderizarLista(filtro.value));

  // Alternar formulário
  btnToggleForm.addEventListener('click', () => {
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) {
      dataFin.focus();
    }
    limparForm();
    form.classList.remove('hidden');
  });

  // Delegação de eventos para editar/remover
  lista.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    if (btn.classList.contains('azul')) {
      // Editar
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
        form.classList.remove('hidden');
        dataFin.focus();
        mostrarToast('Editando lançamento...', 'info');
      }
    } else if (btn.classList.contains('vermelho')) {
      mostrarModalConfirmacao('Deseja remover este lançamento?', () => {
        ref(database, 'financeiro/' + id).remove()
          .then(() => {
            mostrarToast('Lançamento removido!', 'sucesso');
            if (idEdit.value === id) limparForm();
          })
          .catch(() => {
            mostrarToast('Erro ao remover lançamento!', 'erro');
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

  // Modal de confirmação (igual ao dos outros módulos)
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
  carregarFinanceiro();
  limparForm();
});
