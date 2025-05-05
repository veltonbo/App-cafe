// ===== VARIÁVEIS GLOBAIS =====
let aplicacoes = [];
let indiceEdicaoAplicacao = null;

// ===== CARREGAR APLICAÇÕES =====
function carregarAplicacoes() {
  db.ref('Aplicacoes').on('value', snap => {
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
    document.getElementById("btnCancelarEdicaoApp").style.display = "none";
    document.getElementById("btnSalvarAplicacao").innerText = "Salvar Aplicação";
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
    .forEach((app, i) => {
      const item = document.createElement("div");
      item.className = "item fade-in";

      // Cria os botões
      const botoes = document.createElement("div");
      botoes.className = "botoes-aplicacao";

      const botaoEditar = document.createElement("button");
      botaoEditar.className = "botao-circular azul";
      botaoEditar.innerHTML = `<i class="fas fa-edit"></i>`;
      botaoEditar.onclick = () => editarAplicacao(i);
      botoes.appendChild(botaoEditar);

      const botaoExcluir = document.createElement("button");
      botaoExcluir.className = "botao-circular vermelho";
      botaoExcluir.innerHTML = `<i class="fas fa-trash"></i>`;
      botaoExcluir.onclick = () => excluirAplicacao(i);
      botoes.appendChild(botaoExcluir);

      // Ajusta dinamicamente o padding do texto
      const qtdBotoes = botoes.childElementCount;
      const paddingDireito = 12 + (qtdBotoes * 48); // 48px por botão (38 largura + 10px gap)
      item.style.paddingRight = `${paddingDireito}px`;

      const texto = document.createElement("span");
      texto.innerText = `${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}`;

      item.appendChild(texto);
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
  document.getElementById("btnCancelarEdicaoApp").style.display = "inline-block";
}

// ===== EXCLUIR =====
function excluirAplicacao(index) {
  if (!confirm("Deseja excluir esta aplicação?")) return;
  aplicacoes.splice(index, 1);
  db.ref('Aplicacoes').set(aplicacoes);
  atualizarAplicacoes();
}

// ===== SUGESTÕES DE PRODUTO =====
function atualizarSugestoesProdutoApp() {
  const lista = document.getElementById("sugestoesProdutoApp");
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
