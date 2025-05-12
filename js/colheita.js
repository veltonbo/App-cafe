// ===== IMPORTAÇÕES =====
import { db, auth } from './firebase-config.js';
import { saveDataOffline, loadDataOffline } from './offline-db.js';

// ===== VARIÁVEIS GLOBAIS =====
let colheita = [];
let valorLataGlobal = 0;

// ===== CARREGAMENTO DO VALOR DA LATA =====
async function carregarValorLata() {
  try {
    if (navigator.onLine) {
      db.ref('ValorLata').on('value', snap => {
        if (snap.exists()) {
          valorLataGlobal = snap.val();
          document.getElementById('valorLata').value = valorLataGlobal;
          saveDataOffline('valorLata', valorLataGlobal).catch(console.error);
        }
      });
    } else {
      // Modo offline
      valorLataGlobal = await loadDataOffline('valorLata') || 0;
      document.getElementById('valorLata').value = valorLataGlobal;
      mostrarNotificacao('Você está visualizando o valor da lata offline');
    }
  } catch (error) {
    console.error('Erro ao carregar valor da lata:', error);
    mostrarNotificacao('Erro ao carregar valor da lata', 'error');
  }
}

async function salvarValorLata() {
  if (!auth.currentUser) {
    mostrarNotificacao('Você precisa estar logado para alterar o valor da lata', 'error');
    return;
  }

  try {
    valorLataGlobal = parseFloat(document.getElementById('valorLata').value) || 0;
    
    if (navigator.onLine) {
      await db.ref('ValorLata').set(valorLataGlobal);
    }
    
    await saveDataOffline('valorLata', valorLataGlobal);
    mostrarNotificacao('Valor da lata atualizado', 'success');
  } catch (error) {
    console.error('Erro ao salvar valor da lata:', error);
    mostrarNotificacao('Erro ao salvar valor da lata: ' + error.message, 'error');
  }
}

// ===== ADIÇÃO DE LANÇAMENTO DE COLHEITA =====
async function adicionarColheita() {
  if (!auth.currentUser) {
    mostrarNotificacao('Você precisa estar logado para adicionar colheitas', 'error');
    return;
  }

  const novaColheita = {
    data: dataColheita.value,
    colhedor: colhedor.value.trim(),
    quantidade: parseFloat(quantidadeLatas.value),
    valorLata: valorLataGlobal,
    pago: false,
    pagoParcial: 0,
    historicoPagamentos: [],
    usuario: auth.currentUser.uid,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  };

  if (!novaColheita.data || !novaColheita.colhedor || isNaN(novaColheita.quantidade) || novaColheita.quantidade <= 0) {
    mostrarNotificacao("Preencha todos os campos corretamente!", 'error');
    return;
  }

  try {
    colheita.push(novaColheita);
    
    if (navigator.onLine) {
      await db.ref('Colheita').set(colheita);
    } else {
      await saveDataOffline('colheita', colheita);
      mostrarNotificacao('Colheita salva localmente. Será sincronizada quando online.', 'info');
    }

    atualizarColheita();

    // Limpar campos
    dataColheita.value = '';
    colhedor.value = '';
    quantidadeLatas.value = '';
  } catch (error) {
    console.error('Erro ao salvar colheita:', error);
    mostrarNotificacao('Erro ao salvar colheita: ' + error.message, 'error');
  }
}

// ===== CARREGAR COLHEITA =====
async function carregarColheita() {
  try {
    if (navigator.onLine) {
      db.ref('Colheita').on('value', snap => {
        colheita = snap.exists() ? Object.values(snap.val()) : [];
        atualizarColheita();
        
        // Salvar offline
        if (colheita.length > 0) {
          saveDataOffline('colheita', colheita).catch(console.error);
        }
      });
    } else {
      // Modo offline
      colheita = await loadDataOffline('colheita') || [];
      atualizarColheita();
      mostrarNotificacao('Você está visualizando dados offline da colheita');
    }
  } catch (error) {
    console.error('Erro ao carregar colheita:', error);
    mostrarNotificacao('Erro ao carregar dados da colheita', 'error');
  }
}

// ===== ATUALIZAR LISTA DE COLHEITA =====
function atualizarColheita() {
  const colheitaPendentes = document.getElementById("colheitaPendentes");
  const colheitaPagos = document.getElementById("colheitaPagos");
  
  colheitaPendentes.innerHTML = '';
  colheitaPagos.innerHTML = '';

  const agrupadoPendentes = {};
  const agrupadoPagos = {};

  // Ordenar colheita por data (mais recente primeiro)
  const colheitaOrdenada = [...colheita].sort((a, b) => new Date(b.data) - new Date(a.data));

  colheitaOrdenada.forEach((c, i) => {
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
}

// ===== MONTAR LISTAGEM AGRUPADA =====
function montarGrupoColheita(grupo, container, pago) {
  for (const nome in grupo) {
    const bloco = document.createElement('div');
    bloco.className = 'bloco-colhedor';
    
    // Calcular total para este colhedor
    const totalLatas = grupo[nome].reduce((sum, c) => sum + c.quantidade, 0);
    const totalValor = totalLatas * (grupo[nome][0].valorLata || valorLataGlobal);
    
    bloco.innerHTML = `
      <div class="colhedor-header">
        <strong>${nome}</strong>
        <span>Total: ${totalLatas.toFixed(2)} latas (R$ ${totalValor.toFixed(2)})</span>
      </div>
    `;

    grupo[nome].forEach(({ data, quantidade, i }) => {
      const div = document.createElement('div');
      div.className = 'item';
      
      const valor = quantidade * (grupo[nome][0].valorLata || valorLataGlobal);
      
      div.innerHTML = `
        <span>${data} - ${quantidade} latas (R$ ${valor.toFixed(2)})</span>
        <div class="botoes-colheita">
          ${!pago ? `
            <button class="botao-circular verde" onclick="marcarColheitaComoPaga(${i}, ${quantitude})">
              <i class="fas fa-check"></i>
            </button>
          ` : ''}
          <button class="botao-circular vermelho" onclick="excluirColheita(${i})">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
      bloco.appendChild(div);
    });

    container.appendChild(bloco);
  }
}

// ===== MARCAR COLHEITA COMO PAGA =====
async function marcarColheitaComoPaga(index, quantidade = null) {
  if (!auth.currentUser) {
    mostrarNotificacao('Você precisa estar logado para marcar colheitas como pagas', 'error');
    return;
  }

  try {
    const valorLata = colheita[index].valorLata || valorLataGlobal;
    const qtdPagar = quantidade || (colheita[index].quantidade - (colheita[index].pagoParcial || 0));
    
    if (qtdPagar <= 0) return;

    const valorPago = qtdPagar * valorLata;
    const dataPagamento = new Date().toISOString().split('T')[0];

    // Registrar pagamento no histórico
    const pagamento = {
      data: dataPagamento,
      quantidade: qtdPagar,
      valor: valorPago,
      usuario: auth.currentUser.uid
    };

    colheita[index].historicoPagamentos = colheita[index].historicoPagamentos || [];
    colheita[index].historicoPagamentos.push(pagamento);
    
    // Atualizar valores
    colheita[index].pagoParcial = (colheita[index].pagoParcial || 0) + qtdPagar;
    if (colheita[index].pagoParcial >= colheita[index].quantidade) {
      colheita[index].pago = true;
    }

    if (navigator.onLine) {
      await db.ref('Colheita').set(colheita);
    } else {
      await saveDataOffline('colheita', colheita);
      mostrarNotificacao('Pagamento registrado localmente. Será sincronizado quando online.', 'info');
    }

    atualizarColheita();
    
    // Disparar evento personalizado
    document.dispatchEvent(new CustomEvent('colheitaPaga', {
      detail: {
        colhedor: colheita[index].colhedor,
        quantidade: qtdPagar,
        valor: valorPago,
        data: dataPagamento
      }
    }));
  } catch (error) {
    console.error('Erro ao marcar colheita como paga:', error);
    mostrarNotificacao('Erro ao marcar colheita como paga: ' + error.message, 'error');
  }
}

// ===== EXCLUIR COLHEITA =====
async function excluirColheita(index) {
  if (!confirm("Deseja excluir esse lançamento de colheita?")) return;
  
  try {
    colheita.splice(index, 1);
    
    if (navigator.onLine) {
      await db.ref('Colheita').set(colheita);
    } else {
      await saveDataOffline('colheita', colheita);
      mostrarNotificacao('Exclusão salva localmente. Será sincronizada quando online.', 'info');
    }

    atualizarColheita();
  } catch (error) {
    console.error('Erro ao excluir colheita:', error);
    mostrarNotificacao('Erro ao excluir colheita: ' + error.message, 'error');
  }
}

// ===== ATUALIZAR RESUMO COLHEITA =====
function atualizarResumoColheita() {
  const resumo = document.getElementById("resumoColheita");
  if (!resumo) return;

  const totalLatas = colheita.reduce((soma, c) => soma + c.quantidade, 0);
  const totalPago = colheita.reduce((soma, c) => soma + ((c.pagoParcial || 0) * (c.valorLata || valorLataGlobal)), 0);
  const totalPendente = colheita.reduce((soma, c) => soma + ((c.quantidade - (c.pagoParcial || 0)) * (c.valorLata || valorLataGlobal)), 0);

  resumo.innerHTML = `
    <div><strong>Total de Latas:</strong> ${totalLatas.toFixed(2)}</div>
    <div><strong>Total Pago:</strong> R$ ${totalPago.toFixed(2)}</div>
    <div><strong>Total Pendente:</strong> R$ ${totalPendente.toFixed(2)}</div>
    <div><strong>Valor da Lata Atual:</strong> R$ ${valorLataGlobal.toFixed(2)}</div>
  `;
}

// ===== INICIALIZAR COLHEITA =====
document.addEventListener("dadosCarregados", () => {
  carregarValorLata();
  carregarColheita();
});

// Exportar funções para uso no HTML
window.adicionarColheita = adicionarColheita;
window.salvarValorLata = salvarValorLata;
window.marcarColheitaComoPaga = marcarColheitaComoPaga;
window.excluirColheita = excluirColheita;
