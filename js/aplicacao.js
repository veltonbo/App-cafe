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
  const data = document.getElementById("dataApp").value;
  const produto = document.getElementById("produtoApp").value.trim();
  const dosagem = document.getElementById("dosagemApp").value.trim();
  const tipo = document.getElementById("tipoApp").value;

  if (!data || !produto || !dosagem) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  const novaAplicacao = {
    data,
    produto,
    dosagem,
    tipo
  };

  if (indiceEdicaoAplicacao !== null) {
    aplicacoes[indiceEdicaoAplicacao] = novaAplicacao;
    indiceEdicaoAplicacao = null;
  } else {
    aplicacoes.push(novaAplicacao);
  }

  db.ref('Aplicacoes').set(aplicacoes);
  atualizarAplicacoes();
  limparCamposAplicacao();
}

// ===== LIMPAR CAMPOS =====
function limparCamposAplicacao() {
  document.getElementById("dataApp").value = '';
  document.getElementById("produtoApp").value = '';
  document.getElementById("dosagemApp").value = '';
  document.getElementById("tipoApp").value = 'Adubo';
}

// ===== ATUALIZAR LISTAGEM =====
function atualizarAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  lista.innerHTML = '';

  aplicacoes.forEach((app, index) => {
    const item = document.createElement('div');
    item.className = "item";
    item.innerHTML = `
      <div>
        ${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} L/ha
      </div>
      <div>
        <button class="btn azul" onclick="editarAplicacao(${index})">Editar</button>
        <button class="btn vermelho" onclick="excluirAplicacao(${index})">Excluir</button>
      </div>
    `;
    lista.appendChild(item);
  });
}

// ===== EDITAR APLICAÇÃO =====
function editarAplicacao(index) {
  const app = aplicacoes[index];
  document.getElementById("dataApp").value = app.data;
  document.getElementById("produtoApp").value = app.produto;
  document.getElementById("dosagemApp").value = app.dosagem;
  document.getElementById("tipoApp").value = app.tipo;
  indiceEdicaoAplicacao = index;
}

// ===== EXCLUIR APLICAÇÃO =====
function excluirAplicacao(index) {
  if (confirm("Deseja excluir esta aplicação?")) {
    aplicacoes.splice(index, 1);
    db.ref('Aplicacoes').set(aplicacoes);
    atualizarAplicacoes();
  }
}

// ===== INICIALIZAR =====
document.addEventListener("DOMContentLoaded", carregarAplicacoes);
