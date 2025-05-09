<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Manejo Café</title>

  <!-- Firebase -->
  <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"></script>

  <!-- FontAwesome -->
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" rel="stylesheet" />

  <!-- Chart.js -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

  <!-- jsPDF -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>

  <!-- Estilos -->
  <link rel="stylesheet" href="css/style.css" />

  <!-- Scripts -->
  <script defer src="js/firebase-config.js"></script>
  <script defer src="js/main.js"></script>
  <script defer src="js/aplicacao.js"></script>
  <script defer src="js/tarefas.js"></script>
  <script defer src="js/financeiro.js"></script>
  <script defer src="js/colheita.js"></script>
  <script defer src="js/relatorio.js"></script>
  <script defer src="js/configuracoes.js"></script>
</head>

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
      const item = document.createElement('div');
      
      // Define a quantidade de botões: sempre 2 por padrão (Editar + Excluir)
      const numBotoes = 2;

      item.className = `item fade-in botoes-${numBotoes}`;
      item.style.position = 'relative';
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.justifyContent = 'space-between';
      item.style.paddingRight = '90px';

      const span = document.createElement('span');
      span.textContent = `${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}`;
      span.style.flexGrow = '1';
      span.style.wordBreak = 'break-word';
      item.appendChild(span);

      const botoes = document.createElement('div');
      botoes.className = 'botoes-tarefa';

      // Botão Editar
      const botaoEditar = document.createElement('button');
      botaoEditar.className = 'botao-circular azul';
      botaoEditar.innerHTML = '<i class="fas fa-edit"></i>';
      botaoEditar.onclick = () => editarAplicacao(i);
      botoes.appendChild(botaoEditar);

      // Botão Excluir
      const botaoExcluir = document.createElement('button');
      botaoExcluir.className = 'botao-circular vermelho';
      botaoExcluir.innerHTML = '<i class="fas fa-trash"></i>';
      botaoExcluir.onclick = () => excluirAplicacao(i);
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
