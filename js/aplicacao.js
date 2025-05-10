// ===== CONFIGURAÇÃO FIREBASE =====
const db = firebase.database();

// ===== VARIÁVEIS GLOBAIS =====
let aplicacoes = [];
let indiceEdicaoAplicacao = null;

// ===== INICIALIZAÇÃO =====
document.addEventListener("DOMContentLoaded", () => {
  carregarAplicacoes();
});

// ===== FUNÇÃO: CARREGAR APLICAÇÕES =====
function carregarAplicacoes() {
  db.ref('Aplicacoes').on('value', snapshot => {
    aplicacoes = snapshot.exists() ? Object.values(snapshot.val()) : [];
    atualizarAplicacoes();
  });
}

// ===== FUNÇÃO: ADICIONAR OU EDITAR APLICAÇÃO =====
function adicionarAplicacao() {
  const novaAplicacao = {
    data: document.getElementById("dataApp").value,
    produto: document.getElementById("produtoApp").value.trim(),
    dosagem: document.getElementById("dosagemApp").value.trim(),
    tipo: document.getElementById("tipoApp").value,
    setor: document.getElementById("setorApp").value
  };

  if (!novaAplicacao.data || !novaAplicacao.produto || !novaAplicacao.dosagem) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  if (indiceEdicaoAplicacao !== null) {
    aplicacoes[indiceEdicaoAplicacao] = novaAplicacao;
    indiceEdicaoAplicacao = null;
    document.getElementById("btnSalvarAplicacao").innerText = "Salvar Aplicação";
  } else {
    aplicacoes.push(novaAplicacao);
  }

  db.ref('Aplicacoes').set(aplicacoes);
  limparCamposAplicacao();
  atualizarAplicacoes();
}

// ===== FUNÇÃO: CANCELAR EDIÇÃO =====
function cancelarEdicaoAplicacao() {
  indiceEdicaoAplicacao = null;
  limparCamposAplicacao();
  document.getElementById("btnSalvarAplicacao").innerText = "Salvar Aplicação";
  document.getElementById("btnCancelarEdicaoApp").style.display = "none";
}

// ===== FUNÇÃO: LIMPAR CAMPOS =====
function limparCamposAplicacao() {
  document.getElementById("dataApp").value = '';
  document.getElementById("produtoApp").value = '';
  document.getElementById("dosagemApp").value = '';
  document.getElementById("tipoApp").value = 'Adubo';
  document.getElementById("setorApp").value = 'Setor 01';
  document.getElementById("formularioAplicacao").style.display = "none";
}

// ===== FUNÇÃO: ATUALIZAR LISTA DE APLICAÇÕES =====
function atualizarAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  lista.innerHTML = '';

  const filtroSetor = document.getElementById("filtroSetorAplicacoes").value;
  const termoBusca = document.getElementById("pesquisaAplicacoes").value.toLowerCase();

  aplicacoes
    .filter(app => 
      (!filtroSetor || app.setor === filtroSetor) &&
      (app.produto.toLowerCase().includes(termoBusca))
    )
    .sort((a, b) => b.data.localeCompare(a.data))
    .forEach((app, index) => {
      const item = document.createElement("div");
      item.className = "item";

      const info = document.createElement("span");
      info.textContent = `${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}`;
      item.appendChild(info);

      const acoes = document.createElement("div");
      acoes.className = "acoes";

      const btnEditar = document.createElement("button");
      btnEditar.innerHTML = '<i class="fas fa-edit"></i>';
      btnEditar.className = "botao-circular azul";
      btnEditar.onclick = () => editarAplicacao(index);
      acoes.appendChild(btnEditar);

      const btnExcluir = document.createElement("button");
      btnExcluir.innerHTML = '<i class="fas fa-trash"></i>';
      btnExcluir.className = "botao-circular vermelho";
      btnExcluir.onclick = () => excluirAplicacao(index);
      acoes.appendChild(btnExcluir);

      item.appendChild(acoes);
      lista.appendChild(item);
    });
}

// ===== FUNÇÃO: EDITAR APLICAÇÃO =====
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

// ===== FUNÇÃO: EXCLUIR APLICAÇÃO =====
function excluirAplicacao(index) {
  if (!confirm("Deseja excluir esta aplicação?")) return;
  aplicacoes.splice(index, 1);
  db.ref('Aplicacoes').set(aplicacoes);
  atualizarAplicacoes();
}

// ===== FUNÇÃO: EXPORTAR CSV =====
function exportarAplicacoesCSV() {
  if (aplicacoes.length === 0) {
    alert("Nenhum dado para exportar.");
    return;
  }

  let csv = "Data,Produto,Dosagem,Tipo,Setor\n";
  aplicacoes.forEach(app => {
    csv += `${app.data},${app.produto},${app.dosagem},${app.tipo},${app.setor}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "aplicacoes.csv";
  link.click();
}

// ===== FUNÇÃO: TOGGLE FORMULÁRIO =====
function alternarFormularioAplicacao() {
  const form = document.getElementById("formularioAplicacao");
  form.style.display = form.style.display === "none" ? "block" : "none";
}

// ===== FUNÇÃO: TOGGLE FILTROS =====
function alternarFiltrosAplicacao() {
  const filtros = document.querySelector(".filtros-aplicacoes");
  filtros.style.display = filtros.style.display === "none" ? "flex" : "none";
}
