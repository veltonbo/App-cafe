// ===== FUNÇÃO: ALTERNAR TEMA CLARO/ESCURO =====
function alternarTema() {
  document.body.classList.toggle("claro");
  const temaAtual = document.body.classList.contains("claro") ? "claro" : "escuro";
  localStorage.setItem("tema", temaAtual);
}

// ===== FUNÇÃO: CARREGAR ANO DA SAFRA =====
function carregarAnoSafra() {
  const anoAtual = new Date().getFullYear();
  document.getElementById("anoSafraAtual").textContent = anoAtual;
}

// ===== FUNÇÃO: FECHAR SAFRA ATUAL =====
function fecharSafraAtual() {
  const anoAtual = new Date().getFullYear();
  const confirmacao = confirm(`Deseja fechar a safra de ${anoAtual}?`);
  if (confirmacao) {
    alert(`Safra de ${anoAtual} fechada com sucesso!`);
    carregarAnoSafra();
  }
}

// ===== FUNÇÃO: CARREGAR SAFRAS DISPONÍVEIS =====
function carregarSafrasDisponiveis() {
  const selectSafra = document.getElementById("safraSelecionada");
  selectSafra.innerHTML = `
    <option value="2023">2023</option>
    <option value="2024">2024</option>
    <option value="2025">2025</option>
  `;
}

// ===== FUNÇÃO: RESTAURAR SAFRA =====
function restaurarSafra() {
  const safraSelecionada = document.getElementById("safraSelecionada").value;
  if (safraSelecionada === "") {
    alert("Selecione uma safra para restaurar.");
    return;
  }

  alert(`Safra ${safraSelecionada} restaurada com sucesso!`);
}

// ===== FUNÇÃO: DELETAR SAFRA =====
function deletarSafra() {
  const safraSelecionada = document.getElementById("safraSelecionada").value;
  if (safraSelecionada === "") {
    alert("Selecione uma safra para deletar.");
    return;
  }

  if (confirm(`Deseja realmente deletar a safra ${safraSelecionada}?`)) {
    alert(`Safra ${safraSelecionada} deletada com sucesso!`);
  }
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
  };
  reader.readAsText(arquivo);
}

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
  carregarAnoSafra();
  carregarSafrasDisponiveis();
  if (localStorage.getItem("tema") === "claro") {
    document.body.classList.add("claro");
  }
});
