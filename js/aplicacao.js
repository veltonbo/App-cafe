// ===== VARIÁVEIS GLOBAIS =====
let aplicacoes = [];
let indiceEdicaoAplicacao = null;

// ===== CARREGAR APLICAÇÕES =====
function carregarAplicacoes() {
  db.ref('Aplicacoes').on('value', snap => {
    aplicacoes = snap.exists() ? snap.val() : [];
    atualizarAplicacoes();
  });
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

  if (!nova.data || !nova.produto || !nova.dosagem) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  if (indiceEdicaoAplicacao !== null) {
    aplicacoes[indiceEdicaoAplicacao] = nova;
  } else {
    aplicacoes.push(nova);
  }

  db.ref('Aplicacoes').set(aplicacoes);
  atualizarAplicacoes();
  limparCamposAplicacao();
}

// ===== CANCELAR EDIÇÃO =====
function cancelarEdicaoAplicacao() {
  indiceEdicaoAplicacao = null;
  limparCamposAplicacao();
  document.getElementById("btnCancelarEdicaoApp").style.display = "none";
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
  lista.innerHTML = '';

  aplicacoes.forEach((app, i) => {
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
      <span>${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}</span>
      <div class="buttons">
        <button class="btn azul" onclick="editarAplicacao(${i})"><i class="fas fa-edit"></i></button>
        <button class="btn vermelho" onclick="excluirAplicacao(${i})"><i class="fas fa-trash"></i></button>
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
  document.getElementById("btnCancelarEdicaoApp").style.display = "inline-block";
}

// ===== EXCLUIR APLICAÇÃO =====
function excluirAplicacao(index) {
  if (!confirm("Deseja excluir esta aplicação?")) return;
  aplicacoes.splice(index, 1);
  db.ref('Aplicacoes').set(aplicacoes);
  atualizarAplicacoes();
}
