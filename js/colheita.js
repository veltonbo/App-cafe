import { ref, onValue, set, push, remove, update } from "firebase/database";
import { database } from "./js/firebase-config.js"; // ajuste o caminho conforme necessário

document.addEventListener('DOMContentLoaded', () => {
  const user = localStorage.getItem('gm_cafe_current_user');
  if (!user) return;
  const dbRef = firebase.database().ref(`usuarios/${user}/colheita`);

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

  if (!form || !listaPendentes || !listaPagos) return;

  let colheitaCache = [];
  let editando = false;
  let loading = false;
  let valorLata = parseFloat(localStorage.getItem('valorLataColheita')) || 0;

  function limparForm() {
    form.reset();
    idEdit.value = '';
    editando = false;
    btnSalvar.textContent = 'Salvar Registro';
    btnCancelar.classList.add('hidden');
    form.querySelectorAll('.erro-campo').forEach(el => el.classList.remove('erro-campo'));
    form.querySelectorAll('.msg-erro').forEach(el => el.remove());
    dataColheita.focus();
    pagoColheita.checked = true;
  }

  function mostrarErroCampo(input, msg) {
    input.classList.add('erro-campo');
    const msgEl = document.createElement('div');
    msgEl.className = 'msg-erro';
    msgEl.setAttribute('aria-live', 'polite');
    msgEl.style.color = '#f44336';
    msgEl.style.fontSize = '0.9em';
    msgEl.textContent = msg;
    input.parentNode.insertBefore(msgEl, input.nextSibling);
    input.focus();
  }

  function validarDados(dados) {
    let valido = true;
    if (!dados.data) {
      mostrarErroCampo(dataColheita, 'Informe a data.');
      valido = false;
    }
    if (!dados.colhedor) {
      mostrarErroCampo(colhedorColheita, 'Informe o colhedor.');
      valido = false;
    }
    if (!dados.quantidadeLatas || isNaN(dados.quantidadeLatas) || dados.quantidadeLatas <= 0) {
      mostrarErroCampo(quantidadeLatasColheita, 'Informe uma quantidade válida.');
      valido = false;
    }
    return valido;
  }

  function renderizarSugestoes() {
    const colhedores = new Set();
    colheitaCache.forEach(c => colhedores.add(c.colhedor));
    sugestoesColhedor.innerHTML = '';
    colhedores.forEach(nome => {
      sugestoesColhedor.innerHTML += `<option value="${nome}"></option>`;
    });
  }

  function renderizarResumo() {
    let latas = 0, pagos = 0, pendentes = 0;
    colheitaCache.forEach(reg => {
      latas += reg.quantidadeLatas;
      const total = reg.quantidadeLatas * valorLata;
      if (reg.pago) pagos += total;
      else pendentes += total;
    });
    resumo.innerHTML = `
      <h3>Resumo da Colheita</h3>
      <p><strong>Total de Latas:</strong> ${latas}</p>
      <p><strong>Total Pago:</strong> R$ ${pagos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
      <p><strong>Total Pendente:</strong> R$ ${pendentes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
    `;
  }

  function renderizarLista(lista, pago, filtro = '') {
    lista.innerHTML = '';
    const filtroLower = filtro.trim().toLowerCase();
    const filtrado = colheitaCache
      .filter(c => c.pago === pago && (
        !filtroLower || `${c.data} ${c.colhedor} ${c.quantidadeLatas}`.toLowerCase().includes(filtroLower)
      ));

    if (filtrado.length === 0) {
      lista.innerHTML = `<p style="text-align:center;color:#888;">Nenhum registro ${pago ? 'pago' : 'pendente'}.</p>`;
      return;
    }

    filtrado.sort((a, b) => b.timestamp - a.timestamp).forEach(reg => {
      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML = `
        <span>
          <strong>${reg.colhedor}</strong><br>
          Data: ${reg.data} | Latas: ${reg.quantidadeLatas} | Valor: R$ ${(reg.quantidadeLatas * valorLata).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
        </span>
        <div>
          <button class="botao-circular" title="${reg.pago ? 'Marcar como pendente' : 'Marcar como pago'}" data-id="${reg._id}" data-action="toggle"><i class="fas fa-${reg.pago ? 'undo' : 'check'}"></i></button>
          <button class="botao-circular azul" title="Editar" data-id="${reg._id}" data-action="edit"><i class="fas fa-edit"></i></button>
          <button class="botao-circular vermelho" title="Remover" data-id="${reg._id}" data-action="remove"><i class="fas fa-trash"></i></button>
        </div>
      `;
      lista.appendChild(div);
    });
  }

  function renderizarTudo() {
    renderizarLista(listaPendentes, false, filtroPendentes.value);
    renderizarLista(listaPagos, true, filtroPagos.value);
    renderizarResumo();
    renderizarSugestoes();
  }

  function carregarDados() {
    loading = true;
    dbRef.orderByChild('timestamp').on('value', snap => {
      colheitaCache = [];
      snap.forEach(child => {
        const val = child.val();
        val._id = child.key;
        colheitaCache.push(val);
      });
      renderizarTudo();
      loading = false;
    });
  }

  form.addEventListener('submit', e => {
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
    const ref = idEdit.value ? dbRef.child(idEdit.value) : dbRef.push();
    ref.set(dados)
      .then(() => {
        mostrarToast(idEdit.value ? 'Registro atualizado!' : 'Registro salvo!', 'sucesso');
        limparForm();
      })
      .catch(() => {
        mostrarToast('Erro ao salvar registro!', 'erro');
      })
      .finally(() => btnSalvar.disabled = false);
  });

  btnCancelar.addEventListener('click', limparForm);

  btnSalvarValorLata.addEventListener('click', () => {
    const valor = parseFloat(valorLataInput.value);
    if (isNaN(valor) || valor <= 0) {
      mostrarToast('Informe um valor válido!', 'erro');
      valorLataInput.focus();
      return;
    }
    valorLata = valor;
    localStorage.setItem('valorLataColheita', valor);
    renderizarResumo();
    mostrarToast('Valor salvo com sucesso!', 'sucesso');
  });

  filtroPendentes.addEventListener('input', () => renderizarLista(listaPendentes, false, filtroPendentes.value));
  filtroPagos.addEventListener('input', () => renderizarLista(listaPagos, true, filtroPagos.value));

  [listaPendentes, listaPagos].forEach(lista => {
    lista.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const item = colheitaCache.find(r => r._id === id);
      if (!item) return;

      if (action === 'edit') {
        dataColheita.value = item.data;
        colhedorColheita.value = item.colhedor;
        quantidadeLatasColheita.value = item.quantidadeLatas;
        pagoColheita.checked = item.pago;
        idEdit.value = id;
        editando = true;
        btnSalvar.textContent = 'Atualizar Registro';
        btnCancelar.classList.remove('hidden');
        form.classList.remove('hidden');
        dataColheita.focus();
        mostrarToast('Editando registro...', 'info');
      } else if (action === 'remove') {
        mostrarModalConfirmacao('Deseja remover este registro?', () => {
          dbRef.child(id).remove().then(() => {
            mostrarToast('Registro removido!', 'sucesso');
            if (idEdit.value === id) limparForm();
          }).catch(() => mostrarToast('Erro ao remover!', 'erro'));
        });
      } else if (action === 'toggle') {
        dbRef.child(id).update({ pago: !item.pago }).then(() => {
          mostrarToast(`Registro marcado como ${item.pago ? 'pendente' : 'pago'}!`, 'sucesso');
        }).catch(() => mostrarToast('Erro ao atualizar!', 'erro'));
      }
    });
  });

  // Inicialização
  valorLataInput.value = valorLata > 0 ? valorLata : '';
  carregarDados();
  limparForm();
});
