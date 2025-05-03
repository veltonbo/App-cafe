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
      item.className = 'item aparecendo';

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
