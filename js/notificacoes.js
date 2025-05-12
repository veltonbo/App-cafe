// notificacoes.js
import { db } from './firebase-config.js';

// Verificar tarefas pendentes
function verificarTarefasPendentes() {
  db.ref('Tarefas').once('value').then(snapshot => {
    const tarefas = snapshot.val() || [];
    const pendentes = tarefas.filter(t => !t.feita);
    
    if (pendentes.length > 0) {
      mostrarNotificacao(`Você tem ${pendentes.length} tarefas pendentes!`);
    }
  });
}

// Verificar colheitas não pagas
function verificarColheitasNaoPagas() {
  db.ref('Colheita').once('value').then(snapshot => {
    const colheitas = snapshot.val() || [];
    const naoPagas = colheitas.filter(c => !c.pago);
    
    if (naoPagas.length > 0) {
      mostrarNotificacao(`Existem ${naoPagas.length} colheitas não pagas!`);
    }
  });
}

// Mostrar notificação
function mostrarNotificacao(mensagem) {
  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    new Notification("Manejo Café", { body: mensagem });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        new Notification("Manejo Café", { body: mensagem });
      }
    });
  }
  
  // Mostrar também como toast na página
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.textContent = mensagem;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.remove(), 5000);
}

// Verificar periodicamente
setInterval(() => {
  verificarTarefasPendentes();
  verificarColheitasNaoPagas();
}, 3600000); // A cada hora

// Verificar na inicialização
document.addEventListener('dadosCarregados', () => {
  verificarTarefasPendentes();
  verificarColheitasNaoPagas();
});
