// js/configuracoes.js - Versão Melhorada

document.addEventListener('DOMContentLoaded', () => {
  const anoAtual = new Date().getFullYear();
  const elAnoSafra = document.getElementById("anoSafraAtual");
  const selectSafra = document.getElementById("safraSelecionada");
  const btnFecharSafra = document.getElementById("btnFecharSafra");
  const btnRestaurarSafra = document.getElementById("btnRestaurarSafra");
  const btnDeletarSafra = document.getElementById("btnDeletarSafra");
  const btnBackup = document.getElementById("btnBackup");
  const btnImportar = document.getElementById("btnImportarBackup");
  const inputBackup = document.getElementById("arquivoBackup");
  const btnTema = document.getElementById("btnAlternarTema");

  // ===== TEMA CLARO/ESCURO =====
  if (btnTema) {
    btnTema.addEventListener('click', () => {
      document.body.classList.toggle('claro');
      localStorage.setItem('tema', document.body.classList.contains('claro') ? 'claro' : 'escuro');
      mostrarToast('Tema alterado!', 'info');
    });
    if (localStorage.getItem('tema') === 'claro') {
      document.body.classList.add('claro');
    }
  }

  // ===== CARREGAR ANO DA SAFRA ATUAL =====
  function carregarAnoSafra() {
    if (elAnoSafra) elAnoSafra.innerText = anoAtual;
  }

  // ====== CARREGAR SAFRAS DISPONÍVEIS ======
  function carregarSafrasDisponiveis() {
    if (!selectSafra) return;
    selectSafra.innerHTML = "<option value=''>Selecione o ano</option>";
    db.ref().once("value").then(snapshot => {
      const data = snapshot.val() || {};
      Object.keys(data).forEach(key => {
        if (!["Aplicacoes", "Tarefas", "Financeiro", "Colheita", "ValorLata"].includes(key)) {
          const option = document.createElement("option");
          option.value = key;
          option.innerText = key;
          selectSafra.appendChild(option);
        }
      });
    });
  }

  // ===== FECHAR SAFRA ATUAL (ARQUIVAR) =====
  if (btnFecharSafra) {
    btnFecharSafra.addEventListener('click', () => {
      if (window.Swal) {
        Swal.fire({
          title: `Fechar safra ${anoAtual}?`,
          text: "Isso arquivará os dados atuais.",
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: 'Sim, fechar',
          cancelButtonText: 'Cancelar'
        }).then(result => {
          if (result.isConfirmed) fecharSafraAtual();
        });
      } else {
        if (confirm(`Deseja fechar a safra ${anoAtual}? Isso arquivará os dados atuais.`)) fecharSafraAtual();
      }
    });
  }

  function fecharSafraAtual() {
    mostrarToast('Fechando safra...', 'info');
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
      return db.ref(anoAtual.toString()).set(dados).then(() => {
        // Limpar dados da safra atual
        db.ref("Aplicacoes").remove();
        db.ref("Tarefas").remove();
        db.ref("Financeiro").remove();
        db.ref("Colheita").remove();
        db.ref("ValorLata").remove();
        mostrarToast(`Safra ${anoAtual} fechada com sucesso.`, 'sucesso');
        setTimeout(() => location.reload(), 1000);
      });
    });
  }

  // ===== RESTAURAR SAFRA ARQUIVADA =====
  if (btnRestaurarSafra) {
    btnRestaurarSafra.addEventListener('click', () => {
      const safra = selectSafra.value;
      if (!safra) return mostrarToast("Selecione uma safra para restaurar.", "erro");
      if (window.Swal) {
        Swal.fire({
          title: `Restaurar safra ${safra}?`,
          text: "Isso substituirá os dados atuais.",
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: 'Sim, restaurar',
          cancelButtonText: 'Cancelar'
        }).then(result => {
          if (result.isConfirmed) restaurarSafra();
        });
      } else {
        if (confirm(`Restaurar dados da safra ${safra}? Isso substituirá os dados atuais.`)) restaurarSafra();
      }
    });
  }

  function restaurarSafra() {
    const safra = selectSafra.value;
    if (!safra) {
      mostrarToast("Selecione uma safra para restaurar.", "erro");
      return;
    }
    mostrarToast('Restaurando safra...', 'info');
    db.ref(safra).once("value").then(snap => {
      const dados = snap.val();
      if (!dados) {
        mostrarToast("Dados da safra não encontrados.", "erro");
        return;
      }
      db.ref("Aplicacoes").set(dados.Aplicacoes || []);
      db.ref("Tarefas").set(dados.Tarefas || []);
      db.ref("Financeiro").set(dados.Financeiro || []);
      db.ref("Colheita").set(dados.Colheita || []);
      db.ref("ValorLata").set(dados.ValorLata || 0);
      mostrarToast(`Safra ${safra} restaurada com sucesso.`, "sucesso");
      setTimeout(() => location.reload(), 1000);
    });
  }

  // ===== DELETAR SAFRA DEFINITIVAMENTE =====
  if (btnDeletarSafra) {
    btnDeletarSafra.addEventListener('click', () => {
      const safra = selectSafra.value;
      if (!safra) return mostrarToast("Selecione uma safra para deletar.", "erro");
      if (window.Swal) {
        Swal.fire({
          title: `Excluir safra ${safra}?`,
          text: "Esta ação não poderá ser desfeita.",
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: 'Sim, excluir',
          cancelButtonText: 'Cancelar'
        }).then(result => {
          if (result.isConfirmed) deletarSafra();
        });
      } else {
        if (confirm(`Deseja excluir permanentemente a safra ${safra}? Esta ação não poderá ser desfeita.`)) deletarSafra();
      }
    });
  }

  function deletarSafra() {
    const safra = selectSafra.value;
    if (!safra) {
      mostrarToast("Selecione uma safra para deletar.", "erro");
      return;
    }
    mostrarToast('Deletando safra...', 'info');
    db.ref(safra).remove().then(() => {
      mostrarToast(`Safra ${safra} deletada com sucesso.`, "sucesso");
      carregarSafrasDisponiveis();
    });
  }

  // ===== BACKUP MANUAL =====
  if (btnBackup) {
    btnBackup.addEventListener('click', fazerBackup);
  }

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
      mostrarToast("Backup gerado com sucesso!", "sucesso");
    });
  }

  // ===== IMPORTAR BACKUP =====
  if (btnImportar && inputBackup) {
    btnImportar.addEventListener('click', importarBackup);
  }

  function importarBackup() {
    const file = inputBackup.files[0];
    if (!file) return mostrarToast("Nenhum arquivo selecionado.", "erro");

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const dados = JSON.parse(e.target.result);
        db.ref("Aplicacoes").set(dados.Aplicacoes || []);
        db.ref("Tarefas").set(dados.Tarefas || []);
        db.ref("Financeiro").set(dados.Financeiro || []);
        db.ref("Colheita").set(dados.Colheita || []);
        db.ref("ValorLata").set(dados.ValorLata || 0);
        mostrarToast("Backup importado com sucesso.", "sucesso");
        setTimeout(() => location.reload(), 1000);
      } catch (error) {
        mostrarToast("Erro ao importar o backup. Verifique o arquivo.", "erro");
      }
    };
    reader.readAsText(file);
  }

  // ====== INICIALIZAR ======
  carregarAnoSafra();
  carregarSafrasDisponiveis();
});

// ====== TOAST DE FEEDBACK ======
function mostrarToast(msg, tipo = 'info', tempo = 2500) {
  if (window.mostrarToast) {
    window.mostrarToast(msg, tipo, tempo);
    return;
  }
  // Fallback simples
  alert(msg);
}
