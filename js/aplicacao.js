// ===== VARIÁVEIS GLOBAIS =====
let aplicacoes = [];
let indiceEdicaoAplicacao = null;

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

  db.ref('Aplicacoes').set(aplicacoes)
    .then(() => {
      console.log("✅ Aplicação salva com sucesso no Firebase.");
      atualizarAplicacoes();
      limparCamposAplicacao();
    })
    .catch((error) => {
      console.error("❌ Erro ao salvar aplicação no Firebase:", error);
    });
}

// ===== CARREGAR APLICAÇÕES =====
function carregarAplicacoes() {
  db.ref('Aplicacoes').on('value', (snapshot) => {
    aplicacoes = snapshot.exists() ? Object.values(snapshot.val()) : [];
    atualizarAplicacoes();
  });
}

// ===== LIMPAR CAMPOS =====
function limparCamposAplicacao() {
  document.getElementById("dataApp").value = '';
  document.getElementById("produtoApp").value = '';
  document.getElementById("dosagemApp").value = '';
  document.getElementById("tipoApp").value = 'Adubo';
  document.getElementById("setorApp").value = 'Setor 01';
}

// ===== ATUALIZAR LISTA DE APLICAÇÕES =====
function atualizarAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  lista.innerHTML = '';

  aplicacoes.forEach((app, index) => {
    const item = document.createElement("div");
    item.className = "item-aplicacao";
    item.innerHTML = `
      <span>${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}</span>
      <button onclick="editarAplicacao(${index})"><i class="fas fa-edit"></i></button>
      <button onclick="excluirAplicacao(${index})"><i class="fas fa-trash"></i></button>
    `;
    lista.appendChild(item);
  });
}

// ===== EXCLUIR APLICAÇÃO =====
function excluirAplicacao(index) {
  aplicacoes.splice(index, 1);
  db.ref('Aplicacoes').set(aplicacoes);
  atualizarAplicacoes();
}

// ===== INICIAR AO CARREGAR =====
document.addEventListener("DOMContentLoaded", carregarAplicacoes);
