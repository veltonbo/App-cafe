// ===== INICIALIZAR CONFIGURAÇÕES =====
function inicializarConfiguracao() {
  const temaAtual = localStorage.getItem("tema") || "claro";
  document.body.classList.toggle("tema-escuro", temaAtual === "escuro");
  document.getElementById("temaConfiguracao").value = temaAtual;
}

// ===== ALTERAR TEMA (CLARO/ESCURO) =====
function alterarTema() {
  const tema = document.getElementById("temaConfiguracao").value;
  document.body.classList.toggle("tema-escuro", tema === "escuro");
  localStorage.setItem("tema", tema);
}

// ===== REALIZAR BACKUP =====
function realizarBackup() {
  const dados = {
    aplicacoes: localStorage.getItem("aplicacoes") || "[]",
    tarefas: localStorage.getItem("tarefas") || "[]",
    financeiro: localStorage.getItem("financeiro") || "[]",
    colheitas: localStorage.getItem("colheitas") || "[]",
    relatorios: localStorage.getItem("relatorios") || "[]"
  };

  const blob = new Blob([JSON.stringify(dados)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "backup_manejo_cafe.json";
  link.click();
}

// ===== RESTAURAR BACKUP =====
function restaurarBackup() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const dados = JSON.parse(e.target.result);
        localStorage.setItem("aplicacoes", dados.aplicacoes);
        localStorage.setItem("tarefas", dados.tarefas);
        localStorage.setItem("financeiro", dados.financeiro);
        localStorage.setItem("colheitas", dados.colheitas);
        localStorage.setItem("relatorios", dados.relatorios);
        alert("Backup restaurado com sucesso!");
        location.reload();
      };
      reader.readAsText(file);
    }
  };
  input.click();
}
