// ===== VARIÁVEIS GLOBAIS =====
let aplicacoes = [];
let indiceEdicaoAplicacao = null;

// ===== CARREGAR APLICAÇÕES =====
async function carregarAplicacoes() {
  const cache = localStorage.getItem('aplicacoes');
  if (cache) {
    aplicacoes = JSON.parse(cache);
    atualizarAplicacoes();
  }

  const snapshot = await db.ref('Aplicacoes').once('value');
  aplicacoes = snapshot.val() ? Object.values(snapshot.val()) : [];
  localStorage.setItem('aplicacoes', JSON.stringify(aplicacoes));
  atualizarAplicacoes();
}

// ===== ADICIONAR OU EDITAR APLICAÇÃO =====
function adicionarAplicacao() {
  const nova = {
    data: document.getElementById("dataApp").value,
    produto: document.getElementById("produtoApp").value.trim(),
    dosagem: document.getElementById("dosagemApp").value.trim(),
    tipo: document.getElementById("tipoApp").value,
    setor: document.getElementById("setorApp").value
  };

  if (!nova.data || !nova.produto || !nova.dosagem || isNaN(parseFloat(nova.dosagem))) {
    mostrarErro("Preencha todos os campos corretamente.");
    return;
  }

  if (indiceEdicaoAplicacao !== null) {
    aplicacoes[indiceEdicaoAplicacao] = nova;
    indiceEdicaoAplicacao = null;
    document.getElementById("btnCancelarEdicaoApp").style.display = "none";
    document.getElementById("btnSalvarAplicacao").innerText = "Salvar Aplicação";
  } else {
    aplicacoes.push(nova);
  }

  db.ref('Aplicacoes').set(aplicacoes.reduce((acc, app, index) => {
    acc[index] = app;
    return acc;
  }, {}));

  atualizarAplicacoes();
  limparCamposAplicacao();
  mostrarSucesso("Aplicação salva com sucesso!");
}

// ===== LIMPAR CAMPOS =====
function limparCamposAplicacao() {
  document.getElementById("dataApp").value = '';
  document.getElementById("produtoApp").value = '';
  document.getElementById("dosagemApp").value = '';
  document.getElementById("tipoApp").value = 'Adubo';
  document.getElementById("setorApp").value = 'Setor 01';
}

// ===== ATUALIZAR LISTAGEM =====
function atualizarAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  if (!lista) return;
  lista.innerHTML = '';

  aplicacoes.forEach((app, i) => {
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
      <span>${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}</span>
      <div class="botoes-aplicacao">
        <button class="botao-circular azul" onclick="editarAplicacao(${i})">
          <i class="fas fa-edit"></i>
        </button>
        <button class="botao-circular vermelho" onclick="confirmarExclusaoAplicacao(${i})">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    lista.appendChild(item);
  });
}

// ===== EDITAR APLICAÇÃO =====
function editarAplicacao(index) {
  const app = aplicacoes[index];
  if (!app) return;

  document.getElementById("dataApp").value = app.data;
  document.getElementById("produtoApp").value = app.produto;
  document.getElementById("dosagemApp").value = app.dosagem;
  document.getElementById("tipoApp").value = app.tipo;
  document.getElementById("setorApp").value = app.setor;

  indiceEdicaoAplicacao = index;
  document.getElementById("btnSalvarAplicacao").innerText = "Salvar Edição";
  document.getElementById("btnCancelarEdicaoApp").style.display = "inline-block";
}

// ===== CONFIRMAR EXCLUSÃO =====
function confirmarExclusaoAplicacao(index) {
  Swal.fire({
    title: 'Você tem certeza?',
    text: "Esta ação não pode ser desfeita!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Sim, excluir!',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      excluirAplicacao(index);
    }
  });
}

// ===== EXCLUIR APLICAÇÃO =====
function excluirAplicacao(index) {
  aplicacoes.splice(index, 1);
  db.ref('Aplicacoes').set(aplicacoes.reduce((acc, app, idx) => {
    acc[idx] = app;
    return acc;
  }, {}));

  atualizarAplicacoes();
  mostrarSucesso("Aplicação excluída com sucesso!");
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

// ===== INICIALIZAR APLICAÇÕES =====
document.addEventListener("dadosCarregados", carregarAplicacoes);
