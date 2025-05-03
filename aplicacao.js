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
        <div class="botoes-financeiro">
          <button class="botao-excluir" onclick="excluirAplicacao(${i})">
            <i class="fas fa-trash-alt"></i> Excluir
          </button>
        </div>
      `;
      lista.appendChild(item);
    });
  }
}

function adicionarAplicacao() {
  const data = document.getElementById('dataApp');
  const produto = document.getElementById('produtoApp');
  const dosagem = document.getElementById('dosagemApp');
  const tipo = document.getElementById('tipoApp');
  const setor = document.getElementById('setorApp');

  // Remover erros visuais
  [data, produto, dosagem].forEach(el => el.classList.remove('input-erro'));

  let erro = false;

  if (!data.value) { data.classList.add('input-erro'); erro = true; }
  if (!produto.value.trim()) { produto.classList.add('input-erro'); erro = true; }
  if (!dosagem.value.trim()) { dosagem.classList.add('input-erro'); erro = true; }

  if (erro) {
    alert("Preencha todos os campos obrigatórios.");
    return;
  }

  const nova = {
    data: data.value,
    produto: produto.value.trim(),
    dosagem: dosagem.value.trim(),
    tipo: tipo.value,
    setor: setor.value
  };

  aplicacoes.push(nova);
  db.ref('Aplicacoes').set(aplicacoes);
  atualizarAplicacoes();

  data.value = '';
  produto.value = '';
  dosagem.value = '';
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
