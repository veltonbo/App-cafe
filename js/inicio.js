// ===== VARIÁVEIS GLOBAIS =====
let telaAtual = "inicio";
let colheita = [];

// ===== FUNÇÃO PARA INICIAR A TELA =====
document.addEventListener("DOMContentLoaded", () => {
  carregarTelaInicio();
  carregarColheitaFirebase();
});

// ===== CARREGAR TELA DE INÍCIO =====
function carregarTelaInicio() {
  document.querySelectorAll(".aba").forEach(aba => aba.style.display = "none");
  const telaInicio = document.getElementById("telaInicio");
  if (telaInicio) {
    telaInicio.style.display = "block";
    atualizarResumoInicio();
    atualizarIconeMenu();
  } else {
    console.error("Tela de Início não encontrada.");
  }
}

// ===== ATUALIZAR RESUMO DA TELA DE INÍCIO =====
function atualizarResumoInicio() {
  if (!colheita.length) {
    console.warn("Nenhuma colheita carregada.");
    return;
  }

  const totalLatas = colheita.reduce((soma, c) => soma + c.quantidade, 0);
  const totalPago = colheita.reduce((soma, c) => soma + (c.pagoParcial * c.valorLata), 0);
  const totalPendente = colheita.reduce((soma, c) => soma + ((c.quantidade - c.pagoParcial) * c.valorLata), 0);

  document.getElementById("totalLatasInicio").innerText = totalLatas.toFixed(2);
  document.getElementById("totalPagoInicio").innerText = `R$ ${totalPago.toFixed(2)}`;
  document.getElementById("totalPendenteInicio").innerText = `R$ ${totalPendente.toFixed(2)}`;
}

// ===== CARREGAR COLHEITA DO FIREBASE =====
function carregarColheitaFirebase() {
  if (typeof db === "undefined") {
    console.error("Firebase não carregado corretamente.");
    return;
  }

  db.ref('Colheita').on('value', snap => {
    colheita = snap.exists() ? Object.values(snap.val()) : [];
    atualizarResumoInicio();
  });
}

// ===== ALTERNAR ENTRE MENU E INÍCIO =====
function alternarMenuInicio() {
  if (telaAtual === "inicio") {
    irParaMenu();
  } else {
    carregarTelaInicio();
  }
}

// ===== IR PARA MENU =====
function irParaMenu() {
  document.querySelectorAll(".aba").forEach(aba => aba.style.display = "none");
  const telaMenu = document.getElementById("colheita");
  if (telaMenu) {
    telaMenu.style.display = "block";
    telaAtual = "menu";
    atualizarIconeMenu();
  } else {
    console.error("Tela de Menu não encontrada.");
  }
}

// ===== ATUALIZAR ÍCONE DO BOTÃO =====
function atualizarIconeMenu() {
  const icone = document.getElementById("iconeMenu");
  if (icone) {
    icone.className = telaAtual === "inicio" ? "fas fa-bars" : "fas fa-home";
  } else {
    console.error("Ícone de Menu não encontrado.");
  }
}
