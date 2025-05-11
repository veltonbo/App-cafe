// ===== INICIALIZAR A TELA DE INÍCIO =====
document.addEventListener("DOMContentLoaded", () => {
  atualizarResumoInicio();
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
    });

    totalLatasElement.innerText = totalLatas.toFixed(2);
    totalPagoElement.innerText = formatarValorBR(totalPago);
    totalPendenteElement.innerText = formatarValorBR(totalPendente);
  });
}
