// ===== IMPORTAÇÕES =====
import { db, auth } from './firebase-config.js';
import { saveDataOffline, loadDataOffline } from './offline-db.js';

// ===== VARIÁVEIS GLOBAIS =====
let colheita = [];
let valorLataGlobal = 0;

// ===== CARREGAR VALOR DA LATA =====
async function carregarValorLata() {
  try {
    if (navigator.onLine) {
      db.ref('ValorLata').on('value', snap => {
        if (snap.exists()) {
          valorLataGlobal = snap.val();
          document.getElementById('valorLata').value = valorLataGlobal;
          saveDataOffline('valorLata', { value: valorLataGlobal }).catch(console.error);
        }
      });
    } else {
      // Modo offline
      const dados = await loadDataOffline('valorLata');
      valorLataGlobal = dados?.value || 0;
      document.getElementById('valorLata').value = valorLataGlobal;
      mostrarNotificacao('Você está visualizando o valor da lata offline');
    }
  } catch (error) {
    console.error('Erro ao carregar valor da lata:', error);
    mostrarNotificacao('Erro ao carregar valor da lata', 'error');
  }
}

// ===== SALVAR VALOR DA LATA =====
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
    
    // Sempre salvar offline para ter o valor mais recente
    await saveDataOffline('valorLata', { value: valorLataGlobal });
    mostrarNotificacao('Valor da lata atualizado', 'success');
  } catch (error) {
    console.error('Erro ao salvar valor da lata:', error);
    mostrarNotificacao('Erro ao salvar valor da lata: ' + error.message, 'error');
  }
}

// ===== ADICIONAR COLHEITA =====
async function adicionarColheita() {
  if (!auth.currentUser) {
    mostrarNotificacao('Você precisa estar logado para adicionar colheitas', 'error');
    return;
  }

  const nova = {
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

  if (!nova.data || !nova.colhedor || isNaN(nova.quantidade) || nova.quantidade <= 0) {
    mostrarNotificacao("Preencha todos os campos corretamente!", 'error');
    return;
  }

  try {
    colheita.push(nova);
    
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
    console.error('Erro ao adicionar colheita:', error);
    mostrarNotificacao('Erro ao adicionar colheita: ' + error.message, 'error');
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
      const dados = await loadDataOffline('colheita');
      colheita = dados || [];
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
  const pendentes = document.getElementById("colheitaPendentes");
  const pagos = document.getElementById("colheitaPagos");
  
  pendentes.innerHTML = '';
  pagos.innerHTML = '';

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

  montarGrupoColheita(agrupadoPendentes, pendentes, false);
  montarGrupoColheita(agrupadoPagos, pagos, true);
  atualizarResumoColheita();
}

// ===== MONTAR LISTAGEM AGRUPADA =====
function montarGrupoColheita(grupo, container, pago) {
  for (const nome in grupo) {
    const bloco = document.createElement('div');
    bloco.className = 'bloco-colhedor';
    bloco.innerHTML = `<strong>${nome}</strong>`;

    grupo[nome].forEach(({ data, quantidade, i }) => {
      const div = document.createElement('div');
      div.className = 'item';
      
      const valor = (quantidade * valorLataGlobal).toFixed(2);
      
      div.innerHTML = `
        <span>${data} - ${quantidade} latas (R$ ${valor})</span>
        <div class="botoes-colheita">
          ${!pago ? `
            <button class="botao-circular verde" onclick="marcarComoPago(${i}, ${quantitude})">
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
async function marcarComoPago(index, quantidade) {
  if (!auth.currentUser) {
    mostrarNotificacao('Você precisa estar logado para marcar colheitas como pagas', 'error');
    return;
  }

  try {
    const colheitaItem = colheita[index];
    const valorPago = quantidade * valorLataGlobal;
    
    colheitaItem.pagoParcial = (colheitaItem.pagoParcial || 0) + quantidade;
    
    // Adicionar ao histórico de pagamentos
    colheitaItem.historicoPagamentos = colheitaItem.historicoPagamentos || [];
    colheitaItem.historicoPagamentos.push({
      data: new Date().toISOString().split('T')[0],
      quantidade,
      valor: valorPago,
      usuario: auth.currentUser.uid
    });

    // Verificar se está totalmente pago
    if (colheitaItem.pagoParcial >= colheitaItem.quantidade) {
      colheitaItem.pago = true;
    }
    
    if (navigator.onLine) {
      await db.ref('Colheita').set(colheita);
    } else {
      await saveDataOffline('colheita', colheita);
      mostrarNotificacao('Pagamento salvo localmente. Será sincronizado quando online.', 'info');
    }

    // Disparar evento de notificação
    document.dispatchEvent(new CustomEvent('colheitaPaga', {
      detail: {
        quantidade,
        colhedor: colheitaItem.colhedor
      }
    }));

    atualizarColheita();
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
  const totalPago = colheita.reduce((soma, c) => soma + (c.pagoParcial * c.valorLata), 0);
  const totalPendente = colheita.reduce((soma, c) => soma + ((c.quantidade - c.pagoParcial) * c.valorLata), 0);

  resumo.innerHTML = `
    <div><strong>Total de Latas:</strong> ${totalLatas.toFixed(2)}</div>
    <div><strong>Total Pago:</strong> R$ ${totalPago.toFixed(2)}</div>
    <div><strong>Total Pendente:</strong> R$ ${totalPendente.toFixed(2)}</div>
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
window.excluirColheita = excluirColheita;
window.marcarComoPago = marcarComoPago;
