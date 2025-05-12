// ===== IMPORTAÇÕES =====
import { db, auth } from './firebase-config.js';
import { saveDataOffline } from './offline-db.js';

// ===== VARIÁVEIS =====
let anoAtual = new Date().getFullYear();

// ===== TEMA CLARO/ESCURO =====
function alternarTema() {
  document.body.classList.toggle('claro');
  const tema = document.body.classList.contains('claro') ? 'claro' : 'escuro';
  localStorage.setItem('tema', tema);
  
  // Atualizar gráficos se existirem
  if (window.graficoAplicacoes) window.graficoAplicacoes.update();
  if (window.graficoFinanceiro) window.graficoFinanceiro.update();
  if (window.graficoColheita) window.graficoColheita.update();
}

// ===== CARREGAR ANO DA SAFRA ATUAL =====
function carregarAnoSafra() {
  document.getElementById("anoSafraAtual").innerText = anoAtual;
}

// ===== CARREGAR SAFRAS DISPONÍVEIS =====
async function carregarSafrasDisponiveis() {
  const select = document.getElementById("safraSelecionada");
  if (!select) return;

  select.innerHTML = "<option value=''>Selecione o ano</option>";
  
  try {
    if (navigator.onLine) {
      const snapshot = await db.ref().once("value");
      const data = snapshot.val() || {};
      
      // Adicionar anos disponíveis (exceto os nós principais)
      Object.keys(data).forEach(key => {
        if (!["Aplicacoes", "Tarefas", "Financeiro", "Colheita", "ValorLata"].includes(key)) {
          const option = document.createElement("option");
          option.value = key;
          option.innerText = key;
          select.appendChild(option);
        }
      });
    } else {
      mostrarNotificacao('Você precisa estar online para carregar safras disponíveis', 'error');
    }
  } catch (error) {
    console.error('Erro ao carregar safras:', error);
    mostrarNotificacao('Erro ao carregar safras disponíveis', 'error');
  }
}

// ===== FECHAR SAFRA ATUAL (ARQUIVAR) =====
async function fecharSafraAtual() {
  if (!auth.currentUser) {
    mostrarNotificacao('Você precisa estar logado para fechar a safra', 'error');
    return;
  }

  if (!confirm(`Deseja fechar a safra ${anoAtual}? Isso arquivará os dados atuais.`)) return;

  try {
    const [app, tar, fin, col, lata] = await Promise.all([
      db.ref("Aplicacoes").once("value"),
      db.ref("Tarefas").once("value"),
      db.ref("Financeiro").once("value"),
      db.ref("Colheita").once("value"),
      db.ref("ValorLata").once("value")
    ]);

    const dados = {
      Aplicacoes: app.val() || [],
      Tarefas: tar.val() || [],
      Financeiro: fin.val() || [],
      Colheita: col.val() || [],
      ValorLata: lata.val() || 0,
      dataFechamento: new Date().toISOString(),
      usuarioFechamento: auth.currentUser.uid
    };

    await db.ref(anoAtual.toString()).set(dados);
    
    // Limpar dados da safra atual
    await Promise.all([
      db.ref("Aplicacoes").remove(),
      db.ref("Tarefas").remove(),
      db.ref("Financeiro").remove(),
      db.ref("Colheita").remove(),
      db.ref("ValorLata").remove(),
      saveDataOffline('aplicacoes', []),
      saveDataOffline('tarefas', []),
      saveDataOffline('financeiro', []),
      saveDataOffline('colheita', []),
      saveDataOffline('valorLata', 0)
    ]);

    mostrarNotificacao(`Safra ${anoAtual} fechada com sucesso!`, 'success');
    setTimeout(() => location.reload(), 2000);
  } catch (error) {
    console.error('Erro ao fechar safra:', error);
    mostrarNotificacao('Erro ao fechar safra: ' + error.message, 'error');
  }
}

// ===== RESTAURAR SAFRA ARQUIVADA =====
async function restaurarSafra() {
  if (!auth.currentUser) {
    mostrarNotificacao('Você precisa estar logado para restaurar safras', 'error');
    return;
  }

  const safra = document.getElementById("safraSelecionada").value;
  if (!safra) {
    mostrarNotificacao("Selecione uma safra para restaurar.", 'error');
    return;
  }

  if (!confirm(`Restaurar dados da safra ${safra}? Isso substituirá os dados atuais.`)) return;

  try {
    const snapshot = await db.ref(safra).once("value");
    const dados = snapshot.val();
    if (!dados) {
      mostrarNotificacao("Dados da safra não encontrados.", 'error');
      return;
    }

    await Promise.all([
      db.ref("Aplicacoes").set(dados.Aplicacoes || []),
      db.ref("Tarefas").set(dados.Tarefas || []),
      db.ref("Financeiro").set(dados.Financeiro || []),
      db.ref("Colheita").set(dados.Colheita || []),
      db.ref("ValorLata").set(dados.ValorLata || 0),
      saveDataOffline('aplicacoes', dados.Aplicacoes || []),
      saveDataOffline('tarefas', dados.Tarefas || []),
      saveDataOffline('financeiro', dados.Financeiro || []),
      saveDataOffline('colheita', dados.Colheita || []),
      saveDataOffline('valorLata', dados.ValorLata || 0)
    ]);

    mostrarNotificacao(`Safra ${safra} restaurada com sucesso!`, 'success');
    setTimeout(() => location.reload(), 2000);
  } catch (error) {
    console.error('Erro ao restaurar safra:', error);
    mostrarNotificacao('Erro ao restaurar safra: ' + error.message, 'error');
  }
}

// ===== DELETAR SAFRA DEFINITIVAMENTE =====
async function deletarSafra() {
  if (!auth.currentUser) {
    mostrarNotificacao('Você precisa estar logado para deletar safras', 'error');
    return;
  }

  const safra = document.getElementById("safraSelecionada").value;
  if (!safra) {
    mostrarNotificacao("Selecione uma safra para deletar.", 'error');
    return;
  }

  if (!confirm(`Deseja excluir permanentemente a safra ${safra}? Esta ação não poderá ser desfeita.`)) return;

  try {
    await db.ref(safra).remove();
    mostrarNotificacao(`Safra ${safra} deletada com sucesso!`, 'success');
    carregarSafrasDisponiveis();
  } catch (error) {
    console.error('Erro ao deletar safra:', error);
    mostrarNotificacao('Erro ao deletar safra: ' + error.message, 'error');
  }
}

// ===== BACKUP MANUAL =====
async function fazerBackup() {
  if (!auth.currentUser) {
    mostrarNotificacao('Você precisa estar logado para fazer backup', 'error');
    return;
  }

  try {
    const [app, tar, fin, col, lata] = await Promise.all([
      db.ref("Aplicacoes").once("value"),
      db.ref("Tarefas").once("value"),
      db.ref("Financeiro").once("value"),
      db.ref("Colheita").once("value"),
      db.ref("ValorLata").once("value")
    ]);

    const backup = {
      Aplicacoes: app.val() || [],
      Tarefas: tar.val() || [],
      Financeiro: fin.val() || [],
      Colheita: col.val() || [],
      ValorLata: lata.val() || 0,
      dataBackup: new Date().toISOString(),
      usuarioBackup: auth.currentUser.uid
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup_manejo_cafe_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    
    mostrarNotificacao('Backup criado com sucesso!', 'success');
  } catch (error) {
    console.error('Erro ao criar backup:', error);
    mostrarNotificacao('Erro ao criar backup: ' + error.message, 'error');
  }
}

// ===== IMPORTAR BACKUP =====
async function importarBackup() {
  if (!auth.currentUser) {
    mostrarNotificacao('Você precisa estar logado para importar backup', 'error');
    return;
  }

  const input = document.getElementById("arquivoBackup");
  const file = input.files[0];
  if (!file) {
    mostrarNotificacao("Nenhum arquivo selecionado.", 'error');
    return;
  }

  try {
    const dados = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(JSON.parse(e.target.result));
      reader.onerror = e => reject(new Error('Erro ao ler arquivo'));
      reader.readAsText(file);
    });

    if (!dados.Aplicacoes || !dados.Tarefas || !dados.Financeiro || !dados.Colheita) {
      throw new Error('Formato de backup inválido');
    }

    await Promise.all([
      db.ref("Aplicacoes").set(dados.Aplicacoes || []),
      db.ref("Tarefas").set(dados.Tarefas || []),
      db.ref("Financeiro").set(dados.Financeiro || []),
      db.ref("Colheita").set(dados.Colheita || []),
      db.ref("ValorLata").set(dados.ValorLata || 0),
      saveDataOffline('aplicacoes', dados.Aplicacoes || []),
      saveDataOffline('tarefas', dados.Tarefas || []),
      saveDataOffline('financeiro', dados.Financeiro || []),
      saveDataOffline('colheita', dados.Colheita || []),
      saveDataOffline('valorLata', dados.ValorLata || 0)
    ]);

    mostrarNotificacao("Backup importado com sucesso!", 'success');
    setTimeout(() => location.reload(), 2000);
  } catch (error) {
    console.error('Erro ao importar backup:', error);
    mostrarNotificacao('Erro ao importar backup: ' + error.message, 'error');
  } finally {
    input.value = '';
  }
}

// ===== INICIALIZAR CONFIGURAÇÕES =====
document.addEventListener("dadosCarregados", () => {
  carregarAnoSafra();
  carregarSafrasDisponiveis();
});

// Exportar funções para uso no HTML
window.alternarTema = alternarTema;
window.fecharSafraAtual = fecharSafraAtual;
window.restaurarSafra = restaurarSafra;
window.deletarSafra = deletarSafra;
window.fazerBackup = fazerBackup;
window.importarBackup = importarBackup;
