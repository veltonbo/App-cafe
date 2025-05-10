// ===== VARIÁVEIS GLOBAIS =====
let aplicacoes = [];
let indiceEdicaoAplicacao = null;

// ===== INICIALIZAR APLICAÇÕES =====
document.addEventListener("DOMContentLoaded", function() {
  carregarAplicacoes();
});

// ===== CARREGAR APLICAÇÕES =====
function carregarAplicacoes() {
  db.ref("Aplicacoes").on("value", (snapshot) => {
    aplicacoes = snapshot.exists() ? snapshot.val() : [];
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
    setor: document.getElementById("setorApp").value,
  };

  if (!nova.data || !nova.produto || !nova.dosagem || isNaN(parseFloat(nova.dosagem))) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  if (indiceEdicaoAplicacao !== null) {
    aplicacoes[indiceEdicaoAplicacao] = nova;
    indiceEdicaoAplicacao = null;
    document.getElementById("btnSalvarAplicacao").innerText = "Salvar Aplicação";
  } else {
    aplicacoes.push(nova);
  }

  db.ref("Aplicacoes").set(aplicacoes);
  atualizarAplicacoes();
  limparCamposAplicacao();
  document.getElementById("formularioAplicacao").style.display = "none";
}

// ===== CANCELAR EDIÇÃO =====
function cancelarEdicaoAplicacao() {
  indiceEdicaoAplicacao = null;
  limparCamposAplicacao();
  document.getElementById("btnSalvarAplicacao").innerText = "Salvar Aplicação";
}

// ===== LIMPAR CAMPOS =====
function limparCamposAplicacao() {
  document.getElementById("dataApp").value = "";
  document.getElementById("produtoApp").value = "";
  document.getElementById("dosagemApp").value = "";
  document.getElementById("tipoApp").value = "Adubo";
  document.getElementById("setorApp").value = "Setor 01";
}

// ===== ATUALIZAR LISTAGEM =====
function atualizarAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  lista.innerHTML = "";

  const filtroSetor = document.getElementById("filtroSetorAplicacoes")?.value || "";
  const termoBusca = document.getElementById("pesquisaAplicacoes")?.value.toLowerCase() || "";

  aplicacoes
    .filter(app =>
      (!filtroSetor || app.setor === filtroSetor) &&
      (`${app.produto} ${app.tipo} ${app.setor}`.toLowerCase().includes(termoBusca))
    )
    .sort((a, b) => b.data.localeCompare(a.data))
    .forEach((app, index) => {
      const item = document.createElement("div");
      item.className = "item";

      const span = document.createElement("span");
      span.textContent = `${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}`;
      item.appendChild(span);

      const botoes = document.createElement("div");
      botoes.className = "botoes-tarefa";

      // Botão Editar
      const botaoEditar = document.createElement("button");
      botaoEditar.className = "botao-circular azul";
      botaoEditar.innerHTML = '<i class="fas fa-edit"></i>';
      botaoEditar.onclick = () => editarAplicacao(index);
      botoes.appendChild(botaoEditar);

      // Botão Excluir
      const botaoExcluir = document.createElement("button");
      botaoExcluir.className = "botao-circular vermelho";
      botaoExcluir.innerHTML = '<i class="fas fa-trash"></i>';
      botaoExcluir.onclick = () => excluirAplicacao(index);
      botoes.appendChild(botaoExcluir);

      item.appendChild(botoes);
      lista.appendChild(item);
    });
}

// ===== EDITAR =====
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
}

// ===== EXCLUIR =====
function excluirAplicacao(index) {
  if (!confirm("Deseja excluir esta aplicação?")) return;
  aplicacoes.splice(index, 1);
  db.ref("Aplicacoes").set(aplicacoes);
  atualizarAplicacoes();
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

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `aplicacoes_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
}

// ===== ALTERNAR FORMULÁRIO E FILTROS =====
function alternarFormularioAplicacao() {
  const formulario = document.getElementById("formularioAplicacao");
  formulario.style.display = formulario.style.display === "none" ? "block" : "none";
}

function alternarFiltrosAplicacao() {
  const filtros = document.getElementById("filtrosAplicacoes");
  filtros.style.display = filtros.style.display === "none" ? "block" : "none";
}
