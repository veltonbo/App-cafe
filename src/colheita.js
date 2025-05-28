// ====== VARIÁVEIS ======
window.colheita = window.colheita || [];
let valorLataGlobal = 0;

// ====== CARREGAMENTO DO VALOR DA LATA ======
function carregarValorLata() {
  db.ref('ValorLata').on('value', snap => {
    if (snap.exists()) {
      valorLataGlobal = snap.val();
      document.getElementById('valorLata').value = valorLataGlobal;
    }
  });
}

function salvarValorLata() {
  valorLataGlobal = parseFloat(document.getElementById('valorLata').value) || 0;
  db.ref('ValorLata').set(valorLataGlobal);
}

// ====== ADIÇÃO DE LANÇAMENTO DE COLHEITA ======
function adicionarColheita() {
  const nova = {
    data: dataColheita.value,
    colhedor: colhedor.value.trim(),
    quantidade: parseFloat(quantidadeLatas.value),
    valorLata: valorLataGlobal,
    pago: false,
    pagoParcial: 0,
    historicoPagamentos: []
  };

  if (!nova.data || !nova.colhedor || isNaN(nova.quantidade) || nova.quantidade <= 0) {
    alert("Preencha todos os campos corretamente!");
    return;
  }

  colheita.push(nova);
  db.ref('Colheita').set(colheita);
  atualizarColheita();

  dataColheita.value = '';
  colhedor.value = '';
  quantidadeLatas.value = '';
}

// ====== CARREGAR COLHEITA ======
function carregarColheita() {
  db.ref('Colheita').on('value', snap => {
    const dados = snap.exists() ? Object.values(snap.val()) : [];
    if (JSON.stringify(window.colheita) !== JSON.stringify(dados)) {
      window.colheita = dados;
    }
    atualizarColheita();
  });
}

// ====== ATUALIZAR LISTA DE COLHEITA ======
function atualizarColheita() {
  var listaPendentes = document.getElementById('colheitaPendentes');
  var listaPagos = document.getElementById('colheitaPagos');
  if (listaPendentes) listaPendentes.innerHTML = '';
  if (listaPagos) listaPagos.innerHTML = '';
  (window.colheita || []).forEach((c, i) => {
    // ...restante do código do card de colheita...
  });

  const agrupadoPendentes = {};
  const agrupadoPagos = {};

  colheita.forEach((c, i) => {
    if (c.pagoParcial > 0) {
      if (!agrupadoPagos[c.colhedor]) agrupadoPagos[c.colhedor] = [];
      agrupadoPagos[c.colhedor].push({ ...c, quantidade: c.pagoParcial, pago: true, i });
    }
    if (c.quantidade > c.pagoParcial) {
      if (!agrupadoPendentes[c.colhedor]) agrupadoPendentes[c.colhedor] = [];
      agrupadoPendentes[c.colhedor].push({ ...c, quantidade: c.quantidade - c.pagoParcial, pago: false, i });
    }
  });

  montarGrupoColheita(agrupadoPendentes, colheitaPendentes, false);
  montarGrupoColheita(agrupadoPagos, colheitaPagos, true);
  atualizarResumoColheita();
  // Garante que o botão de filtro sempre aparece após atualizar as listas de colheita
  if (typeof criarBotaoFiltroLista === 'function') {
    criarBotaoFiltroLista('colheitaPendentes');
    criarBotaoFiltroLista('colheitaPagos');
  }
}

// ====== MONTAR LISTAGEM AGRUPADA ======
function montarGrupoColheita(grupo, container, pago) {
  container.innerHTML = '';
  for (const nome in grupo) {
    const bloco = document.createElement('div');
    bloco.className = 'bloco-colhedor';
    bloco.innerHTML = `<strong>${nome}</strong>`;

    grupo[nome].forEach(({ data, quantidade, i }) => {
      const item = document.createElement('div');
      item.className = 'item';
      item.innerHTML = `
        <span>${formatarDataBR(data)} - ${quantidade} latas</span>
        <div class="opcoes-wrapper">
          <button class="seta-menu-opcoes-padrao" aria-label="Abrir opções">&#8250;</button>
          <ul class="menu-opcoes-padrao-lista" style="display:none;">
            <li class='opcao-menu-padrao' data-acao='editar'>Editar</li>
            <li class='opcao-menu-padrao' data-acao='deletar'>Deletar</li>
          </ul>
        </div>
      `;
      const opcoesWrapper = item.querySelector('.opcoes-wrapper');
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
          }
        };
        // PADRÃO: clique nas opções do menu
        menu.querySelectorAll('.opcao-menu-padrao').forEach(opcao => {
          opcao.onclick = (e) => {
            e.stopPropagation();
            menu.classList.remove('aberta');
            menu.style.display = '';
            seta.setAttribute('aria-expanded', 'false');
            if (opcao.dataset.acao === 'editar') abrirModalColheita(true); /* implementar edição se necessário */
            if (opcao.dataset.acao === 'deletar') excluirColheita(i);
          };
        });
        document.addEventListener('click', function fecharMenu(e) {
          if (!item.contains(e.target)) {
            menu.classList.remove('aberta');
            menu.style.display = '';
            seta.setAttribute('aria-expanded', 'false');
          }
        }, { once: true });
      }
      bloco.appendChild(item);
    });

    container.appendChild(bloco);
  }
}

// ====== EXCLUIR COLHEITA ======
function excluirColheita(index) {
  if (confirm("Deseja excluir esse lançamento de colheita?")) {
    colheita.splice(index, 1);
    db.ref('Colheita').set(colheita);
    atualizarColheita();
  }
}

// ====== ATUALIZAR RESUMO COLHEITA ======
function atualizarResumoColheita() {
  const resumo = document.getElementById("resumoColheita");
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

// ====== GRÁFICOS (PODE SER IMPLEMENTADO DEPOIS) ======
function gerarGraficoColheita() {
  console.log("Gerar Gráfico de Colheita - Em desenvolvimento");
}

function gerarGraficoColhedor() {
  console.log("Gerar Gráfico de Colhedor - Em desenvolvimento");
}

function formatarValorBR(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatarDataBR(dataISO) {
  if (!dataISO) return '';
  const [ano, mes, dia] = dataISO.split('-');
  if (!ano || !mes || !dia) return dataISO;
  return `${dia}/${mes}/${ano}`;
}

// Atualiza selects de setor ao carregar setores dinâmicos
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function() {
    if (typeof atualizarSelectsSetor === 'function') atualizarSelectsSetor();
  });
}

// Garante que carregarColheita é chamado ao carregar dados globais
if (typeof window !== 'undefined') {
  document.addEventListener('dadosCarregados', carregarColheita);
}

// ===== LIMPAR CAMPOS DO MODAL DE COLHEITA =====
function limparCamposColheita() {
  document.getElementById('dataColheita').value = '';
  document.getElementById('colhedor').value = '';
  document.getElementById('quantidadeLatas').value = '';
  document.getElementById('valorLata').value = '';
  // Se houver outros campos, limpe-os aqui
}
