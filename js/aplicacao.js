// ===== VARIÁVEIS GLOBAIS =====
let aplicacoes = [];
let indiceEdicaoAplicacao = null;

// ===== INICIALIZAR FIREBASE =====
document.addEventListener("DOMContentLoaded", () => {
  if (typeof firebase === "undefined") {
    alert("Firebase não está carregado corretamente.");
    return;
  }

  const db = firebase.database().ref("Aplicacoes");

  // Carregar Aplicações ao iniciar
  carregarAplicacoes(db);

  // Configurações de botões
  document.getElementById("btnSalvarAplicacao").onclick = () => adicionarAplicacao(db);
  document.getElementById("btnCancelarEdicaoApp").onclick = cancelarEdicaoAplicacao;
});

// ===== FUNÇÃO PARA CARREGAR APLICAÇÕES =====
function carregarAplicacoes(db) {
  db.on("value", (snapshot) => {
    aplicacoes = snapshot.val() ? Object.values(snapshot.val()) : [];
    atualizarAplicacoes();
    atualizarSugestoesProdutoApp();
  });
}

// ===== ADICIONAR OU EDITAR APLICAÇÃO =====
function adicionarAplicacao(db) {
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
    db.child(indiceEdicaoAplicacao).set(nova);
    indiceEdicaoAplicacao = null;
    document.getElementById("btnCancelarEdicaoApp").style.display = "none";
  } else {
    db.push().set(nova);
  }

  limparCamposAplicacao();
  alternarFormularioAplicacao();
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

  const filtroSetor = document.getElementById("filtroSetorAplicacoes").value;
  const termoBusca = document.getElementById("pesquisaAplicacoes").value.toLowerCase();

  aplicacoes
    .filter(app =>
      (!filtroSetor || app.setor === filtroSetor) &&
      (`${app.produto} ${app.tipo} ${app.setor}`.toLowerCase().includes(termoBusca))
    )
    .sort((a, b) => b.data.localeCompare(a.data))
    .forEach((app, index) => {
      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `
        <span>${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}</span>
        <div class="acoes">
          <button class="azul" onclick="editarAplicacao('${index}')"><i class="fas fa-edit"></i></button>
          <button class="vermelho" onclick="excluirAplicacao('${index}')"><i class="fas fa-trash"></i></button>
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
  const db = firebase.database().ref("Aplicacoes");
  db.child(indiceEdicaoAplicacao).remove();
  carregarAplicacoes(db);
}

// ===== ALTERNAR FORMULÁRIO =====
function alternarFormularioAplicacao() {
  const form = document.getElementById("formularioAplicacao");
  form.style.display = form.style.display === "none" ? "block" : "none";
  if (form.style.display === "none") limparCamposAplicacao();
}

// ===== ALTERNAR FILTROS =====
function alternarFiltrosAplicacao() {
  const filtros = document.getElementById("filtrosAplicacoes");
  filtros.style.display = filtros.style.display === "none" ? "flex" : "none";
}

// ===== ATUALIZAR SUGESTÕES DE PRODUTO =====
function atualizarSugestoesProdutoApp() {
  const lista = document.getElementById("sugestoesProdutoApp");
  if (!lista) {
    console.error("Elemento de sugestões de produto não encontrado.");
    return;
  }

  const produtosUnicos = [...new Set(aplicacoes.map(a => a.produto))];
  lista.innerHTML = produtosUnicos.map(p => `<option value="${p}">`).join('');
}

// ===== EXPORTAÇÃO CSV =====
function exportarAplicacoesCSV() {
  if (!aplicacoes.length) {
    alert("Nenhum dado disponível para exportação.");
    return;
  }

  let csv = "Data,Produto,Dosagem,Tipo,Setor\n";
  aplicacoes.forEach(a => {
    csv += `${a.data},${a.produto},${a.dosagem},${a.tipo},${a.setor}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `aplicacoes_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
}
