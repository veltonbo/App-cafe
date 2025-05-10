// aplicacao.js
document.addEventListener('DOMContentLoaded', () => {
  if (typeof db === 'undefined') {
    console.error("Firebase não está configurado corretamente.");
    return;
  }
  carregarAplicacoes();
});

// Variáveis Globais
let aplicacoes = [];
let indiceEdicaoAplicacao = null;

// Carregar Aplicações
function carregarAplicacoes() {
  db.ref('Aplicacoes').on('value', snapshot => {
    aplicacoes = snapshot.exists() ? snapshot.val() : [];
    atualizarAplicacoes();
  });
}

// Adicionar ou Editar Aplicação
function adicionarAplicacao() {
  const nova = {
    data: document.getElementById("dataApp").value,
    produto: document.getElementById("produtoApp").value.trim(),
    dosagem: document.getElementById("dosagemApp").value.trim(),
    tipo: document.getElementById("tipoApp").value,
    setor: document.getElementById("setorApp").value
  };

  if (!nova.data || !nova.produto || !nova.dosagem) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  if (indiceEdicaoAplicacao !== null) {
    aplicacoes[indiceEdicaoAplicacao] = nova;
    indiceEdicaoAplicacao = null;
  } else {
    aplicacoes.push(nova);
  }

  db.ref('Aplicacoes').set(aplicacoes);
  atualizarAplicacoes();
  limparCamposAplicacao();
}

// Cancelar Edição
function cancelarEdicaoAplicacao() {
  indiceEdicaoAplicacao = null;
  limparCamposAplicacao();
  document.getElementById("btnSalvarAplicacao").innerText = "Salvar Aplicação";
}

// Limpar Campos
function limparCamposAplicacao() {
  document.getElementById("dataApp").value = '';
  document.getElementById("produtoApp").value = '';
  document.getElementById("dosagemApp").value = '';
  document.getElementById("tipoApp").value = 'Adubo';
  document.getElementById("setorApp").value = 'Setor 01';
}

// Atualizar Aplicações
function atualizarAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  lista.innerHTML = '';

  aplicacoes.forEach((app, index) => {
    const item = document.createElement("div");
    item.classList.add("item");

    item.innerHTML = `
      <span>${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}</span>
      <div class="acoes">
        <button onclick="editarAplicacao(${index})"><i class="fas fa-edit"></i></button>
        <button onclick="excluirAplicacao(${index})"><i class="fas fa-trash"></i></button>
      </div>
    `;
    lista.appendChild(item);
  });
}

// Editar Aplicação
function editarAplicacao(index) {
  const app = aplicacoes[index];
  document.getElementById("dataApp").value = app.data;
  document.getElementById("produtoApp").value = app.produto;
  document.getElementById("dosagemApp").value = app.dosagem;
  document.getElementById("tipoApp").value = app.tipo;
  document.getElementById("setorApp").value = app.setor;

  indiceEdicaoAplicacao = index;
  document.getElementById("btnSalvarAplicacao").innerText = "Salvar Edição";
}

// Excluir Aplicação
function excluirAplicacao(index) {
  if (confirm("Deseja excluir esta aplicação?")) {
    aplicacoes.splice(index, 1);
    db.ref('Aplicacoes').set(aplicacoes);
    atualizarAplicacoes();
  }
}

// Exportar Aplicações CSV
function exportarAplicacoesCSV() {
  let csvContent = "data:text/csv;charset=utf-8,Data,Produto,Dosagem,Tipo,Setor\n";
  aplicacoes.forEach(app => {
    csvContent += `${app.data},${app.produto},${app.dosagem},${app.tipo},${app.setor}\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "aplicacoes.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
