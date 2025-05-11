// ===== VARIÁVEIS GLOBAIS =====
let aplicacoes = [];
let indiceEdicaoAplicacao = null; // Variável para controlar a edição

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

  const novaAplicacao = {
    data: dataApp,
    produto: produtoApp,
    dosagem: dosagemApp,
    tipo: tipoApp,
    setor: setorApp
  };

  if (indiceEdicaoAplicacao !== null) {
    // Atualizar aplicação existente
    aplicacoes[indiceEdicaoAplicacao] = novaAplicacao;
    indiceEdicaoAplicacao = null;
  } else {
    // Adicionar nova aplicação
    aplicacoes.push(novaAplicacao);
  }

  // Salvar no Firebase
  db.ref('Aplicacoes').set(aplicacoes.reduce((acc, app, index) => {
    acc[index] = app;
    return acc;
  }, {}));

  atualizarAplicacoes();
  limparCamposAplicacao();
  alternarFormularioAplicacao(false);
}

// ===== EDITAR APLICAÇÃO =====
function editarAplicacao(index) {
  const app = aplicacoes[index];
  if (!app) return;

  // Exibir o formulário e preencher os campos corretamente
  document.getElementById("formularioAplicacao").style.display = "block";
  document.getElementById("dataApp").value = app.data || '';
  document.getElementById("produtoApp").value = app.produto || '';
  document.getElementById("dosagemApp").value = app.dosagem || '';
  document.getElementById("tipoApp").value = app.tipo || 'Adubo';
  document.getElementById("setorApp").value = app.setor || 'Setor 01';

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
  document.getElementById("formularioAplicacao").style.display = "none";
}

// ===== LIMPAR CAMPOS =====
function limparCamposAplicacao() {
  document.getElementById("dataApp").value = '';
  document.getElementById("produtoApp").value = '';
  document.getElementById("dosagemApp").value = '';
  document.getElementById("tipoApp").value = 'Adubo';
  document.getElementById("setorApp").value = 'Setor 01';
  document.getElementById("btnCancelarEdicaoApp").style.display = "none";
  document.getElementById("btnSalvarAplicacao").innerText = "Salvar Aplicação";
}

// ===== FILTRAR APLICAÇÕES =====
function filtrarAplicacoes() {
  const termo = document.getElementById("campoPesquisaAplicacoes").value.toLowerCase();
  const lista = document.getElementById("listaAplicacoes");
  lista.innerHTML = '';

  aplicacoes
    .filter(app => 
      app.data.toLowerCase().includes(termo) ||
      app.produto.toLowerCase().includes(termo) ||
      app.dosagem.toLowerCase().includes(termo) ||
      app.tipo.toLowerCase().includes(termo) ||
      app.setor.toLowerCase().includes(termo)
    )
    .forEach((app, i) => {
      const item = document.createElement('div');
      item.className = 'item';
      item.innerHTML = `
        <span>${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}</span>
        <div class="botoes-aplicacao">
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

// ===== ATUALIZAR LISTAGEM =====
function atualizarAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  if (!lista) return;
  lista.innerHTML = '';

  aplicacoes.forEach((app, i) => {
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
      <span>${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}</span>
      <div class="botoes-aplicacao">
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

// ===== EXCLUIR APLICAÇÃO =====
function excluirAplicacao(index) {
  if (!confirm("Deseja excluir esta aplicação?")) return;
  aplicacoes.splice(index, 1);
  
  db.ref('Aplicacoes').set(aplicacoes.reduce((acc, app, idx) => {
    acc[idx] = app;
    return acc;
  }, {}));

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

// ===== ALTERNAR FORMULÁRIO APLICAÇÃO =====
function alternarFormularioAplicacao() {
  const form = document.getElementById("formularioAplicacao");
  form.style.display = form.style.display === "none" ? "block" : "none";
}

// ===== INICIALIZAR APLICAÇÕES =====
document.addEventListener("dadosCarregados", carregarAplicacoes);
