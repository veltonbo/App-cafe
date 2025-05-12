// ===== CONSTANTES E VARIÁVEIS =====
const TIPOS_APLICACAO = ['Adubo', 'Defensivo', 'Corretivo', 'Inoculante'];
const SETORES = ['Setor 01', 'Setor 02', 'Setor 03', 'Setor 04'];
let aplicacoes = [];
let indiceEdicao = null;
let produtosSugeridos = [];

// ===== INICIALIZAÇÃO =====
document.addEventListener("DOMContentLoaded", () => {
  inicializarSelects();
  carregarAplicacoes();
  configurarEventListeners();
});

function inicializarSelects() {
  const tipoSelect = document.getElementById("tipoApp");
  const setorSelect = document.getElementById("setorApp");

  TIPOS_APLICACAO.forEach(tipo => {
    tipoSelect.innerHTML += `<option value="${tipo}">${tipo}</option>`;
  });

  SETORES.forEach(setor => {
    setorSelect.innerHTML += `<option value="${setor}">${setor}</option>`;
  });
}

// ===== GERENCIAMENTO DE APLICAÇÕES =====
function adicionarAplicacao() {
  const aplicacao = obterDadosFormulario();
  const erros = validarAplicacao(aplicacao);

  if (erros.length > 0) {
    mostrarErros(erros);
    return;
  }

  if (indiceEdicao !== null) {
    aplicarEdicao(aplicacao);
  } else {
    criarNovaAplicacao(aplicacao);
  }

  limparFormulario();
  atualizarUI();
}

function obterDadosFormulario() {
  return {
    data: document.getElementById("dataApp").value,
    produto: document.getElementById("produtoApp").value.trim(),
    dosagem: document.getElementById("dosagemApp").value.trim(),
    tipo: document.getElementById("tipoApp").value,
    setor: document.getElementById("setorApp").value,
    observacoes: document.getElementById("obsApp").value.trim()
  };
}

function validarAplicacao(app) {
  const erros = [];
  
  if (!app.data) erros.push("Data é obrigatória");
  if (!app.produto) erros.push("Produto é obrigatório");
  if (!app.dosagem) erros.push("Dosagem é obrigatória");
  if (isNaN(parseFloat(app.dosagem))) erros.push("Dosagem deve ser um número");
  
  // Validação de data futura
  if (new Date(app.data) > new Date()) {
    erros.push("Data não pode ser futura");
  }
  
  return erros;
}

// ===== GERENCIAMENTO DE ESTADO =====
function aplicarEdicao(aplicacao) {
  aplicacoes[indiceEdicao] = aplicacao;
  indiceEdicao = null;
  document.getElementById("btnCancelarEdicao").style.display = "none";
}

function criarNovaAplicacao(aplicacao) {
  aplicacoes.push({
    ...aplicacao,
    id: Date.now().toString(),
    registradoEm: new Date().toISOString()
  });
  
  // Atualiza sugestões de produtos
  if (!produtosSugeridos.includes(aplicacao.produto)) {
    produtosSugeridos.push(aplicacao.produto);
    atualizarSugestoesProduto();
  }
}

// ===== INTERFACE DO USUÁRIO =====
function atualizarUI() {
  atualizarListaAplicacoes();
  atualizarResumo();
  atualizarSugestoesProduto();
}

function atualizarListaAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  lista.innerHTML = aplicacoes
    .sort((a, b) => new Date(b.data) - new Date(a.data))
    .map((app, index) => `
      <div class="aplicacao-item ${app.tipo.toLowerCase()}">
        <div class="info">
          <span class="data">${formatarData(app.data)}</span>
          <span class="produto">${app.produto}</span>
          <span class="detalhes">${app.dosagem} - ${app.setor}</span>
          ${app.observacoes ? `<p class="obs">${app.observacoes}</p>` : ''}
        </div>
        <div class="acoes">
          <button onclick="editarAplicacao(${index})" class="btn-editar">
            <i class="fas fa-edit"></i>
          </button>
          <button onclick="confirmarExclusao(${index})" class="btn-excluir">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `)
    .join('');
}

function editarAplicacao(index) {
  const app = aplicacoes[index];
  if (!app) return;

  preencherFormulario(app);
  indiceEdicao = index;
  document.getElementById("btnCancelarEdicao").style.display = "inline-block";
  scrollParaFormulario();
}

function confirmarExclusao(index) {
  Swal.fire({
    title: 'Confirmar exclusão?',
    text: "Esta ação não pode ser desfeita!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Sim, excluir!'
  }).then((result) => {
    if (result.isConfirmed) {
      excluirAplicacao(index);
    }
  });
}

function excluirAplicacao(index) {
  aplicacoes.splice(index, 1);
  atualizarUI();
  mostrarFeedback("Aplicação excluída com sucesso!", "success");
}

// ===== FUNÇÕES AUXILIARES =====
function formatarData(dataStr) {
  const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
  return new Date(dataStr).toLocaleDateString('pt-BR', options);
}

function mostrarErros(erros) {
  Swal.fire({
    icon: 'error',
    title: 'Erro no formulário',
    html: erros.map(erro => `• ${erro}`).join('<br>'),
    confirmButtonText: 'Entendi'
  });
}

function mostrarFeedback(mensagem, tipo) {
  Toastify({
    text: mensagem,
    duration: 3000,
    close: true,
    gravity: "top",
    position: "right",
    backgroundColor: tipo === "success" ? "#28a745" : "#dc3545"
  }).showToast();
}

// ===== INTEGRAÇÃO COM FIREBASE =====
function carregarAplicacoes() {
  db.ref('Aplicacoes').on('value', (snapshot) => {
    const dados = snapshot.val() || {};
    aplicacoes = Object.values(dados);
    produtosSugeridos = [...new Set(aplicacoes.map(a => a.produto))];
    atualizarUI();
  });
}

function salvarAplicacoes() {
  db.ref('Aplicacoes').set(aplicacoes.reduce((acc, app, index) => {
    acc[index] = app;
    return acc;
  }, {}));
}

// ===== EVENT LISTENERS =====
function configurarEventListeners() {
  // Auto-complete para produtos
  document.getElementById("produtoApp").addEventListener("input", (e) => {
    const input = e.target;
    const datalist = document.getElementById("sugestoesProduto");
    const valor = input.value.toLowerCase();
    
    datalist.innerHTML = produtosSugeridos
      .filter(p => p.toLowerCase().includes(valor))
      .map(p => `<option value="${p}">`)
      .join('');
  });

  // Validação em tempo real
  document.getElementById("dosagemApp").addEventListener("blur", (e) => {
    if (isNaN(parseFloat(e.target.value))) {
      e.target.classList.add("invalido");
      mostrarFeedback("Dosagem deve ser um número", "error");
    } else {
      e.target.classList.remove("invalido");
    }
  });
}

// ===== EXPORTAÇÃO =====
function exportarParaPlanilha() {
  const csv = [
    "Data,Produto,Dosagem,Tipo,Setor,Observações",
    ...aplicacoes.map(app => 
      `"${app.data}","${app.produto}","${app.dosagem}","${app.tipo}","${app.setor}","${app.observacoes || ''}"`
    )
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `aplicacoes_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}
