// Firebase Config
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
let valorLataGlobal = 0, colhedorAtual = '';

// Inicialização
function inicializarApp() {
  mostrarAba(localStorage.getItem('aba') || 'aplicacoes');
  if (localStorage.getItem('tema') === 'claro') document.body.classList.add('claro');
  carregarAplicacoes();
  carregarTarefas();
  carregarFinanceiro();
  carregarColheita();
  carregarValorLata();
}

// Alternar tema
function alternarTema() {
  document.body.classList.toggle('claro');
  localStorage.setItem('tema', document.body.classList.contains('claro') ? 'claro' : 'escuro');
}

// Mostrar aba principal
function mostrarAba(id) {
  document.querySelectorAll('.aba').forEach(a => a.classList.remove('active'));
  document.querySelectorAll('.menu-superior button').forEach(b => b.classList.remove('active'));
  document.getElementById('btn-' + id).classList.add('active');
  document.getElementById(id).classList.add('active');
  localStorage.setItem('aba', id);
}

// Mostrar subaba da colheita
function mostrarSubmenuColheita(id) {
  document.querySelectorAll('.colheita-subaba').forEach(div => div.style.display = 'none');
  document.getElementById(id).style.display = 'block';
  document.querySelectorAll('#colheita .menu-superior button').forEach(btn => btn.classList.remove('active'));
  if (id === 'colheitaRegistrar') document.getElementById('btn-colheita-registrar').classList.add('active');
  else if (id === 'colheitaLancamentos') document.getElementById('btn-colheita-lancamentos').classList.add('active');
  else if (id === 'colheitaRelatorio') document.getElementById('btn-colheita-relatorio').classList.add('active');
}

// ----- Aplicações -----

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
        <div class="botoes-financeiro">
          <button class="botao-excluir" onclick="excluirAplicacao(${i})">Excluir</button>
        </div>
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

// ----- Tarefas -----

function adicionarTarefa() {
  const nova = {
    data: dataTarefa.value,
    descricao: descricaoTarefa.value,
    prioridade: prioridadeTarefa.value,
    setor: setorTarefa.value,
    executada: false,
    eAplicacao: document.getElementById('eAplicacaoCheckbox').checked,
    dosagem: document.getElementById('dosagemAplicacao').value,
    tipoAplicacao: document.getElementById('tipoAplicacao').value
  };
  if (!nova.data || !nova.descricao) return alert("Preencha tudo!");
  tarefas.push(nova);
  salvarTarefas();
  atualizarTarefas();
}

function salvarTarefas() {
  db.ref('Tarefas').set([...tarefas, ...tarefasFeitas]);
}

function atualizarTarefas() {
  const filtro = pesquisaTarefas.value.toLowerCase();
  const filtroSetor = filtroSetorTarefas.value;
  listaTarefas.innerHTML = '';
  listaTarefasFeitas.innerHTML = '';

  const agrupado = {};
  tarefas.filter(t =>
    (`${t.data} ${t.descricao} ${t.prioridade} ${t.setor}`.toLowerCase().includes(filtro)) &&
    (filtroSetor === "" || t.setor === filtroSetor)
  ).forEach((t, i) => {
    if (!agrupado[t.data]) agrupado[t.data] = [];
    agrupado[t.data].push({ ...t, i });
  });

  for (const data in agrupado) {
    const titulo = document.createElement('div');
    titulo.className = 'grupo-data';
    titulo.textContent = data;
    listaTarefas.appendChild(titulo);

    agrupado[data].forEach(({ descricao, prioridade, setor, i }) => {
      const div = document.createElement('div');
      div.className = 'item';
      let cor = prioridade === 'Alta' ? '#f44336' : prioridade === 'Média' ? '#ff9800' : '#4caf50';
      div.innerHTML = `
        <input type="checkbox" onchange="marcarTarefa(${i}, this.checked)">
        <span style="color:${cor}">${descricao} (${prioridade}) - ${setor}</span>
        <div class="botoes-financeiro">
          <button class="botao-excluir" onclick="excluirTarefa(${i}, false)">Excluir</button>
        </div>
      `;
      listaTarefas.appendChild(div);
    });
  }

  tarefasFeitas.filter(t =>
    (`${t.data} ${t.descricao} ${t.prioridade} ${t.setor}`.toLowerCase().includes(filtro)) &&
    (filtroSetor === "" || t.setor === filtroSetor)
  ).forEach((t, i) => {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <input type="checkbox" checked onchange="marcarTarefaFeita(${i}, this.checked)">
      <span>${t.data} - ${t.descricao} (${t.prioridade}) - ${t.setor}</span>
      <div class="botoes-financeiro">
        <button class="botao-excluir" onclick="excluirTarefa(${i}, true)">Excluir</button>
      </div>
    `;
    listaTarefasFeitas.appendChild(div);
  });
}

function marcarTarefa(index, checked) {
  if (checked) {
    const tarefaExecutada = tarefas.splice(index, 1)[0];
    tarefaExecutada.executada = true;
    tarefasFeitas.push(tarefaExecutada);

    if (tarefaExecutada.eAplicacao) {
      const novaAplicacao = {
        data: tarefaExecutada.data,
        produto: tarefaExecutada.descricao,
        dosagem: tarefaExecutada.dosagem || '',
        tipo: tarefaExecutada.tipoAplicacao || '',
        setor: tarefaExecutada.setor || ''
      };
      aplicacoes.push(novaAplicacao);
      db.ref('Aplicacoes').set(aplicacoes);
      atualizarAplicacoes();
    }
  } else {
    tarefas[index].executada = false;
    tarefasFeitas.splice(index, 1);
    tarefas.push(tarefasFeitas.splice(index, 1)[0]);
  }
  salvarTarefas();
  atualizarTarefas();
}

function marcarTarefaFeita(index, checked) {
  if (!checked) {
    tarefasFeitas[index].executada = false;
    tarefas.push(tarefasFeitas.splice(index, 1)[0]);
  }
  salvarTarefas();
  atualizarTarefas();
}

function excluirTarefa(index, feita) {
  if (feita) {
    tarefasFeitas.splice(index, 1);
  } else {
    tarefas.splice(index, 1);
  }
  salvarTarefas();
  atualizarTarefas();
}

function mostrarCamposAplicacao() {
  const checkbox = document.getElementById('eAplicacaoCheckbox');
  const campos = document.getElementById('camposAplicacao');
  campos.style.display = checkbox.checked ? 'block' : 'none';
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

// ----- Financeiro -----

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
  const filtro = pesquisaFinanceiro.value.toLowerCase();
  financeiroVencer.innerHTML = '';
  financeiroPago.innerHTML = '';

  const vencendoHoje = [];
  const hoje = new Date().toISOString().split('T')[0];
  const agrupado = {};

  financeiro.filter(f => `${f.data} ${f.produto}`.toLowerCase().includes(filtro)).forEach((f, i) => {
    if (!f.pago) {
      if (!agrupado[f.data]) agrupado[f.data] = [];
      agrupado[f.data].push({ ...f, i });
    }
  });

  for (const data in agrupado) {
    const titulo = document.createElement('div');
    titulo.className = 'grupo-data';
    titulo.textContent = data;
    financeiroVencer.appendChild(titulo);

    agrupado[data].forEach(({ produto, valor, tipo, i }) => {
      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML = `
        <span>${produto} - R$${valor.toFixed(2)} - ${tipo}</span>
        <div class="botoes-financeiro">
          <button class="botao-pagar" onclick="pagarConta(${i})">Pagar</button>
        </div>
      `;
      financeiroVencer.appendChild(div);

      if (data <= hoje) vencendoHoje.push(1);
    });
  }

  financeiro.filter(f => f.pago && `${f.data} ${f.produto}`.toLowerCase().includes(filtro)).forEach((f, i) => {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <span>${f.data} - ${f.produto} - R$${f.valor.toFixed(2)} - ${f.tipo}</span>
      <div class="botoes-financeiro">
        <button class="botao-excluir" onclick="excluirConta(${i})">Excluir</button>
      </div>
    `;
    financeiroPago.appendChild(div);
  });

  const notificacao = document.getElementById('notificacao-financeiro');
  if (vencendoHoje.length) {
    notificacao.style.display = 'flex';
    notificacao.innerText = vencendoHoje.length;
  } else {
    notificacao.style.display = 'none';
  }

  gerarGrafico();
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

function gerarGrafico() {
  const ctx = document.getElementById('graficoGastos').getContext('2d');
  if (window.grafico) window.grafico.destroy();

  const totais = {};
  financeiro.forEach(f => {
    if (f.pago) {
      totais[f.tipo] = (totais[f.tipo] || 0) + f.valor;
    }
  });

  window.grafico = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(totais),
      datasets: [{
        label: 'Gastos Pagos',
        data: Object.values(totais),
        backgroundColor: '#66bb6a'
      }]
    }
  });
}

// ----- Relatório -----

function exportarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text('Relatório - Manejo Café', 20, 20);
  doc.text('Total Aplicações: ' + aplicacoes.length, 20, 40);
  doc.text('Total Tarefas: ' + (tarefas.length + tarefasFeitas.length), 20, 50);
  doc.text('Total Financeiro: R$' + financeiro.reduce((a, b) => a + b.valor, 0).toFixed(2), 20, 60);
  doc.save('relatorio_manejo.pdf');
}

function mostrarRelatorio(tipo) {
  document.querySelectorAll('.relatorio-subaba').forEach(div => div.style.display = 'none');
  document.getElementById(tipo).style.display = 'block';

  if (tipo === 'aplicacoesRel') gerarGraficoAplicacoes();
  if (tipo === 'tarefasRel') gerarGraficoTarefas();
  if (tipo === 'financeiroRel') gerarGraficoFinanceiro();
}

// ----- Gráficos Relatório -----

function gerarGraficoAplicacoes() {
  const ultimas = aplicacoes.slice(-5).reverse();
  const lista = ultimas.map(app => `<div class="item">${app.data} - ${app.produto} (${app.dosagem})</div>`).join('');
  document.getElementById('ultimasAplicacoes').innerHTML = lista;

  const ctx = document.getElementById('graficoAplicacoes').getContext('2d');
  if (window.graficoAplicacoes) window.graficoAplicacoes.destroy();
  window.graficoAplicacoes = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ultimas.map(a => a.produto),
      datasets: [{ label: 'Aplicações', data: ultimas.map(a => parseFloat(a.dosagem) || 0) }]
    }
  });
}

function gerarGraficoTarefas() {
  const ultimas = tarefasFeitas.slice(-5).reverse();
  const lista = ultimas.map(t => `<div class="item">${t.data} - ${t.descricao} (${t.prioridade})</div>`).join('');
  document.getElementById('ultimasTarefas').innerHTML = lista;

  const ctx = document.getElementById('graficoTarefas').getContext('2d');
  if (window.graficoTarefas) window.graficoTarefas.destroy();
  window.graficoTarefas = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Alta', 'Média', 'Baixa'],
      datasets: [{
        label: 'Prioridade',
        data: [
          ultimas.filter(t => t.prioridade === 'Alta').length,
          ultimas.filter(t => t.prioridade === 'Média').length,
          ultimas.filter(t => t.prioridade === 'Baixa').length
        ],
        backgroundColor: ['#f44336', '#ff9800', '#4caf50']
      }]
    }
  });
}

function gerarGraficoFinanceiro() {
  const pagos = financeiro.filter(f => f.pago);
  const totalPago = pagos.reduce((acc, f) => acc + f.valor, 0);

  document.getElementById('resumoFinanceiro').innerHTML = `<div class="item">Total Pago: R$ ${totalPago.toFixed(2)}</div>`;

  const ctx = document.getElementById('graficoFinanceiro').getContext('2d');
  if (window.graficoFinanceiro) window.graficoFinanceiro.destroy();

  const totaisPorTipo = {};
  pagos.forEach(f => {
    totaisPorTipo[f.tipo] = (totaisPorTipo[f.tipo] || 0) + f.valor;
  });

  window.graficoFinanceiro = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: Object.keys(totaisPorTipo),
      datasets: [{
        label: 'Financeiro',
        data: Object.values(totaisPorTipo),
        backgroundColor: ['#66bb6a', '#29b6f6', '#ffca28', '#ef5350']
      }]
    }
  });
}

// ----- Colheita -----

const colheita = [];
let valorLataGlobal = 0;

function salvarValorLata() {
  valorLataGlobal = parseFloat(document.getElementById('valorLata').value) || 0;
  db.ref('ValorLata').set(valorLataGlobal);
}

function carregarValorLata() {
  db.ref('ValorLata').on('value', snap => {
    if (snap.exists()) {
      valorLataGlobal = snap.val();
      document.getElementById('valorLata').value = valorLataGlobal;
    }
  });
}

function adicionarColheita() {
  const nova = {
    data: dataColheita.value,
    colhedor: colhedor.value.trim(),
    quantidade: parseInt(quantidadeLatas.value),
    valorLata: valorLataGlobal,
    pago: false,
    pagoParcial: 0,
    historicoPagamentos: []
  };

  if (!nova.data || !nova.colhedor || isNaN(nova.quantidade) || nova.quantidade <= 0) {
    alert("Preencha todos os campos corretamente!");
    return;
  }

  colheita.push(nova);
  db.ref('Colheita').set(colheita);
  atualizarColheita();

  dataColheita.value = '';
  colhedor.value = '';
  quantidadeLatas.value = '';
}

function atualizarColheita() {
  const filtro = pesquisaColheita.value.toLowerCase();
  const inicio = filtroDataInicio.value;
  const fim = filtroDataFim.value;

  colheitaPendentes.innerHTML = '';
  colheitaPagos.innerHTML = '';

  const agrupadoPendentes = {};
  const agrupadoPagos = {};

  colheita.filter(c =>
    (`${c.data} ${c.colhedor}`.toLowerCase().includes(filtro)) &&
    (!inicio || c.data >= inicio) &&
    (!fim || c.data <= fim)
  ).forEach((c, i) => {
    const grupo = c.pago || c.pagoParcial === c.quantidade ? agrupadoPagos : agrupadoPendentes;
    if (!grupo[c.colhedor]) grupo[c.colhedor] = [];
    grupo[c.colhedor].push({ ...c, i });
  });

  montarGrupoColheita(agrupadoPendentes, colheitaPendentes, false);
  montarGrupoColheita(agrupadoPagos, colheitaPagos, true);

  gerarGraficoColheita();
  gerarGraficoColhedor();

  const totalLatas = colheita.reduce((soma, c) => soma + c.quantidade, 0);
  const totalPago = colheita.reduce((soma, c) => soma + c.pagoParcial * (c.valorLata || 0), 0);
  const totalPendente = colheita.reduce((soma, c) => soma + (c.quantidade - c.pagoParcial) * (c.valorLata || 0), 0);

  resumoColheita.innerHTML = `
    <div class="item"><strong>Total de Latas:</strong> ${totalLatas}</div>
    <div class="item"><strong>Total Pago:</strong> R$ ${totalPago.toFixed(2)}</div>
    <div class="item"><strong>Total Pendente:</strong> R$ ${totalPendente.toFixed(2)}</div>
  `;
}

function montarGrupoColheita(grupo, container, pago) {
  for (const nome in grupo) {
    const registros = grupo[nome];
    const totalLatas = registros.reduce((sum, c) => sum + (c.quantidade - (pago ? 0 : c.pagoParcial)), 0);
    const valorLata = registros[0]?.valorLata || 0;
    const valorTotal = totalLatas * valorLata;

    const bloco = document.createElement('div');
    bloco.className = 'bloco-colhedor';

    const titulo = document.createElement('div');
    titulo.className = 'grupo-data';
    titulo.innerHTML = `<strong>${nome}</strong> - ${totalLatas} latas = R$${valorTotal.toFixed(2)}`;
    bloco.appendChild(titulo);

    registros.forEach(({ data, quantidade, pagoParcial, valorLata, i }) => {
      const pendente = quantidade - (pago ? 0 : pagoParcial);
      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML = `
        <span>${data} - ${pendente} latas (R$${(pendente * valorLata).toFixed(2)})</span>
        <div class="botoes-colheita">
          <button class="botao-excluir" onclick="excluirColheita(${i})">Excluir</button>
        </div>
      `;
      bloco.appendChild(div);
    });

    if (!pago) {
      const botoes = document.createElement('div');
      botoes.className = 'botoes-colheita';
      botoes.innerHTML = `
        <button class="botao-pagar" onclick="pagarTudoColhedor('${nome}')">Pagar Tudo</button>
        <button class="botao-pagar" onclick="pagarParcialColhedor('${nome}')">Pagar Parcial</button>
      `;
      bloco.appendChild(botoes);
    }

    container.appendChild(bloco);
  }
}

function pagarTudoColhedor(nome) {
  const hoje = new Date().toISOString().split('T')[0];
  let alterou = false;

  colheita.forEach((c) => {
    if (c.colhedor === nome && (c.quantidade - c.pagoParcial) > 0) {
      const restante = c.quantidade - c.pagoParcial;
      c.pagoParcial = c.quantidade;
      c.pago = true;
      c.historicoPagamentos = c.historicoPagamentos || [];
      c.historicoPagamentos.push({ data: hoje, quantidade: restante });
      alterou = true;
    }
  });

  if (alterou) {
    db.ref('Colheita').set(colheita).then(() => {
      atualizarColheita();
      alert(`Pagamento completo para ${nome} registrado com sucesso!`);
    });
  }
}

let colhedorAtual = '';
function pagarParcialColhedor(nome) {
  colhedorAtual = nome;
  document.getElementById('modalParcialTexto').innerText = `Quantas latas deseja pagar para ${nome}?`;
  document.getElementById('inputParcial').value = '';
  document.getElementById('modalParcial').style.display = 'flex';
}

function confirmarParcial() {
  const quantidadePagar = parseInt(document.getElementById('inputParcial').value);
  if (isNaN(quantidadePagar) || quantidadePagar <= 0) return alert("Quantidade inválida!");

  const hoje = new Date().toISOString().split('T')[0];
  let restante = quantidadePagar;
  let alterou = false;

  colheita.sort((a, b) => a.data.localeCompare(b.data));

  for (let i = 0; i < colheita.length; i++) {
    const c = colheita[i];
    if (c.colhedor === colhedorAtual && (c.quantidade - c.pagoParcial) > 0 && restante > 0) {
      const disponivel = c.quantidade - c.pagoParcial;
      const pagarAgora = Math.min(disponivel, restante);

      c.pagoParcial += pagarAgora;
      c.historicoPagamentos = c.historicoPagamentos || [];
      c.historicoPagamentos.push({ data: hoje, quantidade: pagarAgora });

      if (c.pagoParcial >= c.quantidade) {
        c.pago = true;
      }

      restante -= pagarAgora;
      alterou = true;
    }
  }

  if (alterou) {
    db.ref('Colheita').set(colheita).then(() => {
      atualizarColheita();
      fecharModalParcial();
      alert(`Pagamento parcial de ${quantidadePagar} latas para ${colhedorAtual} registrado com sucesso!`);
    });
  }
}

function fecharModalParcial() {
  document.getElementById('modalParcial').style.display = 'none';
}

function excluirColheita(index) {
  if (confirm("Tem certeza que deseja excluir esse lançamento?")) {
    colheita.splice(index, 1);
    db.ref('Colheita').set(colheita);
    atualizarColheita();
  }
}

function carregarColheita() {
  db.ref('Colheita').once('value').then(snap => {
    if (snap.exists()) {
      colheita.length = 0;
      colheita.push(...snap.val());
    }
    atualizarColheita();
  });
}

function gerarGraficoColheita() {
  const ctx = document.getElementById('graficoColheita').getContext('2d');
  if (window.graficoColheitaChart) window.graficoColheitaChart.destroy();

  const dias = {};
  colheita.forEach(c => {
    if (!dias[c.data]) dias[c.data] = 0;
    dias[c.data] += c.quantidade;
  });

  window.graficoColheitaChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(dias),
      datasets: [{
        label: 'Latas por Dia',
        data: Object.values(dias),
        backgroundColor: '#4caf50'
      }]
    }
  });
}

function gerarGraficoColhedor() {
  const ctx = document.getElementById('graficoColhedor').getContext('2d');
  if (window.graficoColhedorChart) window.graficoColhedorChart.destroy();

  const nomes = {};
  colheita.forEach(c => {
    nomes[c.colhedor] = (nomes[c.colhedor] || 0) + c.quantidade;
  });

  window.graficoColhedorChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: Object.keys(nomes),
      datasets: [{
        label: 'Colheita por Colhedor',
        data: Object.values(nomes),
        backgroundColor: ['#66bb6a', '#29b6f6', '#ffca28', '#ef5350', '#ab47bc']
      }]
    }
  });
}

function exportarRelatorioColheita() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text('Relatório de Colheita', 20, 20);

  let y = 40;
  colheita.forEach(c => {
    doc.text(`${c.data} - ${c.colhedor} - ${c.quantidade} latas`, 20, y);
    y += 8;
    if (c.historicoPagamentos.length) {
      c.historicoPagamentos.forEach(h => {
        doc.text(`Pagamento: ${h.data} - ${h.quantidade} latas`, 30, y);
        y += 6;
      });
    }
    y += 4;
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  });

  doc.save('relatorio_colheita.pdf');
}

function exportarCSVColheita() {
  if (!colheita.length) {
    alert("Nenhum dado de colheita disponível para exportação.");
    return;
  }

  let csv = 'Data,Colhedor,Quantidade,Latas Pagas,Latas Pendentes,Valor da Lata,Total Pago (R$),Total Pendente (R$),Histórico de Pagamentos\n';

  colheita.forEach(c => {
    const pagas = c.pagoParcial || 0;
    const pendentes = c.quantidade - pagas;
    const totalPago = (pagas * c.valorLata).toFixed(2);
    const totalPendente = (pendentes * c.valorLata).toFixed(2);
    const historico = (c.historicoPagamentos || []).map(h => `${h.data} (${h.quantidade})`).join(" | ");

    csv += `${c.data},${c.colhedor},${c.quantidade},${pagas},${pendentes},${c.valorLata},${totalPago},${totalPendente},"${historico}"\n`;
  });

  const dataHoje = new Date().toISOString().split("T")[0];
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `colheita_${dataHoje}.csv`;
  a.click();
}
