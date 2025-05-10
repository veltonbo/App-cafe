// ===== VARIÁVEIS =====
let anoAtual = new Date().getFullYear();

// ===== TEMA CLARO/ESCURO =====
function alternarTema() {
  document.body.classList.toggle('claro');
  localStorage.setItem('tema', document.body.classList.contains('claro') ? 'claro' : 'escuro');
}

// ===== CARREGAR ANO DA SAFRA ATUAL =====
function carregarAnoSafra() {
  document.getElementById("anoSafraAtual").innerText = anoAtual;
}

// ===== CARREGAR SAFRAS DISPONÍVEIS PARA RESTAURAR =====
function carregarSafrasDisponiveis() {
  const select = document.getElementById("safraSelecionada");
  select.innerHTML = "<option value=''>Selecione o ano</option>";
  db.ref().once("value").then(snapshot => {
    Object.keys(snapshot.val() || {}).forEach(key => {
      if (!["Aplicacoes", "Tarefas", "Financeiro", "Colheita", "ValorLata"].includes(key)) {
        const option = document.createElement("option");
        option.value = key;
        option.innerText = key;
        select.appendChild(option);
      }
    });
  });
}

// ===== FECHAR SAFRA ATUAL (ARQUIVAR) =====
function fecharSafraAtual() {
  const confirmacao = confirm(`Deseja fechar a safra ${anoAtual}? Isso arquivará os dados atuais.`);
  if (!confirmacao) return;

  Promise.all([
    db.ref("Aplicacoes").once("value"),
    db.ref("Tarefas").once("value"),
    db.ref("Financeiro").once("value"),
    db.ref("Colheita").once("value"),
    db.ref("ValorLata").once("value")
  ]).then(([app, tar, fin, col, lata]) => {
    const dados = {
      Aplicacoes: app.val() || [],
      Tarefas: tar.val() || [],
      Financeiro: fin.val() || [],
      Colheita: col.val() || [],
      ValorLata: lata.val() || 0
    };
    return db.ref(anoAtual).set(dados).then(() => {
      db.ref("Aplicacoes").remove();
      db.ref("Tarefas").remove();
      db.ref("Financeiro").remove();
      db.ref("Colheita").remove();
      db.ref("ValorLata").remove();
      alert(`Safra ${anoAtual} fechada com sucesso.`);
      location.reload();
    });
  });
}

// ===== RESTAURAR SAFRA ARQUIVADA =====
function restaurarSafra() {
  const safra = document.getElementById("safraSelecionada").value;
  if (!safra) {
    alert("Selecione uma safra para restaurar.");
    return;
  }
  const confirmar = confirm(`Restaurar dados da safra ${safra}? Isso substituirá os dados atuais.`);
  if (!confirmar) return;

  db.ref(safra).once("value").then(snap => {
    const dados = snap.val();
    if (!dados) {
      alert("Dados da safra não encontrados.");
      return;
    }
    return Promise.all([
      db.ref("Aplicacoes").set(dados.Aplicacoes || []),
      db.ref("Tarefas").set(dados.Tarefas || []),
      db.ref("Financeiro").set(dados.Financeiro || []),
      db.ref("Colheita").set(dados.Colheita || []),
      db.ref("ValorLata").set(dados.ValorLata || 0)
    ]).then(() => {
      alert(`Safra ${safra} restaurada com sucesso.`);
      location.reload();
    });
  });
}

// ===== DELETAR SAFRA DEFINITIVAMENTE =====
function deletarSafra() {
  const safra = document.getElementById("safraSelecionada").value;
  if (!safra) {
    alert("Selecione uma safra para deletar.");
    return;
  }
  const confirmar = confirm(`Deseja excluir permanentemente a safra ${safra}? Esta ação não poderá ser desfeita.`);
  if (!confirmar) return;

  db.ref(safra).remove().then(() => {
    alert(`Safra ${safra} deletada com sucesso.`);
    carregarSafrasDisponiveis();
  });
}

// ===== BACKUP MANUAL =====
function fazerBackup() {
  const backup = {};
  Promise.all([
    db.ref("Aplicacoes").once("value"),
    db.ref("Tarefas").once("value"),
    db.ref("Financeiro").once("value"),
    db.ref("Colheita").once("value"),
    db.ref("ValorLata").once("value")
  ]).then(([app, tar, fin, col, lata]) => {
    backup.Aplicacoes = app.val() || [];
    backup.Tarefas = tar.val() || [];
    backup.Financeiro = fin.val() || [];
    backup.Colheita = col.val() || [];
    backup.ValorLata = lata.val() || 0;

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup_manejo_cafe_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  });
}

function importarBackup() {
  const input = document.getElementById("arquivoBackup");
  const file = input.files[0];
  if (!file) return alert("Nenhum arquivo selecionado.");

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const dados = JSON.parse(e.target.result);
      Promise.all([
        db.ref("Aplicacoes").set(dados.Aplicacoes || []),
        db.ref("Tarefas").set(dados.Tarefas || []),
        db.ref("Financeiro").set(dados.Financeiro || []),
        db.ref("Colheita").set(dados.Colheita || []),
        db.ref("ValorLata").set(dados.ValorLata || 0)
      ]).then(() => {
        alert("Backup importado com sucesso!");
        location.reload();
      });
    } catch (err) {
      alert("Erro ao importar o backup. Verifique se o arquivo é válido.");
    }
  };
  reader.readAsText(file);
}
