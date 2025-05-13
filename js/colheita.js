// colheita.js

document.addEventListener('DOMContentLoaded', () => {
  // Elementos do formulário
  const form = document.getElementById('formColheita');
  const idEdit = document.getElementById('colheitaIdEdit');
  const dataColheita = document.getElementById('dataColheita');
  const colhedorColheita = document.getElementById('colhedorColheita');
  const quantidadeLatasColheita = document.getElementById('quantidadeLatasColheita');
  const pagoColheita = document.getElementById('pagoColheita');
  const btnSalvar = document.getElementById('btnSalvarColheita');
  const btnCancelar = document.getElementById('btnCancelarEdicaoColheita');
  const valorLataInput = document.getElementById('valorLataColheita');
  const btnSalvarValorLata = document.getElementById('btnSalvarValorLata');
  const listaPendentes = document.getElementById('listaColheitaPendentes');
  const listaPagos = document.getElementById('listaColheitaPagos');
  const filtroPendentes = document.getElementById('filtroColheitaPendentes');
  const filtroPagos = document.getElementById('filtroColheitaPagos');
  const sugestoesColhedor = document.getElementById('sugestoesColhedor');
  const resumo = document.getElementById('resumoColheita');

  // Estado
  let colheitaCache = [];
  let editando = false;
  let loading = false;
  let valorLata = parseFloat(localStorage.getItem('valorLataColheita')) || 0;

  // --- Funções auxiliares ---

  function limparForm() {
    form.reset();
    idEdit.value = '';
    editando = false;
    btnSalvar.textContent = 'Salvar Registro';
    btnCancelar.classList.add('hidden');
    limparErros();
    dataColheita.focus();
    pagoColheita.checked = true;
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
      mostrarErroCampo(dataColheita, 'Informe a data.');
      valido = false;
    }
    if (!dados.colhedor) {
      mostrarErroCampo(colhedorColheita, 'Informe o colhedor.');
      valido = false;
    }
    if (!dados.quantidadeLatas || isNaN(dados.quantidadeLatas) || Number(dados.quantidadeLatas) <= 0) {
      mostrarErroCampo(quantidadeLatasColheita, 'Informe uma quantidade válida.');
      valido = false;
    }
    return valido;
  }

  function atualizarSugestoes() {
    const colhedoresSet = new Set();
    colheitaCache.forEach(reg => {
      if (reg.colhedor) colhedoresSet.add(reg.colhedor);
    });
    sugestoesColhedor.innerHTML = '';
    colhedoresSet.forEach(colhedor => {
      sugestoesColhedor.innerHTML += `<option value="${colhedor}"></option>`;
    });
  }

  function renderizarListas() {
    renderizarLista(listaPendentes, false, filtroPendentes.value);
    renderizarLista(listaPagos, true, filtroPagos.value);
    renderizarResumo();
  }

  function renderizarLista(container, pago, filtroTexto = '') {
    container.innerHTML = '';
    let encontrou = false;
    const filtroLower = filtroTexto.trim().toLowerCase();

    colheitaCache
      .filter(reg => reg.pago === pago)
      .filter(reg => {
        if (!filtroLower) return true;
        const texto = `${reg.data} ${reg.colhedor} ${reg.quantidadeLatas}`.toLowerCase();
        return texto.includes(filtroLower);
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .forEach(reg => {
        encontrou = true;
        const div = document.createElement('div');
        div.className = 'item';
        div.innerHTML = `
          <span>
            <strong>${reg.colhedor}</strong><br>
            Data: ${reg.data} | Latas: ${reg.quantidadeLatas} | Valor: R$ ${(valorLata * reg.quantidadeLatas).toLocaleString('pt-BR', {minimumFractionDigits:2})}
          </span>
          <div>
            <button class="botao-circular" aria-label="${reg.pago ? 'Marcar como pendente' : 'Marcar como pago'}" title="${reg.pago ? 'Marcar como pendente' : 'Marcar como pago'}" data-id="${reg._id}" data-action="toggle"><i class="fas fa-${reg.pago ? 'undo' : 'check'}"></i></button>
            <button class="botao-circular azul" aria-label="Editar registro" title="Editar" data-id="${reg._id}" data-action="edit"><i class="fas fa-edit"></i></button>
            <button class="botao-circular vermelho" aria-label="Remover registro" title="Remover" data-id="${reg._id}" data-action="remove"><i class="fas fa-trash"></i></button>
          </div>
        `;
        container.appendChild(div);
      });

    if (!encontrou) {
      container.innerHTML = `<p style="text-align:center;color:#888;">Nenhum registro ${pago ? 'pago' : 'pendente'} encontrado.</p>`;
    }
  }

  function renderizarResumo() {
    let totalLatas = 0, totalPago = 0, totalPendente = 0;
    colheitaCache.forEach(reg => {
      totalLatas += Number(reg.quantidadeLatas);
      if (reg.pago) totalPago += valorLata * Number(reg.quantidadeLatas);
      else totalPendente += valorLata * Number(reg.quantidadeLatas);
    });
    resumo.innerHTML = `
      <h3>Resumo da Colheita</h3>
      <p><strong>Total de Latas:</strong> <span id="totalLatasColheita">${totalLatas}</span></p>
      <p><strong>Total Pago:</strong> <span id="totalPagoColheita">R$ ${totalPago.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span></p>
      <p><strong>Total Pendente:</strong> <span id="totalPendenteColheita">R$ ${totalPendente.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span></p>
    `;
  }

  // --- CRUD ---

  function carregarColheita() {
    loading = true;
    listaPendentes.innerHTML = '<div class="loading">Carregando...</div>';
    listaPagos.innerHTML = '<div class="loading">Carregando...</div>';
    getRef('colheita').orderByChild('timestamp').on('value', snap => {
      colheitaCache = [];
      snap.forEach(child => {
        const reg = child.val();
        reg._id = child.key;
        colheitaCache.push(reg);
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
      data: dataColheita.value,
      colhedor: colhedorColheita.value.trim(),
      quantidadeLatas: Number(quantidadeLatasColheita.value),
      pago: pagoColheita.checked,
      timestamp: Date.now()
    };
    if (!validarDados(dados)) {
      btnSalvar.disabled = false;
      return;
    }

    if (editando && idEdit.value) {
      getRef('colheita/' + idEdit.value).set(dados)
        .then(() => {
          mostrarToast('Registro atualizado!', 'sucesso');
          limparForm();
          btnSalvar.disabled = false;
        })
        .catch(() => {
          mostrarToast('Erro ao atualizar registro!', 'erro');
          btnSalvar.disabled = false;
        });
    } else {
      getRef('colheita').push(dados)
        .then(() => {
          mostrarToast('Registro salvo!', 'sucesso');
          limparForm();
          btnSalvar.disabled = false;
        })
        .catch(() => {
          mostrarToast('Erro ao salvar registro!', 'erro');
          btnSalvar.disabled = false;
        });
    }
  });

  btnCancelar.addEventListener('click', limparForm);

  // Salvar valor da lata
  btnSalvarValorLata.addEventListener('click', () => {
    const valor = parseFloat(valorLataInput.value);
    if (isNaN(valor) || valor <= 0) {
      mostrarToast('Informe um valor válido para a lata!', 'erro');
      valorLataInput.focus();
      return;
    }
    valorLata = valor;
    localStorage.setItem('valorLataColheita', valorLata);
    renderizarResumo();
    mostrarToast('Valor da lata salvo!', 'sucesso');
  });

  // Filtros
  filtroPendentes.addEventListener('input', () => renderizarLista(listaPendentes, false, filtroPendentes.value));
  filtroPagos.addEventListener('input', () => renderizarLista(listaPagos, true, filtroPagos.value));

  // Delegação de eventos para editar/remover/toggle
  [listaPendentes, listaPagos].forEach(container => {
    container.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      if (action === 'edit') {
        const reg = colheitaCache.find(r => r._id === id);
        if (reg) {
          dataColheita.value = reg.data;
          colhedorColheita.value = reg.colhedor;
          quantidadeLatasColheita.value = reg.quantidadeLatas;
          pagoColheita.checked = !!reg.pago;
          idEdit.value = id;
          editando = true;
          btnSalvar.textContent = 'Atualizar Registro';
          btnCancelar.classList.remove('hidden');
          form.classList.remove('hidden');
          dataColheita.focus();
          mostrarToast('Editando registro...', 'info');
        }
      } else if (action === 'remove') {
        mostrarModalConfirmacao('Deseja remover este registro?', () => {
          getRef('colheita/' + id).remove()
            .then(() => {
              mostrarToast('Registro removido!', 'sucesso');
              if (idEdit.value === id) limparForm();
            })
            .catch(() => {
              mostrarToast('Erro ao remover registro!', 'erro');
            });
        });
      } else if (action === 'toggle') {
        const reg = colheitaCache.find(r => r._id === id);
        if (reg) {
          getRef('colheita/' + id).update({ pago: !reg.pago })
            .then(() => {
              mostrarToast(reg.pago ? 'Registro marcado como pendente.' : 'Registro marcado como pago!', 'sucesso');
            })
            .catch(() => {
              mostrarToast('Erro ao atualizar registro!', 'erro');
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
  valorLataInput.value = valorLata > 0 ? valorLata : '';
  carregarColheita();
  limparForm();
});
