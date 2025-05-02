// ====== VARIÁVEIS ======
let aplicacoes = [];

// ====== ADICIONAR APLICAÇÃO ======
function adicionarAplicacao() {
  const nova = {
    data: dataApp.value,
    produto: produtoApp.value,
    dosagem: dosagemApp.value,
    tipo: tipoApp.value,
    setor: setorApp.value
  };

  if (!nova.data || !nova.produto || !nova.dosagem) {
    alert("Preencha todos os campos da aplicação!");
    return;
  }

  aplicacoes.push(nova);
  db.ref('Aplicacoes').set(aplicacoes);
  atualizarAplicacoes();

  dataApp.value = '';
  produtoApp.value = '';
  dosagemApp.value = '';
}

function atualizarAplicacoes() {
  const filtro = pesquisaAplicacoes.value.toLowerCase();
  const filtroSetor = filtroSetorAplicacoes.value;
  const lista = document.getElementById('listaAplicacoes');
  lista.innerHTML = '';

  const agrupado = {};

  aplicacoes.filter(a =>
    (`${a.data} ${a.produto} ${a.dosagem} ${a.tipo} ${a.setor}`.toLowerCase().includes(filtro)) &&
    (filtroSetor === "" || a.setor === filtroSetor)
  ).forEach((a, i) => {
    if (!agrupado[a.data]) agrupado[a.data] = [];
    agrupado[a.data].push({ ...a, i });
  });

  for (const data in agrupado) {
    const titulo = document.createElement('div');
    titulo.className = 'grupo-data';
    titulo.textContent = data;
    lista.appendChild(titulo);

    agrupado[data].forEach(({ produto, dosagem, tipo, setor, i }) => {
      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML = `
        <span>${produto} (${dosagem}) - ${tipo} - ${setor}</span>
        <div class="botoes-financeiro">
          <button class="botao-excluir" onclick="excluirAplicacao(${i})">Excluir</button>
        </div>
      `;
      lista.appendChild(div);
    });
  }
}

function excluirAplicacao(index) {
  aplicacoes.splice(index, 1);
  db.ref('Aplicacoes').set(aplicacoes);
  atualizarAplicacoes();
}

function carregarAplicacoes() {
  db.ref('Aplicacoes').on('value', snap => {
    if (snap.exists()) {
      aplicacoes.length = 0;
      aplicacoes.push(...snap.val());
      atualizarAplicacoes();
    }
  });
}
