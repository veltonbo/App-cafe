// ===== VARIÁVEIS GLOBAIS =====
let aplicacoes = [];
let indiceEdicaoAplicacao = null;

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
  const nova = {
    data: document.getElementById("dataApp").value,
    produto: document.getElementById("produtoApp").value.trim(),
    dosagem: document.getElementById("dosagemApp").value.trim(),
    tipo: document.getElementById("tipoApp").value,
    setor: document.getElementById("setorApp").value
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

  salvarAplicacoesFirebase();
  limparCamposAplicacao();
  atualizarAplicacoes();
}

// ===== SALVAR NO FIREBASE =====
function salvarAplicacoesFirebase() {
  db.ref('Aplicacoes').set(aplicacoes.reduce((acc, app, index) => {
    acc[index] = app;
    return acc;
  }, {}));
}

// ===== CANCELAR EDIÇÃO =====
function cancelarEdicaoAplicacao() {
  indiceEdicaoAplicacao = null;
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

  aplicacoes.forEach((app, i) => {
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
      <span>${formatarDataBR(app.data)} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}</span>
      <div class="botoes-aplicacao">
        <button class="botao-circular verde" onclick="duplicarAplicacao(${i})">
          <i class="fas fa-copy"></i>
        </button>
        <button class="botao-circular azul" onclick="editarAplicacao(${i})">
          <i class="fas fa-edit"></i>
        </button>
        <button class="botao-circular vermelho" onclick="excluirAplicacao(${i})">
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
}

// ===== EXCLUIR APLICAÇÃO =====
function excluirAplicacao(index) {
  if (!confirm("Deseja excluir esta aplicação?")) return;
  aplicacoes.splice(index, 1);
  salvarAplicacoesFirebase();
  atualizarAplicacoes();
}

// ===== DUPLICAR APLICAÇÃO =====
function duplicarAplicacao(index) {
  const app = { ...aplicacoes[index] };
  aplicacoes.push(app);
  salvarAplicacoesFirebase();
  atualizarAplicacoes();
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

// ===== FILTRAR APLICAÇÕES POR SETOR =====
function filtrarAplicacoesPorSetor() {
  const setor = document.getElementById("filtroSetorApp").value;
  atualizarAplicacoes(setor);
}

// ===== ORDENAR APLICAÇÕES =====
function ordenarAplicacoes(criterio) {
  aplicacoes.sort((a, b) => {
    if (criterio === "data") return new Date(a.data) - new Date(b.data);
    if (criterio === "produto") return a.produto.localeCompare(b.produto);
    if (criterio === "setor") return a.setor.localeCompare(b.setor);
  });
  atualizarAplicacoes();
}

// ===== INICIALIZAR APLICAÇÕES =====
document.addEventListener("dadosCarregados", carregarAplicacoes);
