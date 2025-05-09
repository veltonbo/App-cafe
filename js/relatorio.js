// ===== FUNÇÃO: GERAR RELATÓRIO =====
function gerarRelatorioCompleto() {
  const relatorioResultado = document.getElementById("relatorioResultado");
  relatorioResultado.innerHTML = `
    <h4>Relatório Completo</h4>
    <p>Total de Aplicações: ${aplicacoes.length}</p>
    <p>Total de Tarefas: ${tarefas.length} | Feitas: ${tarefasFeitas.length}</p>
    <p>Total Financeiro: ${financeiro.length} | Pagos: ${financeiroPago.length}</p>
    <p>Total de Colheitas: ${colheitas.length} | Pagas: ${colheitasPagas.length}</p>
  `;
}
