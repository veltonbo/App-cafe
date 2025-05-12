// ===== VARIÁVEIS GLOBAIS =====
let aplicacoes = [];
let indiceEdicaoAplicacao = null;

// ===== INICIALIZAR APLICAÇÕES =====
document.addEventListener("DOMContentLoaded", carregarAplicacoes);

// ===== CARREGAR APLICAÇÕES =====
function carregarAplicacoes() {
  db.ref('Aplicacoes').on('value', snap => {
    const dados = snap.val();
    aplicacoes = dados ? Object.values(dados) : [];
    atualizarAplicacoes();
    atualizarSugestoesProdutoApp();
  });
}

// ===== ADICIONAR OU EDITAR APLICAÇÃO =====
function adicionarAplicacao() {
  const dataApp = document.getElementById("dataApp").value;
  const produtoApp = document.getElementById("produtoApp").value.trim();
  const dosagemApp = document.getElementById("dosagemApp").value.trim();
  const tipoApp = document.getElementById("tipoApp").value;
  const setorApp = document.getElementById("setorApp").value;

  if (!dataApp || !produtoApp || !dosagemApp || isNaN(parseFloat(dosagemApp))) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  const novaAplicacao = { data: dataApp, produto: produtoApp, dosagem: dosagemApp, tipo: tipoApp, setor: setorApp };

  if (indiceEdicaoAplicacao !== null) {
    aplicacoes[indiceEdicaoAplicacao] = novaAplicacao;
    indiceEdicaoAplicacao = null;
  } else {
    aplicacoes.push(novaAplicacao);
  }

  salvarAplicacoes();
  limparCamposAplicacao();
  alternarFormularioAplicacao(false);
}

// ===== SALVAR NO FIREBASE =====
function salvarAplicacoes() {
  db.ref('Aplicacoes').set(
    aplicacoes.reduce((acc, app, index) => {
      acc[index] = app;
      return acc;
    }, {})
  );
  atualizarAplicacoes();
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

// ===== CANCELAR EDIÇÃO =====
function cancelarEdicaoAplicacao() {
  indiceEdicaoAplicacao = null;
  limparCamposAplicacao();
  document.getElementById("btnCancelarEdicaoApp").style.display = "none";
  document.getElementById("btnSalvarAplicacao").innerText = "Salvar Aplicação";
}

// ===== LIMPAR CAMPOS =====
function limparCamposAplicacao() {
  document.getElementById("dataApp").value = '';
  document.getElementById("produtoApp").value = '';
  document.getElementById("dosagemApp").value = '';
  document.getElementById("tipoApp").value = 'Adubo';
  document.getElementById("setorApp").value = 'Setor 01';
}

// ===== FILTRAR APLICAÇÕES =====
function filtrarAplicacoes() {
  const termo = document.getElementById("campoPesquisaAplicacoes").value.toLowerCase();
  atualizarAplicacoes(termo);
}

// ===== ATUALIZAR LISTAGEM =====
function atualizarAplicacoes(filtro = "") {
  const lista = document.getElementById("listaAplicacoes");
  lista.innerHTML = '';

  aplicacoes
    .filter(app => {
      return (
        app.data.toLowerCase().includes(filtro) ||
        app.produto.toLowerCase().includes(filtro) ||
        app.dosagem.toLowerCase().includes(filtro) ||
        app.tipo.toLowerCase().includes(filtro) ||
        app.setor.toLowerCase().includes(filtro)
      );
    })
    .forEach((app, i) => adicionarItemAplicacao(app, i));
}

// ===== ADICIONAR ITEM NA LISTA =====
function adicionarItemAplicacao(app, index) {
  const lista = document.getElementById("listaAplicacoes");
  const item = document.createElement('div');
  item.className = 'item-aplicacao';
  item.innerHTML = `
    <div class="conteudo-item">
      <span>${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}</span>
      <button class="botao-acao" onclick="toggleMenu(this)">
        <i class="fas fa-ellipsis-v"></i>
      </button>
      <div class="menu-acoes">
        <button onclick="editarAplicacao(${index})">Editar</button>
        <button onclick="excluirAplicacao(${index})">Excluir</button>
      </div>
    </div>
  `;
  lista.appendChild(item);
}

// ===== TOGGLE MENU DE AÇÕES =====
function toggleMenu(button) {
  document.querySelectorAll('.menu-acoes').forEach(menu => {
    if (menu !== button.nextElementSibling) menu.style.display = 'none';
  });

  const menu = button.nextElementSibling;
  menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
}

// ===== EXCLUIR APLICAÇÃO =====
function excluirAplicacao(index) {
  if (!confirm("Deseja excluir esta aplicação?")) return;
  aplicacoes.splice(index, 1);
  salvarAplicacoes();
}

// ===== SUGESTÕES DE PRODUTO =====
function atualizarSugestoesProdutoApp() {
  const lista = document.getElementById("sugestoesProdutoApp");
  const produtosUnicos = [...new Set(aplicacoes.map(a => a.produto))];
  lista.innerHTML = produtosUnicos.map(p => `<option value="${p}">`).join('');
}

// ===== EXPORTAR CSV DE APLICAÇÕES =====
function exportarAplicacoesCSV() {
  let csv = "Data,Produto,Dosagem,Tipo,Setor\n";
  aplicacoes.forEach(app => {
    csv += `${app.data},${app.produto},${app.dosagem},${app.tipo},${app.setor}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aplicacoes_manejo_cafe_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
}

// ===== ALTERNAR FORMULÁRIO =====
function alternarFormularioAplicacao() {
  const form = document.getElementById("formularioAplicacao");
  form.style.display = form.style.display === "none" ? "block" : "none";
}
