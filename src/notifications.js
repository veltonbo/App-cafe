// Sistema simples de notificações para contas a pagar e tarefas do dia

// Buffer global para notificações
window._notificacoesBuffer = window._notificacoesBuffer || [];

function mostrarNotificacao(mensagem, tipo = 'info') {
  // Adiciona ao buffer
  window._notificacoesBuffer.push({ mensagem, tipo, lida: false });
  renderizarNotificacoesModal();
}

function sanitizeMensagem(mensagem) {
  // Remove tags <i>, <svg>, <span> e emojis de toda a mensagem
  return mensagem
    // Remove qualquer tag <i>, <svg>, <span> e seus conteúdos (inclusive aninhados)
    .replace(/<[^>]*>/gi, '') // Remove todas as tags HTML
    // Remove emojis comuns
    .replace(/[\u2700-\u27BF\uE000-\uF8FF\uD83C-\uDBFF\uDC00-\uDFFF\u2600-\u26FF\u2700-\u27BF]/g, '')
    .trim();
}

// Chama debug ao renderizar
function renderizarNotificacoesModal() {
  const modalLista = document.getElementById('notificacoesModalLista');
  if (!modalLista) return;
  modalLista.innerHTML = '';
  if (!window._notificacoesBuffer.length) {
    modalLista.innerHTML = '<div style="color:#888;text-align:center;margin:24px 0;">Nenhuma notificação.</div>';
    return;
  }
  window._notificacoesBuffer.forEach(n => {
    const notif = document.createElement('div');
    notif.className = 'notificacao ' + n.tipo + (n.lida ? '' : ' nao-lida');
    if (n.tipo === 'alerta') {
      // Sanitiza mensagem para não duplicar ícone
      const mensagemLimpa = sanitizeMensagem(n.mensagem);
      notif.innerHTML = '<span style="display:inline-flex;align-items:center;justify-content:center;margin-right:12px;width:32px;height:32px;background:linear-gradient(135deg,#f44336 60%,#b71c1c 100%);border-radius:50%;box-shadow:0 2px 8px #f4433622;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v4M12 16h.01"/><path d="M21 18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7l5 5v9z"/></svg></span>' + mensagemLimpa;
    } else {
      notif.innerHTML = n.mensagem;
    }
    modalLista.appendChild(notif);
  });
}

function verificarContasAPagar(contas) {
  const hoje = new Date().toISOString().split('T')[0];
  // Corrigido: usar campo 'data' como data de vencimento
  const contasVencendoHoje = contas.filter(c => c.data === hoje && !c.pago);
  const contasAtrasadas = contas.filter(c => c.data < hoje && !c.pago);
  if (contasVencendoHoje.length > 0) {
    mostrarNotificacao(`Você tem ${contasVencendoHoje.length} conta(s) a pagar hoje!`, 'alerta');
  }
  if (contasAtrasadas.length > 0) {
    mostrarNotificacao(`Você tem ${contasAtrasadas.length} conta(s) em atraso!`, 'alerta');
  }
}

function verificarTarefasDoDia(tarefas) {
  const hoje = new Date().toISOString().split('T')[0];
  const tarefasHoje = tarefas.filter(t => t.data === hoje && !t.feita);
  const tarefasAtrasadas = tarefas.filter(t => t.data < hoje && !t.feita);
  if (tarefasHoje.length > 0) {
    mostrarNotificacao(`Você tem ${tarefasHoje.length} tarefa(s) para fazer hoje!`, 'alerta');
  }
  if (tarefasAtrasadas.length > 0) {
    mostrarNotificacao(`Você tem ${tarefasAtrasadas.length} tarefa(s) em atraso!`, 'alerta');
  }
}

// Exemplo de uso: chamar essas funções após carregar dados
function verificarNotificacoes() {
  // Limpa notificações antigas do buffer
  window._notificacoesBuffer = [];
  renderizarNotificacoesModal();
  console.log('verificarNotificacoes chamada:', {
    tarefas: window.tarefas,
    gastos: window.gastos
  });
  if (Array.isArray(window.gastos) && window.gastos.length > 0) {
    verificarContasAPagar(window.gastos);
  } else {
    console.log('Nenhum gasto carregado para notificação.');
  }
  if (Array.isArray(window.tarefas) && window.tarefas.length > 0) {
    verificarTarefasDoDia(window.tarefas);
  } else {
    console.log('Nenhuma tarefa carregada para notificação.');
  }
  renderizarNotificacoesModal();
}

// Atualização do badge com efeito visual no botão
function atualizarBadgeNotificacoes(qtd) {
  const badge = document.getElementById('notificacoes-badge');
  const btnNotificacao = document.getElementById('btn-notificacoes');
  
  if (!badge || !btnNotificacao) return;
  
  if (qtd > 0) {
    badge.innerText = qtd > 99 ? '99+' : qtd;
    badge.classList.remove('oculto');
    btnNotificacao.classList.add('tem-notificacao');
  } else {
    badge.classList.add('oculto');
    btnNotificacao.classList.remove('tem-notificacao');
  }
}

// Função utilitária para garantir notificações sempre atualizadas ao abrir o modal
window.forcarAtualizacaoNotificacoes = function() {
  if (typeof verificarNotificacoes === 'function') verificarNotificacoes();
}

// Garante atualização do modal assim que o elemento aparece no DOM
// (Removido MutationObserver para evitar travamento do app)
document.addEventListener('DOMContentLoaded', function() {
  if (typeof renderizarNotificacoesModal === 'function') renderizarNotificacoesModal();
});
