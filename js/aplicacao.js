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
  const setor = document.getElementById("setorApp").value;

  if (!data || !produto || !dosagem || isNaN(parseFloat(dosagem))) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  const novaAplicacao = { data, produto, dosagem, tipo, setor };

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
  document.getElementById("setorApp").value = 'Setor 01';
}

// ===== ATUALIZAR LISTAGEM =====
function atualizarAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  lista.innerHTML = '';

  const termoBusca = document.getElementById("pesquisaAplicacoes").value.toLowerCase();
  aplicacoes
    .filter(app => `${app.produto} ${app.tipo} ${app.setor}`.toLowerCase().includes(termoBusca))
    .forEach((app, index) => {
      const item = document.createElement('div');
      item.className = "item";
      item.innerHTML = `
        <div>
          ${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} L/ha - ${app.setor}
        </div>
        <div>
          <button class="botao-circular azul" onclick="editarAplicacao(${index})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="botao-circular vermelho" onclick="excluirAplicacao(${index})">
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
  document.getElementById("dataApp").value = app.data;
  document.getElementById("produtoApp").value = app.produto;
  document.getElementById("dosagemApp").value = app.dosagem;
  document.getElementById("tipoApp").value = app.tipo;
  document.getElementById("setorApp").value = app.setor;
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
