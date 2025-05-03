// ====== VARIÁVEL GLOBAL ======
let aplicacoes = [];

// ====== FUNÇÕES MENU APLICAÇÕES ======
function carregarAplicacoes() {
  db.ref('Aplicacoes').once('value').then(snap => {
    aplicacoes = snap.exists() ? snap.val() : [];
    atualizarAplicacoes();
  });
}

function atualizarAplicacoes() {
  const lista = document.getElementById('listaAplicacoes');
  lista.innerHTML = '';

  const filtroSetor = document.getElementById('filtroSetorAplicacoes').value;
  const termoBusca = document.getElementById('pesquisaAplicacoes').value.toLowerCase();

  aplicacoes
    .filter(app =>
      (!filtroSetor || app.setor === filtroSetor) &&
      (`${app.produto} ${app.tipo} ${app.setor}`.toLowerCase().includes(termoBusca))
    )
    .sort((a, b) => (a.data > b.data ? -1 : 1))
    .forEach((app, i) => {
      const item = document.createElement('div');
      item.className = 'item';
      item.innerHTML = `
  <span>${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}</span>
  <div class="botoes-financeiro">
    <button class="botao-excluir" onclick="excluirAplicacao(${i})">
      <i class="fas fa-trash-alt"></i> Excluir
    </button>
  </div>
`;

      lista.appendChild(item);
    });
}

function adicionarAplicacao() {
  const nova = {
    data: document.getElementById('dataApp').value,
    produto: document.getElementById('produtoApp').value.trim(),
    dosagem: document.getElementById('dosagemApp').value.trim(),
    tipo: document.getElementById('tipoApp').value,
    setor: document.getElementById('setorApp').value
  };

  if (!nova.data || !nova.produto || !nova.dosagem) {
    alert("Preencha todos os campos!");
    return;
  }

  aplicacoes.push(nova);
  db.ref('Aplicacoes').set(aplicacoes);
  atualizarAplicacoes();

  document.getElementById('dataApp').value = '';
  document.getElementById('produtoApp').value = '';
  document.getElementById('dosagemApp').value = '';
}

function excluirAplicacao(index) {
  if (!confirm("Deseja excluir esta aplicação?")) return;

  aplicacoes.splice(index, 1);
  db.ref('Aplicacoes').set(aplicacoes);
  atualizarAplicacoes();
}
