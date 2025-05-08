// ===== VARIÁVEIS GLOBAIS =====
let aplicacoes = [];
let indiceEdicaoAplicacao = null;

// ===== CARREGAR APLICAÇÕES =====
function carregarAplicacoes() {
  db.ref('Aplicacoes').on('value', (snap) => {
    aplicacoes = snap.exists() ? snap.val() : [];
    atualizarAplicacoes();
    atualizarSugestoesProdutoApp();
  });
}

// ===== ADICIONAR OU EDITAR APLICAÇÃO =====
function adicionarAplicacao() {
  const nova = {
    data: document.getElementById("dataApp").value,
    produto: document.getElementById("produtoApp").value.trim(),
    dosagem: document.getElementById("dosagemApp").value.trim(),
    tipo: document.getElementById("tipoApp").value
  };

  if (!nova.data || !nova.produto || !nova.dosagem || isNaN(parseFloat(nova.dosagem))) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  if (indiceEdicaoAplicacao !== null) {
    aplicacoes[indiceEdicaoAplicacao] = nova;
    indiceEdicaoAplicacao = null;
  } else {
    aplicacoes.push(nova);
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

  const termoBusca = document.getElementById("pesquisaAplicacoes").value.toLowerCase();

  aplicacoes
    .filter(app => `${app.produto} ${app.tipo}`.toLowerCase().includes(termoBusca))
    .forEach((app, index) => {
      const item = document.createElement('div');
      item.className = "item fade-in";

      const conteudo = document.createElement('div');
      conteudo.className = "conteudo-item";
      conteudo.textContent = `${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem}`;

      const botoes = document.createElement('div');
      botoes.className = "botoes-item";
      
      // Botão Editar
      const btnEditar = document.createElement('button');
      btnEditar.className = 'botao-circular azul';
      btnEditar.innerHTML = '<i class="fas fa-edit"></i>';
      btnEditar.onclick = () => editarAplicacao(index);
      botoes.appendChild(btnEditar);

      // Botão Excluir
      const btnExcluir = document.createElement('button');
      btnExcluir.className = 'botao-circular vermelho';
      btnExcluir.innerHTML = '<i class="fas fa-trash"></i>';
      btnExcluir.onclick = () => excluirAplicacao(index);
      botoes.appendChild(btnExcluir);

      item.appendChild(conteudo);
      item.appendChild(botoes);
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

// ===== SUGESTÕES DE PRODUTO =====
function atualizarSugestoesProdutoApp() {
  const lista = document.getElementById("sugestoesProdutoApp");
  const produtosUnicos = [...new Set(aplicacoes.map(a => a.produto))];
  lista.innerHTML = produtosUnicos.map(p => `<option value="${p}">`).join('');
}

// ===== INICIALIZAR =====
document.addEventListener("DOMContentLoaded", carregarAplicacoes);
