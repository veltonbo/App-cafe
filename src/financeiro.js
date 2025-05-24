// ===== VARIÁVEIS GLOBAIS =====
window.gastos = window.gastos || [];
let indiceEdicaoGasto = null;
<<<<<<< HEAD
let ignorarProximaAtualizacaoFinanceiro = false;
let refFinanceiro = null;
let listenerFinanceiro = null;
=======
>>>>>>> 8df9641 (Primeiro commit do projeto Manejo Café)

// ===== INICIALIZAR FINANCEIRO =====
function inicializarFinanceiro() {
  carregarFinanceiro();
}

// ===== ALTERNAR FORMULÁRIO FINANCEIRO =====
function alternarFormularioFinanceiro() {
  const form = document.getElementById("formularioFinanceiro");
  if (!form) return;
  form.style.display = form.style.display === "none" ? "block" : "none";
  resetarFormularioFinanceiro();
}

// ===== MOSTRAR CAMPOS DE PARCELAS =====
function mostrarCamposParcelas() {
  const camposParcelas = document.getElementById("camposParcelas");
  const parcelado = document.getElementById("parceladoFin").checked;
  camposParcelas.style.display = parcelado ? "block" : "none";
}

// ===== CARREGAR FINANCEIRO =====
function carregarFinanceiro() {
<<<<<<< HEAD
  if (refFinanceiro && listenerFinanceiro) {
    refFinanceiro.off('value', listenerFinanceiro);
  }
  refFinanceiro = db.ref('Financeiro');
  listenerFinanceiro = (snapshot) => {
=======
  db.ref('Financeiro').on('value', (snapshot) => {
>>>>>>> 8df9641 (Primeiro commit do projeto Manejo Café)
    const dados = snapshot.val() ? Object.values(snapshot.val()) : [];
    if (JSON.stringify(window.gastos) !== JSON.stringify(dados)) {
      window.gastos = dados;
    }
    atualizarFinanceiro();
<<<<<<< HEAD
    // Controle de carregamento de dados principais para notificações automáticas
    window.__dadosCarregados = window.__dadosCarregados || { tarefas: false, gastos: false };
    window.__dadosCarregados.gastos = true;
    if (window.__dadosCarregados.tarefas) {
      document.dispatchEvent(new Event('dadosCarregados'));
      window.__dadosCarregados = { tarefas: false, gastos: false };
    }
  };
  refFinanceiro.on('value', listenerFinanceiro);
=======
  });
>>>>>>> 8df9641 (Primeiro commit do projeto Manejo Café)
}

// ====== ADICIONAR OU EDITAR FINANCEIRO ======
function salvarOuEditarFinanceiro() {
  const novo = {
    data: document.getElementById('dataFin').value,
    produto: document.getElementById('produtoFin').value.trim(),
    descricao: document.getElementById('descricaoFin').value.trim(),
    valor: parseFloat(document.getElementById('valorFin').value),
    tipo: document.getElementById('tipoFin').value,
    pago: false, // ou lógica anterior
    parcelado: document.getElementById('parceladoFin')?.checked || false,
    numParcelas: parseInt(document.getElementById('parcelasFin')?.value) || 1
  };

  // Validação básica
  if (!novo.data || !novo.produto || isNaN(novo.valor) || novo.valor <= 0) {
    alert("Preencha todos os campos corretamente!");
    return;
  }

  if (indiceEdicaoGasto !== null) {
    // Editar gasto existente
    gastos[indiceEdicaoGasto] = novo;
    indiceEdicaoGasto = null;
  } else {
    if (novo.parcelado && novo.numParcelas > 1) {
      // Lançar várias parcelas
      const valorParcela = parseFloat((novo.valor / novo.numParcelas).toFixed(2));
      let somaParcelas = 0;
      for (let i = 1; i <= novo.numParcelas; i++) {
        // Corrige o valor da última parcela para fechar o total
        let valorAtual = (i === novo.numParcelas) ? (novo.valor - somaParcelas) : valorParcela;
        somaParcelas += valorAtual;
        // Calcula a data da parcela (mês a mês)
        let dataParcela = new Date(novo.data);
        dataParcela.setMonth(dataParcela.getMonth() + (i - 1));
        let dataFormatada = dataParcela.toISOString().split('T')[0];
        gastos.push({
          data: dataFormatada,
          produto: novo.produto + ` (Parcela ${i}/${novo.numParcelas})`,
          descricao: novo.descricao,
          valor: valorAtual,
          tipo: novo.tipo,
          pago: false, // Parcelas também começam como não pagas
          parcelado: true,
          parcelas: novo.numParcelas
        });
      }
    } else {
      // Adicionar novo gasto único
      gastos.push(novo);
    }
  }

<<<<<<< HEAD
  ignorarProximaAtualizacaoFinanceiro = true;
  if (refFinanceiro && listenerFinanceiro) {
    refFinanceiro.off('value', listenerFinanceiro);
  }
  db.ref("Financeiro").set(gastos).then(() => {
    if (refFinanceiro && listenerFinanceiro) {
      refFinanceiro.on('value', listenerFinanceiro);
    }
  });
=======
  db.ref("Financeiro").set(gastos);
>>>>>>> 8df9641 (Primeiro commit do projeto Manejo Café)
  atualizarFinanceiro();
  resetarFormularioFinanceiro();
  alternarFormularioFinanceiro();
  fecharModalFinanceiro();
}

// ===== CANCELAR EDIÇÃO =====
function cancelarEdicaoFinanceiro() {
  resetarFormularioFinanceiro();
  alternarFormularioFinanceiro();
}

// ===== RESETAR FORMULÁRIO =====
function resetarFormularioFinanceiro() {
  if (document.getElementById('dataFin')) dataFin.value = "";
  if (document.getElementById('produtoFin')) produtoFin.value = "";
  if (document.getElementById('descricaoFin')) descricaoFin.value = "";
  if (document.getElementById('valorFin')) valorFin.value = "";
  if (document.getElementById('tipoFin')) tipoFin.value = "Adubo";
  if (document.getElementById('parcelasFin')) parcelasFin.value = "";
  if (document.getElementById('parceladoFin')) parceladoFin.checked = false;
  if (document.getElementById('camposParcelas')) mostrarCamposParcelas();
  indiceEdicaoGasto = null;
  var btnCancelar = document.getElementById("btnCancelarFinanceiro");
  if (btnCancelar) btnCancelar.style.display = "none";
}

// ===== LIMPAR CAMPOS FINANCEIRO =====
function limparCamposFinanceiro() {
  if (document.getElementById('dataFin')) dataFin.value = "";
  if (document.getElementById('produtoFin')) produtoFin.value = "";
  if (document.getElementById('descricaoFin')) descricaoFin.value = "";
  if (document.getElementById('valorFin')) valorFin.value = "";
  if (document.getElementById('tipoFin')) tipoFin.value = "Adubo";
  if (document.getElementById('parcelasFin')) parcelasFin.value = "";
  if (document.getElementById('parceladoFin')) parceladoFin.checked = false;
  if (document.getElementById('camposParcelas')) mostrarCamposParcelas();
  indiceEdicaoGasto = null;
  var btnCancelar = document.getElementById("btnCancelarFinanceiro");
  if (btnCancelar) btnCancelar.style.display = "none";
}

// ===== FORMATAR VALOR EM REAL BRASILEIRO =====
function formatarValorBR(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ===== FORMATAR DATA NO PADRÃO BRASILEIRO =====
function formatarDataBR(dataISO) {
  if (!dataISO) return '';
  const [ano, mes, dia] = dataISO.split('-');
  if (!ano || !mes || !dia) return dataISO;
  return `${dia}/${mes}/${ano}`;
}

// ====== ATUALIZAR LISTAGEM DE GASTOS ======
function atualizarFinanceiro() {
  var lista = document.getElementById('financeiroLista');
  if (!lista) return;

  // Agrupar gastos por mês/ano e status (a vencer/pagos)
  const grupos = {};
  (window.gastos || []).forEach((gasto, i) => {
    if (!gasto.data) return;
    const [ano, mes] = gasto.data.split('-');
    const chave = `${ano}-${mes}`;
    if (!grupos[chave]) grupos[chave] = { aVencer: [], pagos: [] };
    if (!gasto.pago && !(gasto.descricao && gasto.descricao.toLowerCase().includes('pago')))
      grupos[chave].aVencer.push({ ...gasto, _index: i });
    else
      grupos[chave].pagos.push({ ...gasto, _index: i });
  });

  // Reorganiza para exibir sempre Janeiro, Fevereiro, ..., Dezembro para cada ano, na ordem correta
  const anos = Array.from(new Set(Object.keys(grupos).map(k => k.split('-')[0]))).sort((a, b) => Number(a) - Number(b));
  const mesesOrdem = [
    '01','02','03','04','05','06','07','08','09','10','11','12'
  ];
  const chavesOrdenadas = [];
  anos.forEach(ano => {
    mesesOrdem.forEach(mes => {
      const chave = `${ano}-${mes}`;
      if (grupos[chave]) chavesOrdenadas.push(chave);
    });
  });
  lista.innerHTML = '';
  // 1. Exibe por mês apenas os A Vencer
  chavesOrdenadas.forEach(chave => {
    const [ano, mes] = chave.split('-');
    const nomeMes = obterNomeMes(mes);
    const grupo = grupos[chave];
    if (grupo.aVencer.length) {
      // Total do mês (apenas a vencer)
      const totalMes = grupo.aVencer.reduce((s, g) => s + (g.valor || 0), 0);
      // Título do mês
      const titulo = document.createElement('h3');
      titulo.innerHTML = `${nomeMes} ${ano} <span style='font-size:0.8em;font-weight:400;color:#888;margin-left:12px;'>Total: ${formatarValorBR(totalMes)}</span>`;
      lista.appendChild(titulo);
      // Seção A Vencer
      const sub = document.createElement('div');
      sub.style.background = 'rgba(255, 193, 7, 0.07)';
      sub.style.border = '1.5px solid #ff9800';
      sub.style.borderRadius = '10px';
      sub.style.margin = '12px 0 28px 0';
      sub.style.padding = '10px 12px 8px 12px';
      sub.innerHTML = `<div style='font-weight:600;color:#ff9800;margin:0 0 8px 0;'>A vencer <span style="font-size:0.8em;font-weight:400;color:#888;margin-left:12px;">Total: ${formatarValorBR(totalMes)}</span></div>`;
      grupo.aVencer.sort((a, b) => b.data.localeCompare(a.data));
      grupo.aVencer.forEach(gasto => { renderizarCardFinanceiro(gasto, sub); });
      lista.appendChild(sub);
    }
  });

  // 2. Exibe todos os pagos juntos, agrupados e ordenados por data decrescente
  const todosPagos = [];
  chavesOrdenadas.forEach(chave => {
    const grupo = grupos[chave];
    if (grupo.pagos.length) {
      todosPagos.push(...grupo.pagos);
    }
  });
  if (todosPagos.length) {
    // Título geral dos pagos
    const tituloPagos = document.createElement('h3');
    tituloPagos.innerHTML = `Pagos <span style='font-size:0.8em;font-weight:400;color:#888;margin-left:12px;'>Total: ${formatarValorBR(todosPagos.reduce((s, g) => s + (g.valor || 0), 0))}</span>`;
    lista.appendChild(tituloPagos);
    // Seção Pagos
    const subPagos = document.createElement('div');
    subPagos.style.background = 'rgba(76, 175, 80, 0.07)';
    subPagos.style.border = '1.5px solid #4caf50';
    subPagos.style.borderRadius = '10px';
    subPagos.style.margin = '12px 0 32px 0';
    subPagos.style.padding = '10px 12px 8px 12px';
    subPagos.innerHTML = `<div style='font-weight:600;color:#4caf50;margin:0 0 8px 0;'>Pagos</div>`;
    todosPagos.sort((a, b) => b.data.localeCompare(a.data));
    todosPagos.forEach(gasto => { renderizarCardFinanceiro(gasto, subPagos); });
    lista.appendChild(subPagos);
  }
}

// Função para marcar um gasto como pago
function marcarFinanceiroPago(index) {
  if (!gastos[index]) return;
  gastos[index].pago = true;
<<<<<<< HEAD
  if (refFinanceiro && listenerFinanceiro) {
    refFinanceiro.off('value', listenerFinanceiro);
  }
  db.ref("Financeiro").set(gastos).then(() => {
    if (refFinanceiro && listenerFinanceiro) {
      refFinanceiro.on('value', listenerFinanceiro);
    }
  });
=======
  db.ref("Financeiro").set(gastos);
>>>>>>> 8df9641 (Primeiro commit do projeto Manejo Café)
  atualizarFinanceiro();
}

// ===== EDITAR GASTO =====
function editarFinanceiro(index) {
  const gasto = gastos[index];
  if (!gasto) return;
  if (document.getElementById('dataFin')) dataFin.value = gasto.data;
  if (document.getElementById('produtoFin')) produtoFin.value = gasto.produto;
  if (document.getElementById('descricaoFin')) descricaoFin.value = gasto.descricao || "";
  if (document.getElementById('valorFin')) valorFin.value = gasto.valor;
  if (document.getElementById('tipoFin')) tipoFin.value = gasto.tipo;
  if (document.getElementById('parceladoFin')) parceladoFin.checked = gasto.parcelado;
  if (document.getElementById('camposParcelas')) mostrarCamposParcelas();
  if (document.getElementById('parcelasFin')) parcelasFin.value = gasto.parcelas || "";
  indiceEdicaoGasto = index;
  if (document.getElementById('btnSalvarFinanceiro')) document.getElementById('btnSalvarFinanceiro').innerText = "Salvar Edição";
  abrirModalFinanceiro(true);
}

// ===== EXCLUIR GASTO =====
function excluirFinanceiro(index) {
  if (!confirm("Deseja excluir este lançamento financeiro?")) return;
  gastos.splice(index, 1);
<<<<<<< HEAD
  if (refFinanceiro && listenerFinanceiro) {
    refFinanceiro.off('value', listenerFinanceiro);
  }
  db.ref("Financeiro").set(gastos).then(() => {
    if (refFinanceiro && listenerFinanceiro) {
      refFinanceiro.on('value', listenerFinanceiro);
    }
  });
=======
  db.ref("Financeiro").set(gastos);
>>>>>>> 8df9641 (Primeiro commit do projeto Manejo Café)
  atualizarFinanceiro();
}

// Função para estornar um gasto pago
function estornarFinanceiro(index) {
  if (!gastos[index]) return;
  delete gastos[index].pago;
<<<<<<< HEAD
  if (refFinanceiro && listenerFinanceiro) {
    refFinanceiro.off('value', listenerFinanceiro);
  }
  db.ref("Financeiro").set(gastos).then(() => {
    if (refFinanceiro && listenerFinanceiro) {
      refFinanceiro.on('value', listenerFinanceiro);
    }
  });
=======
  db.ref("Financeiro").set(gastos);
>>>>>>> 8df9641 (Primeiro commit do projeto Manejo Café)
  atualizarFinanceiro();
}

// ===== INICIALIZAR FINANCEIRO =====
<<<<<<< HEAD
// Removido para evitar loop infinito:
// document.addEventListener("dadosCarregados", inicializarFinanceiro);
// if (typeof window !== 'undefined') {
//   document.addEventListener('dadosCarregados', carregarFinanceiro);
// }
=======
document.addEventListener("dadosCarregados", inicializarFinanceiro);
>>>>>>> 8df9641 (Primeiro commit do projeto Manejo Café)

// Garante que carregarFinanceiro é chamado ao carregar dados globais
if (typeof window !== 'undefined') {
  document.addEventListener('dadosCarregados', carregarFinanceiro);
}

// Função auxiliar para renderizar um card financeiro
function renderizarCardFinanceiro(gasto, lista) {
  const i = gasto._index;
<<<<<<< HEAD
<<<<<<<< HEAD:src/financeiro.js
=======
>>>>>>> 8df9641 (Primeiro commit do projeto Manejo Café)
  const item = document.createElement("div");
  item.className = "item";
  item.style.position = 'relative';
  item.innerHTML = `
    <span>${formatarDataBR(gasto.data)} - ${gasto.produto} - ${formatarValorBR(gasto.valor)} (${gasto.tipo})</span>
    <div class="opcoes-wrapper">
      <button class="seta-menu-opcoes-padrao" aria-label="Abrir opções">&#8250;</button>
      <ul class="menu-opcoes-padrao-lista" style="display:none;">
        <li class='opcao-menu-padrao' data-acao='editar'>Editar</li>
<<<<<<< HEAD
========
  const card = document.createElement("div");
  card.className = "financeiro-card" + (gasto.pago ? " pago" : "");
  card.innerHTML = `
    <div class="financeiro-card-top">
      <span class="financeiro-card-produto">${gasto.produto}</span>
      <span class="financeiro-card-valor">${formatarValorBR(gasto.valor)}</span>
    </div>
    <div class="financeiro-card-desc">${gasto.descricao ? gasto.descricao : "&nbsp;"}</div>
    <div class="financeiro-card-data">${formatarDataBR(gasto.data)}</div>
    <div class="financeiro-card-tipo">${gasto.tipo}</div>
    <div class="opcoes-wrapper">
      <button class="seta-menu-opcoes-padrao" aria-label="Abrir opções">&#8250;</button>
      <ul class="menu-opcoes-padrao-lista" style="display:none;">
        ${!gasto.pago ? "<li class='opcao-menu-padrao' data-acao='editar'>Editar</li>" : ''}
>>>>>>>> 8df9641 (Primeiro commit do projeto Manejo Café):App-cafe/src/financeiro.js
=======
>>>>>>> 8df9641 (Primeiro commit do projeto Manejo Café)
        <li class='opcao-menu-padrao' data-acao='deletar'>Deletar</li>
        <li class='opcao-menu-padrao' data-acao='estornar'>Estornar</li>
      </ul>
    </div>
  `;
<<<<<<< HEAD
  // Opções do menu
  const opcoesWrapper = card.querySelector('.opcoes-wrapper');
=======
  const opcoesWrapper = item.querySelector('.opcoes-wrapper');
>>>>>>> 8df9641 (Primeiro commit do projeto Manejo Café)
  const seta = opcoesWrapper.querySelector('.seta-menu-opcoes-padrao');
  const menu = opcoesWrapper.querySelector('.menu-opcoes-padrao-lista');
  if (seta && menu) {
    seta.onclick = (e) => {
      e.stopPropagation();
      document.querySelectorAll('.menu-opcoes-padrao-lista').forEach(m => {
        if (m !== menu) {
          m.classList.remove('aberta');
          m.style.display = '';
        }
      });
      const aberto = menu.classList.contains('aberta');
      if (aberto) {
        menu.classList.remove('aberta');
        menu.style.display = '';
        seta.setAttribute('aria-expanded', 'false');
      } else {
        menu.classList.add('aberta');
        menu.style.display = 'block';
        seta.setAttribute('aria-expanded', 'true');
<<<<<<< HEAD
<<<<<<<< HEAD:src/financeiro.js
========
        setTimeout(() => {
          function fecharMenuGlobal(e) {
            if (!card.contains(e.target)) {
              menu.classList.remove('aberta');
              menu.style.display = '';
              seta.setAttribute('aria-expanded', 'false');
              document.removeEventListener('mousedown', fecharMenuGlobal);
            }
          }
          document.addEventListener('mousedown', fecharMenuGlobal);
        }, 0);
>>>>>>>> 8df9641 (Primeiro commit do projeto Manejo Café):App-cafe/src/financeiro.js
      }
    };
=======
      }
    };
    // PADRÃO: clique nas opções do menu
>>>>>>> 8df9641 (Primeiro commit do projeto Manejo Café)
    menu.querySelectorAll('.opcao-menu-padrao').forEach(opcao => {
      opcao.onclick = (e) => {
        e.stopPropagation();
        menu.classList.remove('aberta');
        menu.style.display = '';
        seta.setAttribute('aria-expanded', 'false');
        if (opcao.dataset.acao === 'editar') editarFinanceiro(i);
        if (opcao.dataset.acao === 'deletar') excluirFinanceiro(i);
        if (opcao.dataset.acao === 'estornar') estornarFinanceiro(i);
      };
    });
    document.addEventListener('click', function fecharMenu(e) {
<<<<<<< HEAD
      if (!card.contains(e.target)) {
=======
      if (!item.contains(e.target)) {
>>>>>>> 8df9641 (Primeiro commit do projeto Manejo Café)
        menu.classList.remove('aberta');
        menu.style.display = '';
        seta.setAttribute('aria-expanded', 'false');
      }
    }, { once: true });
  }
<<<<<<< HEAD
  // Marcar como pago ao clicar no card (se não pago)
  if (!gasto.pago) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', (e) => {
      if (e.target.closest('.seta-menu-opcoes-padrao') || e.target.closest('.menu-opcoes-padrao-lista')) return;
      marcarFinanceiroPago(i);
    });
  }
  lista.appendChild(card);
}

// Controle de carregamento de dados principais para notificações automáticas
window.__dadosCarregados = window.__dadosCarregados || { tarefas: false, gastos: false };

function notificarSeAmbosCarregados() {
  if (window.__dadosCarregados.tarefas && window.__dadosCarregados.gastos) {
    document.dispatchEvent(new Event('dadosCarregados'));
    // Evita disparar mais de uma vez
    window.__dadosCarregados = { tarefas: false, gastos: false };
  }
}
// Ao final do carregamento real das tarefas:
if (Array.isArray(window.tarefas) && window.tarefas.length > 0) {
  window.__dadosCarregados.tarefas = true;
  notificarSeAmbosCarregados();
}
// Ao final do carregamento real dos gastos:
if (Array.isArray(window.gastos) && window.gastos.length > 0) {
  window.__dadosCarregados.gastos = true;
  notificarSeAmbosCarregados();
}

// ===== FILTRO E EXIBIÇÃO DO MENU FINANCEIRO MODERNO =====
function filtrarFinanceiro(filtro, btn) {
  document.querySelectorAll('.financeiro-filtro-btn').forEach(b => b.classList.remove('ativo'));
  if (btn) btn.classList.add('ativo');
  const listaApagar = document.getElementById('listaFinanceiroApagar');
  const listaPagos = document.getElementById('listaFinanceiroPagos');
  if (!listaApagar || !listaPagos) return;
  listaApagar.innerHTML = '';
  listaPagos.innerHTML = '';
  const gastos = window.gastos || [];
  const filtrados = gastos.filter(g => {
    if (filtro === 'apagar') return !g.pago && !(g.descricao && g.descricao.toLowerCase().includes('pago'));
    if (filtro === 'pagos') return g.pago || (g.descricao && g.descricao.toLowerCase().includes('pago'));
    return true;
  });
  filtrados.forEach((gasto, i) => {
    const card = document.createElement('div');
    card.className = 'item item-financeiro';
    card.innerHTML = `
      <span>${formatarDataBR(gasto.data)} - ${gasto.produto} - ${formatarValorBR(gasto.valor)} (${gasto.tipo})</span>
      <div class="opcoes-wrapper">
        <button class="seta-menu-opcoes-padrao" aria-label="Abrir opções">&#8250;</button>
        <ul class="menu-opcoes-padrao-lista" style="display:none;">
          ${!gasto.pago ? "<li class='opcao-menu-padrao' data-acao='editar'>Editar</li>" : ''}
          <li class='opcao-menu-padrao' data-acao='deletar'>Deletar</li>
          <li class='opcao-menu-padrao' data-acao='estornar'>Estornar</li>
        </ul>
      </div>
    `;
    // Opções do menu
    const opcoesWrapper = card.querySelector('.opcoes-wrapper');
    const seta = opcoesWrapper.querySelector('.seta-menu-opcoes-padrao');
    const menu = opcoesWrapper.querySelector('.menu-opcoes-padrao-lista');
    if (seta && menu) {
      seta.onclick = (e) => {
        e.stopPropagation();
        document.querySelectorAll('.menu-opcoes-padrao-lista').forEach(m => {
          if (m !== menu) {
            m.classList.remove('aberta');
            m.style.display = '';
          }
        });
        const aberto = menu.classList.contains('aberta');
        if (aberto) {
          menu.classList.remove('aberta');
          menu.style.display = '';
          seta.setAttribute('aria-expanded', 'false');
        } else {
          menu.classList.add('aberta');
          menu.style.display = 'block';
          seta.setAttribute('aria-expanded', 'true');
          setTimeout(() => {
            function fecharMenuGlobal(e) {
              if (!card.contains(e.target)) {
                menu.classList.remove('aberta');
                menu.style.display = '';
                seta.setAttribute('aria-expanded', 'false');
                document.removeEventListener('mousedown', fecharMenuGlobal);
              }
            }
            document.addEventListener('mousedown', fecharMenuGlobal);
          }, 0);
        }
      };
      menu.querySelectorAll('.opcao-menu-padrao').forEach(opcao => {
        opcao.onclick = (e) => {
          e.stopPropagation();
          menu.classList.remove('aberta');
          menu.style.display = '';
          seta.setAttribute('aria-expanded', 'false');
          if (opcao.dataset.acao === 'editar') editarFinanceiro(i);
          if (opcao.dataset.acao === 'deletar') excluirFinanceiro(i);
          if (opcao.dataset.acao === 'estornar') estornarFinanceiro(i);
        };
      });
      document.addEventListener('click', function fecharMenu(e) {
        if (!card.contains(e.target)) {
          menu.classList.remove('aberta');
          menu.style.display = '';
          seta.setAttribute('aria-expanded', 'false');
        }
      }, { once: true });
    }
    // Marcar como pago ao clicar no card (se não pago)
    if (!gasto.pago) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', (e) => {
        if (e.target.closest('.seta-menu-opcoes-padrao') || e.target.closest('.menu-opcoes-padrao-lista')) return;
        marcarFinanceiroPago(i);
      });
    }
    if (!gasto.pago && !(gasto.descricao && gasto.descricao.toLowerCase().includes('pago')))
      listaApagar.appendChild(card);
    else
      listaPagos.appendChild(card);
  });
=======
  // Marcar como pago ao clicar no card (apenas se mostrarMarcarPago)
  const mostrarMarcarPago = !gasto.pago && !(gasto.descricao && gasto.descricao.toLowerCase().includes('pago'));
  if (mostrarMarcarPago) {
    item.style.cursor = 'pointer';
    item.addEventListener('click', (e) => {
      if (e.target.closest('.seta-menu-financeiro') || e.target.closest('.menu-opcoes-financeiro-lista')) return;
      marcarFinanceiroPago(i);
    });
  }
  lista.appendChild(item);
>>>>>>> 8df9641 (Primeiro commit do projeto Manejo Café)
}
