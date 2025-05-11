// ===== CONFIGURAÇÃO DO FIREBASE =====
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  databaseURL: "SUA_DATABASE_URL",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_STORAGE_BUCKET",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
};
firebase.initializeApp(firebaseConfig);

// ===== INICIALIZAR APP =====
document.addEventListener("DOMContentLoaded", () => {
  mostrarAba('telaInicio');
  atualizarResumoInicio();
  carregarTodosMenus();
});

// ===== MOSTRAR ABAS =====
function mostrarAba(abaId) {
  document.querySelectorAll('.aba').forEach(aba => aba.style.display = 'none');
  document.getElementById(abaId).style.display = 'block';
  if (abaId === 'telaInicio') atualizarResumoInicio();
}

// ===== ATUALIZAR RESUMO DA TELA DE INÍCIO =====
function atualizarResumoInicio() {
  const resumo = document.querySelector('.resumo-geral');
  let totalLatas = 0;
  let totalPago = 0;
  let totalPendente = 0;

  firebase.database().ref('Colheita').once('value').then(snapshot => {
    snapshot.forEach(snap => {
      const c = snap.val();
      totalLatas += parseFloat(c.quantidade);
    });

    resumo.innerHTML = `
      <div><strong>Total de Latas Colhidas:</strong> ${totalLatas}</div>
      <div><strong>Total Pago:</strong> R$ ${totalPago.toFixed(2)}</div>
      <div><strong>Total Pendente:</strong> R$ ${totalPendente.toFixed(2)}</div>
    `;
  });
}

// ===== CARREGAR TODOS OS MENUS =====
function carregarTodosMenus() {
  atualizarAplicacoes();
  atualizarTarefas();
  atualizarFinanceiro();
  atualizarColheita();
}

// ===== MOSTRAR FORMULÁRIO FLUTUANTE =====
function mostrarFormulario(idFormulario) {
  document.getElementById(idFormulario).style.display = "block";
}

// ===== CANCELAR FORMULÁRIO FLUTUANTE =====
function cancelarFormulario(idFormulario) {
  document.getElementById(idFormulario).style.display = "none";
  document.querySelectorAll(`#${idFormulario} input`).forEach(input => input.value = "");
}

// ===== MODO CLARO/ESCURO =====
function alternarTema() {
  document.body.classList.toggle('claro');
  localStorage.setItem('tema', document.body.classList.contains('claro') ? 'claro' : 'escuro');
}

// ===== CARREGAR TEMA SALVO =====
document.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem('tema') === 'claro') {
    document.body.classList.add('claro');
  }
});

// ===== FORMATAR DATA PARA BR (DD/MM/AAAA) =====
function formatarDataBR(dataISO) {
  if (!dataISO) return "";
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

// ===== FORMATAR VALOR PARA REAL (R$) =====
function formatarValorBR(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}
