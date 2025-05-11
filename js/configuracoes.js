// ===== ALTERNAR TEMA =====
function alternarTema() {
  document.body.classList.toggle('claro');
  localStorage.setItem('tema', document.body.classList.contains('claro') ? 'claro' : 'escuro');
}

// ===== CARREGAR TEMA SALVO =====
document.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem('tema') === 'claro') {
    document.body.classList.add('claro');
  }
});

// ===== FAZER BACKUP =====
function fazerBackup() {
  firebase.database().ref().once('value').then(snapshot => {
    const data = snapshot.val();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup_manejo_cafe_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
  });
}

// ===== IMPORTAR BACKUP =====
function importarBackup() {
  const fileInput = document.getElementById("arquivoBackup");
  const file = fileInput.files[0];

  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const data = JSON.parse(e.target.result);
      firebase.database().ref().set(data).then(() => {
        alert("Backup restaurado com sucesso!");
        location.reload();
      });
    };
    reader.readAsText(file);
  }
}
