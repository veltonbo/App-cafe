// ===== FUNÇÃO: ALTERNAR TEMA CLARO/ESCURO =====
function alternarTema() {
  document.body.classList.toggle("claro");
  const temaAtual = document.body.classList.contains("claro") ? "claro" : "escuro";
  localStorage.setItem("tema", temaAtual);
}

// ===== FUNÇÃO: FAZER BACKUP =====
function fazerBackup() {
  const dados = {
    aplicacoes,
    tarefas,
    tarefasFeitas,
    financeiro,
    financeiroPago,
    colheitas,
    colheitasPagas
  };

  const blob = new Blob([JSON.stringify(dados)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "backup_manejo_cafe.json";
  link.click();
}

// ===== FUNÇÃO: IMPORTAR BACKUP =====
function importarBackup() {
  const arquivo = document.getElementById("arquivoBackup").files[0];
  if (!arquivo) {
    alert("Selecione um arquivo para importar.");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const dados = JSON.parse(e.target.result);
    aplicacoes = dados.aplicacoes || [];
    tarefas = dados.tarefas || [];
    tarefasFeitas = dados.tarefasFeitas || [];
    financeiro = dados.financeiro || [];
    financeiroPago = dados.financeiroPago || [];
    colheitas = dados.colheitas || [];
    colheitasPagas = dados.colheitasPagas || [];

    alert("Backup importado com sucesso!");
    carregarAplicacoes();
    carregarTarefas();
    carregarFinanceiro();
    carregarColheita();
  };
  reader.readAsText(arquivo);
}
