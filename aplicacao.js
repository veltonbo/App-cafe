// ====== VARIÁVEL GLOBAL ======
let aplicacoes = [];

// ====== FUNÇÕES MENU APLICAÇÕES ======

function adicionarAplicacao() {
  const nova = {
    data: dataApp.value,
    produto: produtoApp.value.trim(),
    dosagem: dosagemApp.value.trim(),
    tipo: tipoApp.value,
    setor: setorApp.value
  };

  if (!nova.data || !nova.produto || !nova.dosagem || !nova.tipo || !nova.setor) {
    alert("Preencha todos os campos da aplicação!");
    return;
  }

  aplicacoes.push(nova);
  db.ref('Aplicacoes').set(aplicacoes);
  atualizarAplicacoes();

  dataApp.value = '';
  produtoApp.value = '';
  dosagemApp.value = '';
  tipoApp.selectedIndex = 0;
  setorApp.selectedIndex = 0;
}

function atualizarAplicacoes() {
  const filtro = pesquisaAplicacoes.value.toLowerCase();
  const setorSelecionado = filtroSetorAplicacoes.value;
  const lista = document.getElementById('listaAplicacoes');
  lista.innerHTML = '';

  const agrupado = {};

  aplicacoes
    .filter(app =>
      (`${app.data} ${app.produto} ${app.tipo} ${app.setor}`.toLowerCase().includes(filtro)) &&
      (setorSelecionado === "" || app.setor === setorSelecionado)
    )
    .forEach((app, i) => {
      if (!agrupado[app.data]) agrupado[app.data] = [];
      agrupado[app.data].push({ ...app, i });
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
        <span>${produto} - ${dosagem} (${tipo}) - ${setor}</span>
        <div class="botoes-financeiro">
          <button class="botao-excluir" onclick="excluirAplicacao(${i})">Excluir</button>
        </div>
      `;
      lista.appendChild(div);
    });
  }
}

function excluirAplicacao(index) {
  if (confirm("Deseja excluir essa aplicação?")) {
    aplicacoes.splice(index, 1);
    db.ref('Aplicacoes').set(aplicacoes);
    atualizarAplicacoes();
  }
}

function carregarAplicacoes() {
  db.ref('Aplicacoes').on('value', snap => {
    if (snap.exists()) {
      aplicacoes.length = 0;
      aplicacoes.push(...snap.val());
    }
    atualizarAplicacoes();
  });
}
