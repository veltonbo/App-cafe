// ===== VARIÁVEIS GLOBAIS =====
let aplicacoes = [];

// ===== CARREGAR APLICAÇÕES =====
function carregarAplicacoes() {
  // Exemplo de lista (simulação)
  aplicacoes = [
    { data: "2025-05-07", produto: "Adubo", dosagem: "200", tipo: "Adubo", setor: "Setor 01" },
    { data: "2025-05-08", produto: "Fungicida", dosagem: "150", tipo: "Fungicida", setor: "Setor 02" }
  ];
  atualizarAplicacoes();
}

// ===== ADICIONAR APLICAÇÃO =====
function adicionarAplicacao() {
  const nova = {
    data: document.getElementById("dataApp").value,
    produto: document.getElementById("produtoApp").value.trim(),
    dosagem: document.getElementById("dosagemApp").value.trim(),
    tipo: document.getElementById("tipoApp").value,
    setor: document.getElementById("setorApp").value
  };

  if (!nova.data || !nova.produto || !nova.dosagem) {
    alert("Preencha todos os campos.");
    return;
  }

  aplicacoes.push(nova);
  atualizarAplicacoes();
  limparCampos();
}

// ===== LIMPAR CAMPOS =====
function limparCampos() {
  document.getElementById("dataApp").value = '';
  document.getElementById("produtoApp").value = '';
  document.getElementById("dosagemApp").value = '';
}

// ===== ATUALIZAR LISTA =====
function atualizarAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  lista.innerHTML = '';

  aplicacoes.forEach((app, index) => {
    const item = document.createElement('div');
    item.className = "item";
    item.innerHTML = `
      <span>${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem}L - ${app.setor}</span>
      <div class="botoes">
        <button class="botao-icone" onclick="editarAplicacao(${index})"><i class="fas fa-edit"></i></button>
        <button class="botao-icone" onclick="excluirAplicacao(${index})"><i class="fas fa-trash"></i></button>
      </div>
    `;
    lista.appendChild(item);
  });
}

// ===== EDITAR APLICAÇÃO =====
function editarAplicacao(index) {
  const app = aplicacoes[index];
  document.getElementById("dataApp").value = app.data;
  document.getElementById("produtoApp").value = app.produto;
  document.getElementById("dosagemApp").value = app.dosagem;
}

// ===== EXCLUIR APLICAÇÃO =====
function excluirAplicacao(index) {
  aplicacoes.splice(index, 1);
  atualizarAplicacoes();
}

// ===== INICIALIZAR AO CARREGAR =====
document.addEventListener("DOMContentLoaded", carregarAplicacoes);
