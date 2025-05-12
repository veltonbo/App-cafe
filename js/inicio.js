// ===== INICIALIZAR A TELA DE INÍCIO =====
document.addEventListener("DOMContentLoaded", () => {
  atualizarResumoInicio();
  atualizarResumoFinanceiroInicio();
  atualizarUltimasAcoesInicio();
});

// ===== ATUALIZAR RESUMO DA TELA DE INÍCIO =====
function atualizarResumoInicio() {
  const totalLatasElement = document.getElementById("totalLatasInicio");
  const totalPagoElement = document.getElementById("totalPagoInicio");
  const totalPendenteElement = document.getElementById("totalPendenteInicio");

  let totalLatas = 0;
  let totalPago = 0;
  let totalPendente = 0;

  firebase.database().ref('Colheita').once('value').then(snapshot => {
    snapshot.forEach(snap => {
      const colheita = snap.val();
      totalLatas += parseFloat(colheita.quantidade || 0);
      totalPago += (colheita.pagoParcial || 0) * (colheita.valorLata || 0);
      totalPendente += ((colheita.quantidade - (colheita.pagoParcial || 0)) * (colheita.valorLata || 0));
    });

    if (totalLatasElement) totalLatasElement.innerText = totalLatas.toFixed(2);
    if (totalPagoElement) totalPagoElement.innerText = formatarValorBR(totalPago);
    if (totalPendenteElement) totalPendenteElement.innerText = formatarValorBR(totalPendente);
  });
}

// ===== ATUALIZAR RESUMO FINANCEIRO NA TELA INICIAL =====
function atualizarResumoFinanceiroInicio() {
  const totalReceitasElement = document.getElementById("totalReceitasInicio");
  const totalGastosElement = document.getElementById("totalGastosInicio");
  const saldoElement = document.getElementById("saldoInicio");

  let totalReceitas = 0;
  let totalGastos = 0;

  firebase.database().ref('financeiro').once('value').then(snapshot => {
    snapshot.forEach(snap => {
      const lanc = snap.val();
      if (lanc.tipo === 'receita') totalReceitas += Number(lanc.valor || 0);
      else totalGastos += Number(lanc.valor || 0);
    });

    const saldo = totalReceitas - totalGastos;
    if (totalReceitasElement) totalReceitasElement.innerText = formatarValorBR(totalReceitas);
    if (totalGastosElement) totalGastosElement.innerText = formatarValorBR(totalGastos);
    if (saldoElement) {
      saldoElement.innerText = formatarValorBR(saldo);
      saldoElement.style.color = saldo >= 0 ? "#4caf50" : "#f44336";
    }
  });
}

// ===== MOSTRAR ÚLTIMAS AÇÕES (APLICAÇÕES, TAREFAS, COLHEITAS) =====
function atualizarUltimasAcoesInicio() {
  const ultimasAplicacoesEl = document.getElementById("ultimasAplicacoesInicio");
  const ultimasTarefasEl = document.getElementById("ultimasTarefasInicio");
  const ultimasColheitasEl = document.getElementById("ultimasColheitasInicio");

  // Últimas aplicações
  firebase.database().ref('aplicacoes').orderByChild('timestamp').limitToLast(3).once('value').then(snapshot => {
    let arr = [];
    snapshot.forEach(snap => arr.push(snap.val()));
    arr = arr.reverse();
    if (ultimasAplicacoesEl) {
      ultimasAplicacoesEl.innerHTML = arr.length
        ? arr.map(app => `<li>${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}</li>`).join('')
        : "<li>Nenhuma aplicação recente.</li>";
    }
  });

  // Últimas tarefas
  firebase.database().ref('tarefas').orderByChild('timestamp').limitToLast(3).once('value').then(snapshot => {
    let arr = [];
    snapshot.forEach(snap => arr.push(snap.val()));
    arr = arr.reverse();
    if (ultimasTarefasEl) {
      ultimasTarefasEl.innerHTML = arr.length
        ? arr.map(t => `<li>${t.data} - ${t.descricao} (${t.prioridade}) - ${t.setor}</li>`).join('')
        : "<li>Nenhuma tarefa recente.</li>";
    }
  });

  // Últimas colheitas
  firebase.database().ref('Colheita').limitToLast(3).once('value').then(snapshot => {
    let arr = [];
    snapshot.forEach(snap => arr.push(snap.val()));
    arr = arr.reverse();
    if (ultimasColheitasEl) {
      ultimasColheitasEl.innerHTML = arr.length
        ? arr.map(c => `<li>${c.data} - ${c.colhedor} - ${Number(c.quantidade).toFixed(2)} latas</li>`).join('')
        : "<li>Nenhuma colheita recente.</li>";
    }
  });
}

// ===== FORMATAÇÃO DE VALOR EM REAL =====
function formatarValorBR(valor) {
  return "R$ " + Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}
