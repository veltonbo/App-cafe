// ===== FUNÇÃO PARA TROCAR ABAS =====
function mostrarAba(abaId) {
  document.querySelectorAll('.aba').forEach(aba => {
    aba.style.display = 'none';
  });

  const abaSelecionada = document.getElementById(abaId);
  if (abaSelecionada) abaSelecionada.style.display = 'block';

  document.querySelectorAll('.menu-superior button').forEach(btn => {
    btn.classList.remove('active');
  });

  const btnId = 'btn-' + abaId;
  const btn = document.querySelector(`.menu-superior button[onclick="mostrarAba('${abaId}')"]`);
  if (btn) btn.classList.add('active');

  localStorage.setItem('aba', abaId);
}

// ===== INICIALIZAR O APLICATIVO =====
function inicializarApp() {
  const abaInicial = localStorage.getItem('aba') || 'aplicacoes';
  mostrarAba(abaInicial);

  if (localStorage.getItem('tema') === 'claro') {
    document.body.classList.add('claro');
  }

  // Eventos customizados para garantir que as funções carreguem corretamente
  document.addEventListener('dadosCarregados', () => {
    if (typeof carregarAplicacoes === "function") carregarAplicacoes();
    if (typeof carregarTarefas === "function") carregarTarefas();
    if (typeof carregarFinanceiro === "function") carregarFinanceiro();
    if (typeof carregarColheita === "function") carregarColheita();
    if (typeof carregarValorLata === "function") carregarValorLata();
    if (typeof carregarAnoSafra === "function") carregarAnoSafra();
    if (typeof carregarSafrasDisponiveis === "function") carregarSafrasDisponiveis();
  });

  // Disparar o evento após garantir que o DOM está pronto
  document.dispatchEvent(new Event('dadosCarregados'));
}

// ===== TRANSIÇÃO SUAVE ENTRE ABAS =====
document.querySelectorAll('.menu-superior button').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.aba').forEach(aba => {
      aba.style.opacity = 0;
      setTimeout(() => {
        aba.style.opacity = 1;
      }, 100);
    });
  });
});

// ===== MODO CLARO/ESCURO DINÂMICO =====
function alternarTema() {
  document.body.classList.toggle('claro');
  const temaAtual = document.body.classList.contains('claro') ? 'claro' : 'escuro';
  localStorage.setItem('tema', temaAtual);
}

// ===== MONITORAR O TEMA PREFERIDO =====
document.addEventListener('DOMContentLoaded', () => {
  inicializarApp();
});

// ===== VERIFICAR AUTENTICAÇÃO (OPCIONAL) =====
function verificarAutenticacao() {
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      console.log("Usuário autenticado:", user.email);
    } else {
      console.log("Usuário não autenticado.");
    }
  });
}

// ===== DESLOGAR USUÁRIO (OPCIONAL) =====
function deslogar() {
  firebase.auth().signOut().then(() => {
    mostrarSucesso("Você foi deslogado com sucesso.");
    window.location.reload();
  }).catch((error) => {
    mostrarErro("Erro ao deslogar: " + error.message);
  });
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
