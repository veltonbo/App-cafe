// ===== VARIÁVEIS GLOBAIS =====
let aplicacoes = [];
let indiceEdicaoAplicacao = null;

// ===== FUNÇÃO: CARREGAR APLICAÇÕES =====
function carregarAplicacoes() {
  const listaAplicacoes = document.getElementById("listaAplicacoes");
  listaAplicacoes.innerHTML = "";

  // Filtrar por setor e pesquisa
  const filtroSetor = document.getElementById("filtroSetorAplicacoes").value;
  const pesquisa = document.getElementById("pesquisaAplicacoes").value.toLowerCase();

  const aplicacoesFiltradas = aplicacoes.filter(app => {
    return (
      (filtroSetor === "" || app.setor === filtroSetor) &&
      (app.produto.toLowerCase().includes(pesquisa) || app.dosagem.toLowerCase().includes(pesquisa))
    );
  });

  if (aplicacoesFiltradas.length === 0) {
    listaAplicacoes.innerHTML = "<p style='text-align:center;'>Nenhuma aplicação encontrada.</p>";
  }

  aplicacoesFiltradas.forEach((app, index) => {
    const item = document.createElement("div");
    item.classList.add("item");
    item.innerHTML = `
      <span><strong>${app.data}</strong> - ${app.produto} (${app.dosagem}) - ${app.tipo} - ${app.setor}</span>
      <div class="botoes-aplicacao">
        <button class="botao-circular azul" onclick="editarAplicacao(${index})"><i class="fas fa-edit"></i></button>
        <button class="botao-circular vermelho" onclick="excluirAplicacao(${index})"><i class="fas fa-trash-alt"></i></button>
      </div>
    `;
    listaAplicacoes.appendChild(item);
  });
}

// ===== FUNÇÃO: ADICIONAR OU EDITAR APLICAÇÃO =====
function adicionarAplicacao() {
  const nova = {
    data: document.getElementById("dataApp").value,
    produto: document.getElementById("produtoApp").value.trim(),
    dosagem: document.getElementById("dosagemApp").value.trim(),
    tipo: document.getElementById("tipoApp").value,
    setor: document.getElementById("setorApp").value,
  };

  if (!nova.data || !nova.produto || !nova.dosagem) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  if (indiceEdicaoAplicacao === null) {
    aplicacoes.push(nova);
  } else {
    aplicacoes[indiceEdicaoAplicacao] = nova;
    indiceEdicaoAplicacao = null;
    document.getElementById("btnSalvarAplicacao").textContent = "Salvar Aplicação";
    document.getElementById("btnCancelarEdicaoApp").style.display = "none";
  }

  limparCamposAplicacao();
  carregarAplicacoes();
}

// ===== FUNÇÃO: EDITAR APLICAÇÃO =====
function editarAplicacao(index) {
  const app = aplicacoes[index];
  document.getElementById("dataApp").value = app.data;
  document.getElementById("produtoApp").value = app.produto;
  document.getElementById("dosagemApp").value = app.dosagem;
  document.getElementById("tipoApp").value = app.tipo;
  document.getElementById("setorApp").value = app.setor;
  
  indiceEdicaoAplicacao = index;
  document.getElementById("btnSalvarAplicacao").textContent = "Atualizar Aplicação";
  document.getElementById("btnCancelarEdicaoApp").style.display = "inline-block";
}

// ===== FUNÇÃO: CANCELAR EDIÇÃO =====
function cancelarEdicaoAplicacao() {
  limparCamposAplicacao();
  indiceEdicaoAplicacao = null;
  document.getElementById("btnSalvarAplicacao").textContent = "Salvar Aplicação";
  document.getElementById("btnCancelarEdicaoApp").style.display = "none";
}

// ===== FUNÇÃO: EXCLUIR APLICAÇÃO =====
function excluirAplicacao(index) {
  if (confirm("Tem certeza que deseja excluir esta aplicação?")) {
    aplicacoes.splice(index, 1);
    carregarAplicacoes();
  }
}

// ===== FUNÇÃO: LIMPAR CAMPOS =====
function limparCamposAplicacao() {
  document.getElementById("dataApp").value = "";
  document.getElementById("produtoApp").value = "";
  document.getElementById("dosagemApp").value = "";
  document.getElementById("tipoApp").value = "Adubo";
  document.getElementById("setorApp").value = "Setor 01";
}

// ===== FUNÇÃO: EXPORTAR APLICAÇÕES CSV =====
function exportarAplicacoesCSV() {
  if (aplicacoes.length === 0) {
    alert("Nenhuma aplicação para exportar.");
    return;
  }

  let csv = "Data,Produto,Dosagem,Tipo,Setor\n";
  aplicacoes.forEach(app => {
    csv += `${app.data},${app.produto},${app.dosagem},${app.tipo},${app.setor}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "aplicacoes.csv";
  link.click();
}

// ===== FUNÇÃO: SUGESTÕES DE PRODUTO =====
const produtosSugestoes = ["Adubo", "Fungicida", "Inseticida", "Herbicida"];
const sugestoesProdutoApp = document.getElementById("sugestoesProdutoApp");
produtosSugestoes.forEach(produto => {
  const option = document.createElement("option");
  option.value = produto;
  sugestoesProdutoApp.appendChild(option);
}
);
