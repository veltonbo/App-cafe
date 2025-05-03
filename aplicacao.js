// ====== VARIÁVEL GLOBAL ======
let aplicacoes = [];

// ====== FUNÇÕES MENU APLICAÇÕES ======
function carregarAplicacoes() {
  db.ref('Aplicacoes').once('value').then(snap => {
    aplicacoes = snap.exists() ? snap.val() : [];
    atualizarAplicacoes();
    atualizarSugestoesProduto();
  });
}

function atualizarAplicacoes() {
  const lista = document.getElementById('listaAplicacoes');
  lista.innerHTML = '';

  const filtroSetor = document.getElementById('filtroSetorAplicacoes').value;
  const termoBusca = document.getElementById('pesquisaAplicacoes').value.toLowerCase();

  const agrupado = {};

  aplicacoes
    .filter(app =>
      (!filtroSetor || app.setor === filtroSetor) &&
      (`${app.produto} ${app.tipo} ${app.setor}`.toLowerCase().includes(termoBusca))
    )
    .sort((a, b) => (a.data > b.data ? -1 : 1))
    .forEach((app, i) => {
      if (!agrupado[app.data]) agrupado[app.data] = [];
      agrupado[app.data].push({ ...app, i });
    });

  for (const data in agrupado) {
    const grupo = document.createElement('div');
    grupo.className = 'grupo-data';
    grupo.textContent = data;
    lista.appendChild(grupo);

    agrupado[data].forEach(({ produto, tipo, dosagem, setor, i }) => {
      const item = document.createElement('div');
      item.className = 'item fade-in';
      item.innerHTML = `
        <span>${produto} (${tipo}) - ${dosagem} - ${setor}</span>
        <div class="botoes-aplicacoes">
          <button class="botao-aplicacao" title="Excluir" onclick="excluirAplicacao(${i})">
           <i class="fas fa-trash-alt"></i>
            </button>
        </div>
      `;
      lista.appendChild(item);
    });
  }
}

function adicionarAplicacao() {
  const nova = {
    data: document.getElementById('dataApp').value,
    produto: document.getElementById('produtoApp').value.trim(),
    dosagem: document.getElementById('dosagemApp').value.trim(),
    tipo: document.getElementById('tipoApp').value,
    setor: document.getElementById('setorApp').value
  };

  const hoje = new Date().toISOString().split('T')[0];
  if (!nova.data || !nova.produto || !nova.dosagem) {
    alert("Preencha todos os campos!");
    return;
  }

  if (nova.data > hoje) {
    alert("A data não pode ser no futuro.");
    return;
  }

  if (isNaN(parseFloat(nova.dosagem)) || parseFloat(nova.dosagem) <= 0) {
    alert("A dosagem deve ser um número positivo.");
    return;
  }

  aplicacoes.push(nova);
  db.ref('Aplicacoes').set(aplicacoes);
  atualizarAplicacoes();
  atualizarSugestoesProduto();

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

function exportarAplicacoesCSV() {
  if (!aplicacoes.length) {
    alert("Nenhuma aplicação para exportar.");
    return;
  }

  let csv = 'Data,Produto,Dosagem,Tipo,Setor\n';

  aplicacoes.forEach(app => {
    csv += `${app.data},${app.produto},${app.dosagem},${app.tipo},${app.setor}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'aplicacoes.csv');
  link.click();
}

function atualizarSugestoesProduto() {
  const datalist = document.getElementById('sugestoesProdutoApp');
  const produtosUnicos = [...new Set(aplicacoes.map(app => app.produto.trim()).filter(Boolean))];

  datalist.innerHTML = produtosUnicos
    .map(prod => `<option value="${prod}">`)
    .join('');
}
