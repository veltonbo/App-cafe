// ===== CARREGAR CONFIGURAÇÕES =====
function carregarConfiguracoes() {
  db.ref('Configuracoes').on('value', snap => {
    const config = snap.val();
    if (config) {
      document.getElementById("safraAtual").value = config.safra || '';
      document.getElementById("emailNotificacoes").value = config.email || '';
      document.getElementById("tema").value = config.tema || 'Escuro';
      aplicarTema(config.tema);
    }
  });
}

// ===== SALVAR CONFIGURAÇÕES =====
function salvarConfiguracoes() {
  const config = {
    safra: document.getElementById("safraAtual").value.trim(),
    email: document.getElementById("emailNotificacoes").value.trim(),
    tema: document.getElementById("tema").value
  };

  db.ref('Configuracoes').set(config);
  aplicarTema(config.tema);
  alert("Configurações salvas com sucesso.");
}

// ===== RESTAURAR PADRÕES =====
function restaurarPadroes() {
  if (!confirm("Deseja restaurar as configurações padrão?")) return;
  document.getElementById("safraAtual").value = '';
  document.getElementById("emailNotificacoes").value = '';
  document.getElementById("tema").value = 'Escuro';
  salvarConfiguracoes();
}

// ===== APLICAR TEMA =====
function aplicarTema(tema) {
  if (tema === "Claro") {
    document.body.classList.remove("tema-escuro");
    document.body.classList.add("tema-claro");
  } else if (tema === "Escuro") {
    document.body.classList.remove("tema-claro");
    document.body.classList.add("tema-escuro");
  } else {
    const hora = new Date().getHours();
    if (hora >= 18 || hora < 6) {
      document.body.classList.add("tema-escuro");
      document.body.classList.remove("tema-claro");
    } else {
      document.body.classList.add("tema-claro");
      document.body.classList.remove("tema-escuro");
    }
  }
}
