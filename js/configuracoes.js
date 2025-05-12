// ===== VARIÁVEIS =====
let anoAtual = new Date().getFullYear();

// ===== TEMA CLARO/ESCURO =====
function alternarTema() {
  document.body.classList.toggle('claro');
  const temaAtual = document.body.classList.contains('claro') ? 'claro' : 'escuro';
  localStorage.setItem('tema', temaAtual);
}

// ===== CARREGAR TEMA PREFERIDO =====
function carregarTema() {
  const temaSalvo = localStorage.getItem('tema') || 'escuro';
  if (temaSalvo === 'claro') {
    document.body.classList.add('claro');
  } else {
    document.body.classList.remove('claro');
  }
}

// ===== CARREGAR ANO DA SAFRA ATUAL =====
function carregarAnoSafra() {
  document.getElementById("anoSafraAtual").innerText = anoAtual;
}

// ====== GERENCIAR SAFRAS ======
function carregarSafrasDisponiveis() {
  const select = document.getElementById("safraSelecionada");
  if (!select) return;

  select.innerHTML = "<option value=''>Selecione o ano</option>";
  db.ref().once("value").then(snapshot => {
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

// ===== FECHAR SAFRA ATUAL (ARQUIVAR) =====
function fecharSafraAtual() {
  if (!confirm(`Deseja fechar a safra ${anoAtual}? Isso arquivará os dados atuais.`)) return;

  const dadosAtuais = {
    Aplicacoes: aplicacoes || [],
    Tarefas: tarefas || [],
    Financeiro: gastos || [],
    Colheita: colheita || [],
    ValorLata: valorLataGlobal || 0
  };

  db.ref(anoAtual.toString()).set(dadosAtuais).then(() => {
    db.ref("Aplicacoes").remove();
    db.ref("Tarefas").remove();
    db.ref("Financeiro").remove();
    db.ref("Colheita").remove();
    db.ref("ValorLata").remove();
    mostrarSucesso(`Safra ${anoAtual} fechada com sucesso.`);
    location.reload();
  });
}

// ===== RESTAURAR SAFRA ARQUIVADA =====
function restaurarSafra() {
  const safra = document.getElementById("safraSelecionada").value;
  if (!safra) {
    mostrarErro("Selecione uma safra para restaurar.");
    return;
  }

  db.ref(safra).once("value").then(snap => {
    const dados = snap.val();
    if (!dados) {
      mostrarErro("Dados da safra não encontrados.");
      return;
    }

    db.ref("Aplicacoes").set(dados.Aplicacoes || []);
    db.ref("Tarefas").set(dados.Tarefas || []);
    db.ref("Financeiro").set(dados.Financeiro || []);
    db.ref("Colheita").set(dados.Colheita || []);
    db.ref("ValorLata").set(dados.ValorLata || 0);
    
    mostrarSucesso(`Safra ${safra} restaurada com sucesso.`);
    location.reload();
  });
}

// ===== DELETAR SAFRA DEFINITIVAMENTE =====
function deletarSafra() {
  const safra = document.getElementById("safraSelecionada").value;
  if (!safra) {
    mostrarErro("Selecione uma safra para deletar.");
    return;
  }

  if (!confirm(`Deseja excluir permanentemente a safra ${safra}? Esta ação não poderá ser desfeita.`)) return;

  db.ref(safra).remove().then(() => {
    mostrarSucesso(`Safra ${safra} deletada com sucesso.`);
    carregarSafrasDisponiveis();
  });
}

// ===== BACKUP MANUAL =====
function fazerBackup() {
  const backup = {
    Aplicacoes: aplicacoes || [],
    Tarefas: tarefas || [],
    Financeiro: gastos || [],
    Colheita: colheita || [],
    ValorLata: valorLataGlobal || 0
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backup_manejo_cafe_${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  mostrarSucesso("Backup realizado com sucesso.");
}

// ===== IMPORTAR BACKUP =====
function importarBackup() {
  const input = document.getElementById("arquivoBackup");
  const file = input.files[0];
  if (!file) return mostrarErro("Nenhum arquivo selecionado.");

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const dados = JSON.parse(e.target.result);
      db.ref("Aplicacoes").set(dados.Aplicacoes || []);
      db.ref("Tarefas").set(dados.Tarefas || []);
      db.ref("Financeiro").set(dados.Financeiro || []);
      db.ref("Colheita").set(dados.Colheita || []);
      db.ref("ValorLata").set(dados.ValorLata || 0);
      
      mostrarSucesso("Backup importado com sucesso.");
      location.reload();
    } catch {
      mostrarErro("Erro ao importar o backup. Verifique o arquivo.");
    }
  };
  reader.readAsText(file);
}

// ===== FEEDBACK VISUAL (SWEETALERT) =====
function mostrarSucesso(mensagem) {
  Swal.fire({
    icon: 'success',
    title: 'Sucesso!',
    text: mensagem,
    timer: 2000,
    showConfirmButton: false
  });
}

function mostrarErro(mensagem) {
  Swal.fire({
    icon: 'error',
    title: 'Erro!',
    text: mensagem,
    timer: 2000,
    showConfirmButton: false
  });
}

// ===== INICIALIZAR CONFIGURAÇÕES =====
document.addEventListener("dadosCarregados", () => {
  carregarTema();
  carregarAnoSafra();
  carregarSafrasDisponiveis();
});
