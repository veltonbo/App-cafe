// ====== CARREGAR CONFIGURAÇÕES ======
function carregarConfiguracoes() {
  db.ref('Configuracoes').once('value').then(snapshot => {
    const config = snapshot.val() || {};
    document.body.className = config.Tema || "escuro";
  });
}

// ====== ALTERAR TEMA (AUTOMÁTICO) ======
function alternarTema() {
  const temaAtual = document.body.classList.contains("claro") ? "escuro" : "claro";
  document.body.className = temaAtual;
  db.ref('Configuracoes/Tema').set(temaAtual);
}
