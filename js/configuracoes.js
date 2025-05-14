let anoAtual = new Date().getFullYear();

// ====== TEMA CLARO/ESCURO ======
function alternarTema() {
  document.body.classList.toggle("claro");
  localStorage.setItem("tema", document.body.classList.contains("claro") ? "claro" : "escuro");
}

// ====== Obter usuário atual ======
function getCurrentUser() {
  return localStorage.getItem("gm_cafe_current_user");
}

// ====== CARREGAR ANO SAFRA ======
function carregarAnoSafra() {
  document.getElementById("anoSafraAtual").innerText = anoAtual;
}

// ====== CARREGAR SAFRAS DISPONÍVEIS ======
function carregarSafrasDisponiveis() {
  const select = document.getElementById("safraSelecionada");
  const user = getCurrentUser();
  if (!select || !user) return;

  select.innerHTML = "<option value=''>Selecione o ano</option>";
  db.ref(`usuarios/${user}`).once("value").then(snapshot => {
    const data = snapshot.val() || {};
    Object.keys(data).forEach(key => {
      if (!["Aplicacoes", "Tarefas", "Financeiro", "Colheita", "ValorLata"].includes(key)) {
        const option = document.createElement("option");
        option.value = key;
        option.innerText = key;
        select.appendChild(option);
      }
    });
  });
}

// ====== FECHAR SAFRA ATUAL ======
function fecharSafraAtual() {
  const user = getCurrentUser();
  if (!user || !confirm(`Deseja fechar a safra ${anoAtual}? Isso arquivará os dados atuais.`)) return;

  const base = db.ref(`usuarios/${user}`);

  Promise.all([
    base.child("Aplicacoes").once("value"),
    base.child("Tarefas").once("value"),
    base.child("Financeiro").once("value"),
    base.child("Colheita").once("value"),
    base.child("ValorLata").once("value")
  ]).then(([app, tar, fin, col, lata]) => {
    const dados = {
      Aplicacoes: app.val() || [],
      Tarefas: tar.val() || [],
      Financeiro: fin.val() || [],
      Colheita: col.val() || [],
      ValorLata: lata.val() || 0
    };
    return base.child(anoAtual.toString()).set(dados).then(() => {
      base.child("Aplicacoes").remove();
      base.child("Tarefas").remove();
      base.child("Financeiro").remove();
      base.child("Colheita").remove();
      base.child("ValorLata").remove();
      alert(`Safra ${anoAtual} fechada com sucesso.`);
      location.reload();
    });
  });
}

// ====== RESTAURAR SAFRA ======
function restaurarSafra() {
  const user = getCurrentUser();
  const safra = document.getElementById("safraSelecionada").value;
  if (!user || !safra) return alert("Selecione uma safra para restaurar.");

  if (!confirm(`Restaurar dados da safra ${safra}? Isso substituirá os dados atuais.`)) return;

  const base = db.ref(`usuarios/${user}`);
  base.child(safra).once("value").then(snap => {
    const dados = snap.val();
    if (!dados) return alert("Dados da safra não encontrados.");

    base.child("Aplicacoes").set(dados.Aplicacoes || []);
    base.child("Tarefas").set(dados.Tarefas || []);
    base.child("Financeiro").set(dados.Financeiro || []);
    base.child("Colheita").set(dados.Colheita || []);
    base.child("ValorLata").set(dados.ValorLata || 0);

    alert(`Safra ${safra} restaurada com sucesso.`);
    location.reload();
  });
}

// ====== DELETAR SAFRA ======
function deletarSafra() {
  const user = getCurrentUser();
  const safra = document.getElementById("safraSelecionada").value;
  if (!user || !safra) return alert("Selecione uma safra para deletar.");

  if (!confirm(`Deseja excluir permanentemente a safra ${safra}? Esta ação não poderá ser desfeita.`)) return;

  db.ref(`usuarios/${user}/${safra}`).remove().then(() => {
    alert(`Safra ${safra} deletada com sucesso.`);
    carregarSafrasDisponiveis();
    localStorage.removeItem("safraSelecionada");
  });
}

// ====== BACKUP MANUAL ======
function fazerBackup() {
  const user = getCurrentUser();
  if (!user) return;

  const backup = {};
  const base = db.ref(`usuarios/${user}`);

  Promise.all([
    base.child("Aplicacoes").once("value"),
    base.child("Tarefas").once("value"),
    base.child("Financeiro").once("value"),
    base.child("Colheita").once("value"),
    base.child("ValorLata").once("value")
  ]).then(([app, tar, fin, col, lata]) => {
    backup.Aplicacoes = app.val() || [];
    backup.Tarefas = tar.val() || [];
    backup.Financeiro = fin.val() || [];
    backup.Colheita = col.val() || [];
    backup.ValorLata = lata.val() || 0;

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup_manejo_cafe_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  });
}

// ====== IMPORTAR BACKUP ======
function importarBackup() {
  const user = getCurrentUser();
  const input = document.getElementById("arquivoBackup");
  const file = input?.files?.[0];
  if (!user || !file) return alert("Nenhum arquivo selecionado.");

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const dados = JSON.parse(e.target.result);
      const base = db.ref(`usuarios/${user}`);
      base.child("Aplicacoes").set(dados.Aplicacoes || []);
      base.child("Tarefas").set(dados.Tarefas || []);
      base.child("Financeiro").set(dados.Financeiro || []);
      base.child("Colheita").set(dados.Colheita || []);
      base.child("ValorLata").set(dados.ValorLata || 0);

      alert("Backup importado com sucesso.");
      location.reload();
    } catch (error) {
      alert("Erro ao importar o backup. Verifique o arquivo.");
    }
  };
  reader.readAsText(file);
}

// ====== INICIALIZAR CONFIGURAÇÕES ======
document.addEventListener("DOMContentLoaded", () => {
  carregarAnoSafra();
  carregarSafrasDisponiveis();

  document.getElementById("btnAlternarTema")?.addEventListener("click", alternarTema);
  document.getElementById("btnFazerBackup")?.addEventListener("click", fazerBackup);
  document.getElementById("arquivoBackup")?.addEventListener("change", importarBackup);
});
