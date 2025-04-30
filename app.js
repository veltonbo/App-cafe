// Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD773S1h91tovlKTPbaeAZbN2o1yxROcOc",
  authDomain: "manej-cafe.firebaseapp.com",
  databaseURL: "https://manej-cafe-default-rtdb.firebaseio.com",
  projectId: "manej-cafe",
  storageBucket: "manej-cafe.appspot.com",
  messagingSenderId: "808931200634",
  appId: "1:808931200634:web:71357af2ff0dc2e4f5f5c3"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Variáveis globais
const aplicacoes = [], tarefas = [], tarefasFeitas = [], financeiro = [], colheita = [];
let valorLataGlobal = 0;

// Inicialização
window.onload = () => {
  mostrarAba(localStorage.getItem('aba') || 'aplicacoes');
  if (localStorage.getItem('tema') === 'claro') {
    document.body.classList.add('claro');
  }
  carregarAplicacoes();
  carregarTarefas();
  carregarFinanceiro();
  carregarColheita();
  carregarValorLata();
};

// Funções gerais
function mostrarAba(id) {
  document.querySelectorAll('.aba').forEach(a => a.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  localStorage.setItem('aba', id);
  document.querySelectorAll('.menu-superior button').forEach(btn => {
    btn.classList.toggle('active', btn.id === 'btn-' + id);
  });
}

function alternarTema() {
  document.body.classList.toggle('claro');
  localStorage.setItem('tema', document.body.classList.contains('claro') ? 'claro' : 'escuro');
}

// Aplicações
function adicionarAplicacao() {
  const nova = {
    data: dataApp.value,
    produto: produtoApp.value,
    dosagem: dosagemApp.value,
    tipo: tipoApp.value,
    setor: setorApp.value
  };
  if (!nova.data || !nova.produto || !nova.dosagem) return alert("Preencha tudo!");
  aplicacoes.push(nova);
  db.ref('Aplicacoes').set(aplicacoes);
  atualizarAplicacoes();
}

function atualizarAplicacoes() {
  const filtro = pesquisaAplicacoes.value.toLowerCase();
  const filtroSetor = filtroSetorAplicacoes.value;
  listaAplicacoes.innerHTML = '';

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
    listaAplicacoes.appendChild(titulo);

    agrupado[data].forEach(({ produto, dosagem, tipo, setor, i }) => {
      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML = `
        <span>${produto} (${dosagem}) - ${tipo} - ${setor}</span>
        <button class="botao-excluir" onclick="excluirAplicacao(${i})">Excluir</button>
      `;
      listaAplicacoes.appendChild(div);
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

// Tarefas
function adicionarTarefa() {
  const nova = {
    data: dataTarefa.value,
    descricao: descricaoTarefa.value,
    prioridade: prioridadeTarefa.value,
    setor: setorTarefa.value,
    executada: false
  };
  if (!nova.data || !nova.descricao) return alert("Preencha tudo!");
  tarefas.push(nova);
  db.ref('Tarefas').set([...tarefas, ...tarefasFeitas]);
  atualizarTarefas();
}

function atualizarTarefas() {
  listaTarefas.innerHTML = '';
  listaTarefasFeitas.innerHTML = '';

  tarefas.forEach((t, i) => {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <input type="checkbox" onchange="marcarTarefa(${i}, true)">
      <span>${t.data} - ${t.descricao} (${t.prioridade}) - ${t.setor}</span>
      <button class="botao-excluir" onclick="excluirTarefa(${i}, false)">Excluir</button>
    `;
    listaTarefas.appendChild(div);
  });

  tarefasFeitas.forEach((t, i) => {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <input type="checkbox" checked onchange="marcarTarefa(${i}, false)">
      <span>${t.data} - ${t.descricao} (${t.prioridade}) - ${t.setor}</span>
      <button class="botao-excluir" onclick="excluirTarefa(${i}, true)">Excluir</button>
    `;
    listaTarefasFeitas.appendChild(div);
  });
}

function marcarTarefa(index, marcarComoExecutada) {
  if (marcarComoExecutada) {
    const tarefa = tarefas.splice(index, 1)[0];
    tarefa.executada = true;
    tarefasFeitas.push(tarefa);
  } else {
    const tarefa = tarefasFeitas.splice(index, 1)[0];
    tarefa.executada = false;
    tarefas.push(tarefa);
  }
  db.ref('Tarefas').set([...tarefas, ...tarefasFeitas]);
  atualizarTarefas();
}

function excluirTarefa(index, feita) {
  if (feita) tarefasFeitas.splice(index, 1);
  else tarefas.splice(index, 1);
  db.ref('Tarefas').set([...tarefas, ...tarefasFeitas]);
  atualizarTarefas();
}

function carregarTarefas() {
  db.ref('Tarefas').on('value', snap => {
    if (snap.exists()) {
      tarefas.length = 0;
      tarefasFeitas.length = 0;
      snap.val().forEach(t => (t.executada ? tarefasFeitas : tarefas).push(t));
      atualizarTarefas();
    }
  });
}

// Financeiro
function adicionarFinanceiro() {
  const novo = {
    data: dataFin.value,
    produto: produtoFin.value,
    valor: parseFloat(valorFin.value),
    tipo: tipoFin.value,
    pago: false
  };
  if (!novo.data || !novo.produto || isNaN(novo.valor)) return alert("Preencha tudo!");
  financeiro.push(novo);
  db.ref('Financeiro').set(financeiro);
  atualizarFinanceiro();
}

function atualizarFinanceiro() {
  financeiroVencer.innerHTML = '';
  financeiroPago.innerHTML = '';

  financeiro.forEach((f, i) => {
    const div = document.createElement('div');
    div.className = 'item';
    if (f.pago) {
      div.innerHTML = `
        <span>${f.data} - ${f.produto} - R$${f.valor.toFixed(2)} - ${f.tipo}</span>
        <button class="botao-excluir" onclick="excluirConta(${i})">Excluir</button>
      `;
      financeiroPago.appendChild(div);
    } else {
      div.innerHTML = `
        <span>${f.data} - ${f.produto} - R$${f.valor.toFixed(2)} - ${f.tipo}</span>
        <button class="botao-pagar" onclick="pagarConta(${i})">Pagar</button>
      `;
      financeiroVencer.appendChild(div);
    }
  });

  gerarGraficoFinanceiro();
}

function pagarConta(index) {
  financeiro[index].pago = true;
  db.ref('Financeiro').set(financeiro);
  atualizarFinanceiro();
}

function excluirConta(index) {
  financeiro.splice(index, 1);
  db.ref('Financeiro').set(financeiro);
  atualizarFinanceiro();
}

function carregarFinanceiro() {
  db.ref('Financeiro').on('value', snap => {
    if (snap.exists()) {
      financeiro.length = 0;
      financeiro.push(...snap.val());
      atualizarFinanceiro();
    }
  });
}

function gerarGraficoFinanceiro() {
  const ctx = document.getElementById('graficoGastos').getContext('2d');
  if (window.graficoFinanceiro) window.graficoFinanceiro.destroy();
  const totais = {};
  financeiro.forEach(f => { if (f.pago) totais[f.tipo] = (totais[f.tipo] || 0) + f.valor; });
  window.graficoFinanceiro = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(totais),
      datasets: [{ label: 'Gastos Pagos', data: Object.values(totais), backgroundColor: '#66bb6a' }]
    }
  });
}

// Colheita
const colheita = [];

function adicionarColheita() {
  const nova = {
    data: dataColheita.value,
    colhedor: colhedor.value,
    quantidade: parseInt(quantidadeLatas.value),
    valorLata: parseFloat(valorLata.value),
    pago: false
  };
  if (!nova.data || !nova.colhedor || isNaN(nova.quantidade) || isNaN(nova.valorLata)) return alert("Preencha tudo!");
  colheita.push(nova);
  db.ref('Colheita').set(colheita);
  atualizarColheita();
}

function atualizarColheita() {
  colheitaPendentes.innerHTML = '';
  colheitaPagos.innerHTML = '';

  colheita.forEach((c, i) => {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <span>${c.data} - ${c.colhedor} - ${c.quantidade} latas - R$${(c.quantidade * c.valorLata).toFixed(2)}</span>
      ${c.pago ? '<span style="color:green;">Pago</span>' : `<button class="botao-pagar" onclick="pagarColheita(${i})">Pagar</button>`}
      <button class="botao-excluir" onclick="excluirColheita(${i})">Excluir</button>
    `;
    if (c.pago) colheitaPagos.appendChild(div);
    else colheitaPendentes.appendChild(div);
  });
}

function pagarColheita(index) {
  colheita[index].pago = true;
  db.ref('Colheita').set(colheita);
  atualizarColheita();
}

function excluirColheita(index) {
  colheita.splice(index, 1);
  db.ref('Colheita').set(colheita);
  atualizarColheita();
}

function carregarColheita() {
  db.ref('Colheita').on('value', snap => {
    if (snap.exists()) {
      colheita.length = 0;
      colheita.push(...snap.val());
      atualizarColheita();
    }
  });
}

// Inicialização
window.onload = function () {
  inicializarApp();
};

function inicializarApp() {
  mostrarAba(localStorage.getItem('aba') || 'aplicacoes');
  carregarAplicacoes();
  carregarTarefas();
  carregarFinanceiro();
  carregarColheita();
}

<script>
  const firebaseConfig = { ... }
  firebase.initializeApp(firebaseConfig);
  const db = firebase.database();
</script>
