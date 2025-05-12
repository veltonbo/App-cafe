// ===== IMPORTAÇÕES =====
import { db } from './firebase-config.js';

// ===== VERIFICAR TAREFAS PENDENTES =====
function verificarTarefasPendentes() {
  db.ref('Tarefas').once('value').then(snapshot => {
    const tarefas = snapshot.val() || [];
    const pendentes = tarefas.filter(t => !t.feita);
    
    if (pendentes.length > 0) {
      mostrarNotificacao(`Você tem ${pendentes.length} tarefa(s) pendente(s)!`, 'tarefas');
    }
  }).catch(() => {
    // Caso offline, tentar carregar do IndexedDB
    if (typeof loadDataOffline === 'function') {
      loadDataOffline('tarefas').then(tarefas => {
        const pendentes = tarefas.filter(t => !t.feita);
        if (pendentes.length > 0) {
          mostrarNotificacao(`Você tem ${pendentes.length} tarefa(s) pendente(s) (offline)!`, 'tarefas');
        }
      });
    }
  });
}

// ===== VERIFICAR COLHEITAS NÃO PAGAS =====
function verificarColheitasNaoPagas() {
  db.ref('Colheita').once('value').then(snapshot => {
    const colheitas = snapshot.val() || [];
    const naoPagas = colheitas.filter(c => !c.pago && c.pagoParcial < c.quantidade);
    
    if (naoPagas.length > 0) {
      const totalLatas = naoPagas.reduce((sum, c) => sum + (c.quantidade - (c.pagoParcial || 0)), 0);
      mostrarNotificacao(`Existem ${naoPagas.length} colheita(s) não paga(s) (${totalLatas.toFixed(2)} latas)!`, 'colheita');
    }
  }).catch(() => {
    // Caso offline
    if (typeof loadDataOffline === 'function') {
      loadDataOffline('colheita').then(colheitas => {
        const naoPagas = colheitas.filter(c => !c.pago && c.pagoParcial < c.quantidade);
        if (naoPagas.length > 0) {
          const totalLatas = naoPagas.reduce((sum, c) => sum + (c.quantidade - (c.pagoParcial || 0)), 0);
          mostrarNotificacao(`Existem ${naoPagas.length} colheita(s) não paga(s) (${totalLatas.toFixed(2)} latas - offline)!`, 'colheita');
        }
      });
    }
  });
}

// ===== MOSTRAR NOTIFICAÇÃO =====
function mostrarNotificacao(mensagem, tipo = 'info') {
  // Notificação do sistema
  if ("Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification("Manejo Café", { body: mensagem });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          new Notification("Manejo Café", { body: mensagem });
        }
      });
    }
  }
  
  // Toast na página
  const toast = document.createElement('div');
  toast.className = `toast-notification ${tipo}`;
  toast.textContent = mensagem;
  
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = () => toast.remove();
  
  toast.appendChild(closeBtn);
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 500);
  }, 5000);
}

// ===== VERIFICAÇÃO PERIÓDICA =====
setInterval(() => {
  verificarTarefasPendentes();
  verificarColheitasNaoPagas();
}, 3600000); // A cada hora

// ===== INICIALIZAÇÃO =====
document.addEventListener('dadosCarregados', () => {
  verificarTarefasPendentes();
  verificarColheitasNaoPagas();
});

// ===== EVENTO DE TAREFA CONCLUÍDA =====
document.addEventListener('tarefaConcluida', (e) => {
  mostrarNotificacao(`Tarefa "${e.detail.descricao}" marcada como concluída!`, 'success');
});

// ===== EVENTO DE COLHEITA PAGA =====
document.addEventListener('colheitaPaga', (e) => {
  mostrarNotificacao(`Colheita de ${e.detail.quantidade} latas paga para ${e.detail.colhedor}!`, 'success');
});
