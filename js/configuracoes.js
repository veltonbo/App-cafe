// ===== VERIFICAR CONEXÃO COM O FIREBASE =====
document.addEventListener("DOMContentLoaded", verificarConexaoFirebase);

function verificarConexaoFirebase() {
  db.ref(".info/connected").on("value", (snap) => {
    const status = snap.val() ? "✅ Conectado ao Firebase" : "⚠️ Desconectado do Firebase";
    document.getElementById("statusFirebase").innerText = status;
  });
}

// ===== LIMPAR TODOS OS DADOS =====
function limparTodosOsDados() {
  if (confirm("Tem certeza que deseja limpar todos os dados? Esta ação não pode ser desfeita.")) {
    db.ref("/").set(null);
    alert("Todos os dados foram apagados.");
  }
}

// ===== EXPORTAR BACKUP =====
function exportarBackup() {
  db.ref("/").once("value").then(snapshot => {
    const data = snapshot.val();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `backup_manejo_cafe_${new Date().toISOString().split("T")[0]}.json`;
    link.click();
  });
}

// ===== IMPORTAR BACKUP =====
function importarBackup() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        db.ref("/").set(data);
        alert("Backup importado com sucesso.");
      } catch (error) {
        alert("Erro ao importar o backup. Verifique o arquivo.");
      }
    };
    reader.readAsText(file);
  };
  input.click();
}
