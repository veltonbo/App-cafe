// ===== Firebase Config =====
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

// ===== Dados globais =====
const aplicacoes = [];
const tarefas = [];
const tarefasFeitas = [];
const gastos = [];
const colheita = [];

let valorLataGlobal = 0;
let colhedorAtual = '';
let graficoGastosChart = null;

// ===== Inicialização da interface =====
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
  carregarAnoSafra();
  carregarSafrasDisponiveis();
};

// ===== Controle de abas =====
function mostrarAba(abaId) {
  document.querySelectorAll('.aba').forEach(aba => aba.classList.remove('active'));
  document.getElementById(abaId).classList.add('active');

  document.querySelectorAll('.menu-superior button').forEach(btn => btn.classList.remove('active'));
  const btn = document.getElementById('btn-' + abaId);
  if (btn) btn.classList.add('active');

  localStorage.setItem('aba', abaId);
}

// ===== Tema claro/escuro =====
function alternarTema() {
  document.body.classList.toggle('claro');
  localStorage.setItem('tema', document.body.classList.contains('claro') ? 'claro' : 'escuro');
}

// ===== Aplicações =====

function adicionarAplicacao() {
  const data = document.getElementById("dataApp").value;
  const produto = document.getElementById("produtoApp").value.trim();
  const dosagem = document.getElementById("dosagemApp").value.trim();
  const tipo = document.getElementById("tipoApp").value;
  const setor = document.getElementById("setorApp").value;

  if (!data || !produto || !dosagem) {
    alert("Preencha todos os campos da aplicação!");
    return;
  }

  const nova = { data, produto, dosagem, tipo, setor };
  aplicacoes.push(nova);
  db.ref('Aplicacoes').set(aplicacoes).then(() => {
    atualizarAplicacoes();
  });
}

function atualizarAplicacoes() {
  const filtroTexto = document.getElementById("pesquisaAplicacoes").value.toLowerCase();
  const filtroSetor = document.getElementById("filtroSetorAplicacoes").value;
  const lista = document.getElementById("listaAplicacoes");

  lista.innerHTML = '';
  const agrupado = {};

  aplicacoes.filter(a =>
    (`${a.data} ${a.produto} ${a.dosagem} ${a.tipo} ${a.setor}`.toLowerCase().includes(filtroTexto)) &&
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
      const item = document.createElement('div');
      item.className = 'item';

      const span = document.createElement('span');
      span.textContent = `${produto} (${dosagem}) - ${tipo} - ${setor}`;

      const botoes = document.createElement('div');
      botoes.className = 'botoes-financeiro';

      const btnExcluir = document.createElement('button');
      btnExcluir.className = 'botao-excluir';
      btnExcluir.type = 'button';
      btnExcluir.textContent = 'Excluir';
      btnExcluir.onclick = () => excluirAplicacao(i);

      botoes.appendChild(btnExcluir);
      item.appendChild(span);
      item.appendChild(botoes);
      lista.appendChild(item);
    });
  }
}

function excluirAplicacao(index) {
  aplicacoes.splice(index, 1);
  db.ref('Aplicacoes').set(aplicacoes).then(() => {
    atualizarAplicacoes();
  });
}

function carregarAplicacoes() {
  db.ref('Aplicacoes').on('value', snap => {
    aplicacoes.length = 0;
    if (snap.exists()) {
      const data = snap.val();
      if (Array.isArray(data)) {
        aplicacoes.push(...data);
      }
    }
    atualizarAplicacoes();
  });
}

// ===== Tarefas =====

function adicionarTarefa() {
  const data = document.getElementById("dataTarefa").value;
  const descricao = document.getElementById("descricaoTarefa").value.trim();
  const prioridade = document.getElementById("prioridadeTarefa").value;
  const setor = document.getElementById("setorTarefa").value;
  const eAplicacao = document.getElementById("eAplicacaoCheckbox").checked;
  const dosagem = document.getElementById("dosagemAplicacao").value.trim();
  const tipoAplicacao = document.getElementById("tipoAplicacao").value;

  if (!data || !descricao) {
    alert("Preencha todos os campos da tarefa!");
    return;
  }

  const nova = {
    data,
    descricao,
    prioridade,
    setor,
    executada: false,
    eAplicacao,
    dosagem,
    tipoAplicacao
  };

  tarefas.push(nova);
  salvarTarefas();
  atualizarTarefas();
}

function salvarTarefas() {
  db.ref('Tarefas').set([...tarefas, ...tarefasFeitas]);
}

function atualizarTarefas() {
  const filtroTexto = document.getElementById("pesquisaTarefas").value.toLowerCase();
  const filtroSetor = document.getElementById("filtroSetorTarefas").value;
  const lista = document.getElementById("listaTarefas");
  const listaFeitas = document.getElementById("listaTarefasFeitas");

  lista.innerHTML = '';
  listaFeitas.innerHTML = '';

  const agrupado = {};

  tarefas.filter(t =>
    (`${t.data} ${t.descricao} ${t.prioridade} ${t.setor}`.toLowerCase().includes(filtroTexto)) &&
    (filtroSetor === "" || t.setor === filtroSetor)
  ).forEach((t, i) => {
    if (!agrupado[t.data]) agrupado[t.data] = [];
    agrupado[t.data].push({ ...t, i });
  });

  for (const data in agrupado) {
    const titulo = document.createElement('div');
    titulo.className = 'grupo-data';
    titulo.textContent = data;
    lista.appendChild(titulo);

    agrupado[data].forEach(({ descricao, prioridade, setor, i }) => {
      const item = document.createElement('div');
      item.className = 'item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.onchange = () => marcarTarefa(i, checkbox.checked);

      const span = document.createElement('span');
      span.style.color = prioridade === 'Alta' ? '#f44336' :
                         prioridade === 'Média' ? '#ff9800' : '#4caf50';
      span.textContent = `${descricao} (${prioridade}) - ${setor}`;

      const botoes = document.createElement('div');
      botoes.className = 'botoes-financeiro';

      const btnExcluir = document.createElement('button');
      btnExcluir.className = 'botao-excluir';
      btnExcluir.type = 'button';
      btnExcluir.textContent = 'Excluir';
      btnExcluir.onclick = () => excluirTarefa(i, false);

      botoes.appendChild(btnExcluir);
      item.appendChild(checkbox);
      item.appendChild(span);
      item.appendChild(botoes);
      lista.appendChild(item);
    });
  }

  tarefasFeitas.filter(t =>
    (`${t.data} ${t.descricao} ${t.prioridade} ${t.setor}`.toLowerCase().includes(filtroTexto)) &&
    (filtroSetor === "" || t.setor === filtroSetor)
  ).forEach((t, i) => {
    const item = document.createElement('div');
    item.className = 'item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.onchange = () => marcarTarefaFeita(i, checkbox.checked);

    const span = document.createElement('span');
    span.textContent = `${t.data} - ${t.descricao} (${t.prioridade}) - ${t.setor}`;

    const botoes = document.createElement('div');
    botoes.className = 'botoes-financeiro';

    const btnExcluir = document.createElement('button');
    btnExcluir.className = 'botao-excluir';
    btnExcluir.type = 'button';
    btnExcluir.textContent = 'Excluir';
    btnExcluir.onclick = () => excluirTarefa(i, true);

    botoes.appendChild(btnExcluir);
    item.appendChild(checkbox);
    item.appendChild(span);
    item.appendChild(botoes);
    listaFeitas.appendChild(item);
  });
}

function marcarTarefa(index, checked) {
  if (!tarefas[index]) return;

  if (checked) {
    const t = tarefas.splice(index, 1)[0];
    t.executada = true;
    tarefasFeitas.push(t);

    if (t.eAplicacao) {
      const novaAplicacao = {
        data: t.data,
        produto: t.descricao,
        dosagem: t.dosagem || '',
        tipo: t.tipoAplicacao || '',
        setor: t.setor || ''
      };
      aplicacoes.push(novaAplicacao);
      db.ref('Aplicacoes').set(aplicacoes);
      atualizarAplicacoes();
    }
  } else {
    const t = tarefasFeitas.splice(index, 1)[0];
    t.executada = false;
    tarefas.push(t);
  }

  salvarTarefas();
  atualizarTarefas();
}

function marcarTarefaFeita(index, checked) {
  if (!checked) {
    const t = tarefasFeitas.splice(index, 1)[0];
    t.executada = false;
    tarefas.push(t);
    salvarTarefas();
    atualizarTarefas();
  }
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
  const campos = document.getElementById("camposAplicacao");
  const checkbox = document.getElementById("eAplicacaoCheckbox");
  campos.style.display = checkbox.checked ? 'block' : 'none';
}

function carregarTarefas() {
  db.ref('Tarefas').on('value', snap => {
    tarefas.length = 0;
    tarefasFeitas.length = 0;

    if (snap.exists()) {
      const data = snap.val();
      if (Array.isArray(data)) {
        data.forEach(t => (t.executada ? tarefasFeitas : tarefas).push(t));
      }
    }

    atualizarTarefas();
  });
}

// ===== Financeiro =====

function mostrarParcelas() {
  const checkbox = document.getElementById("parceladoFin");
  document.getElementById("parcelasFin").style.display = checkbox.checked ? "block" : "none";
}

function adicionarFinanceiro() {
  const data = document.getElementById("dataFin").value;
  const produto = document.getElementById("produtoFin").value.trim();
  const descricao = document.getElementById("descricaoFin").value.trim();
  const valor = parseFloat(document.getElementById("valorFin").value);
  const tipo = document.getElementById("tipoFin").value;
  const parcelado = document.getElementById("parceladoFin").checked;
  const parcelasQtd = parcelado ? parseInt(document.getElementById("parcelasFin").value) || 1 : 1;

  if (!data || !produto || isNaN(valor) || valor <= 0) {
    alert("Preencha todos os campos corretamente!");
    return;
  }

  const gasto = {
    data,
    produto,
    descricao,
    valor,
    tipo,
    pago: false,
    parcelas: parcelasQtd
  };

  if (parcelasQtd > 1) {
    const valorParcela = parseFloat((valor / parcelasQtd).toFixed(2));
    const base = new Date(data);
    gasto.parcelasDetalhes = [];

    for (let i = 0; i < parcelasQtd; i++) {
      const venc = new Date(base);
      venc.setMonth(venc.getMonth() + i);
      const vencimento = venc.toISOString().split("T")[0];
      gasto.parcelasDetalhes.push({
        numero: i + 1,
        valor: valorParcela,
        vencimento,
        pago: false
      });
    }
  }

  gastos.push(gasto);
  db.ref("Financeiro").set(gastos).then(() => {
    atualizarFinanceiro();
  });

  document.getElementById("dataFin").value = "";
  document.getElementById("produtoFin").value = "";
  document.getElementById("descricaoFin").value = "";
  document.getElementById("valorFin").value = "";
  document.getElementById("parcelasFin").value = "";
  document.getElementById("parceladoFin").checked = false;
  mostrarParcelas();
}

function atualizarFinanceiro() {
  const filtroTexto = document.getElementById("pesquisaFinanceiro").value.toLowerCase();
  const tipoFiltro = document.getElementById("filtroTipoFin").value;
  const statusFiltro = document.getElementById("filtroStatusFin").value;
  const dataIni = document.getElementById("filtroDataInicioFin").value;
  const dataFim = document.getElementById("filtroDataFimFin").value;

  const venc = document.getElementById("financeiroVencer");
  const pagos = document.getElementById("financeiroPago");
  venc.innerHTML = "";
  pagos.innerHTML = "";

  const dadosVencer = {};
  const dadosPago = {};

  gastos.forEach((g, index) => {
    const texto = `${g.data} ${g.produto} ${(g.descricao || "")} ${g.tipo}`.toLowerCase();
    if (!texto.includes(filtroTexto)) return;
    if (tipoFiltro && g.tipo !== tipoFiltro) return;

    const grupo = g.pago ? dadosPago : dadosVencer;

    if (g.parcelasDetalhes?.length) {
      g.parcelasDetalhes.forEach((p, pIndex) => {
        if (statusFiltro === "pago" && !p.pago) return;
        if (statusFiltro === "vencer" && p.pago) return;
        if (dataIni && p.vencimento < dataIni) return;
        if (dataFim && p.vencimento > dataFim) return;

        const mes = p.vencimento.slice(0, 7);
        if (!grupo[mes]) grupo[mes] = [];

        grupo[mes].push({
          produto: `${g.produto} (Parcela ${p.numero})`,
          descricao: g.descricao,
          valor: p.valor,
          tipo: g.tipo,
          vencimento: p.vencimento,
          pago: p.pago,
          i: index,
          parcelaIndex: pIndex,
          isParcela: true
        });
      });
    } else {
      if (statusFiltro === "pago" && !g.pago) return;
      if (statusFiltro === "vencer" && g.pago) return;
      if (dataIni && g.data < dataIni) return;
      if (dataFim && g.data > dataFim) return;

      const mes = g.data.slice(0, 7);
      if (!grupo[mes]) grupo[mes] = [];
      grupo[mes].push({ ...g, i: index, isParcela: false });
    }
  });

  renderizarFinanceiro(dadosVencer, venc, false);
  renderizarFinanceiro(dadosPago, pagos, true);
  gerarResumoFinanceiro();
  gerarGraficoFinanceiro();
}

function renderizarFinanceiro(grupo, container, pago) {
  for (const mes in grupo) {
    const titulo = document.createElement("div");
    titulo.className = "grupo-data";
    titulo.textContent = formatarMes(mes);
    container.appendChild(titulo);

    let totalMes = 0;

    grupo[mes].forEach(({ produto, descricao, valor, tipo, vencimento, i, parcelaIndex, isParcela, pago }) => {
      totalMes += valor;

      const icone = tipo === "Adubo" ? "leaf" :
                    tipo === "Fungicida" ? "bug" :
                    tipo === "Inseticida" ? "spray-can" :
                    tipo === "Herbicida" ? "recycle" : "tag";

      const item = document.createElement("div");
      item.className = "item";

      const span = document.createElement("span");
      span.innerHTML = `<i class="fas fa-${icone}"></i> 
        <strong>${produto}</strong> - R$ ${valor.toFixed(2)} (${tipo}) 
        ${descricao ? `<br><small style="color:#ccc;">${descricao}</small>` : ''}
        ${isParcela ? `<br><small>Venc: ${vencimento}</small>` : ''}`;

      const botoes = document.createElement("div");
      botoes.className = "botoes-financeiro";

      const btnStatus = document.createElement("button");
      btnStatus.type = "button";
      btnStatus.innerHTML = `<i class="fas ${pago ? 'fa-undo' : 'fa-check'}"></i>`;
      btnStatus.onclick = () => {
        if (isParcela) alternarParcela(i, parcelaIndex);
        else if (pago) desfazerPagamento(i);
        else marcarPago(i);
      };

      const btnExcluir = document.createElement("button");
      btnExcluir.type = "button";
      btnExcluir.className = "botao-excluir";
      btnExcluir.innerHTML = `<i class="fas fa-trash"></i>`;
      btnExcluir.onclick = () => confirmarExclusaoParcela(i, parcelaIndex);

      botoes.appendChild(btnStatus);
      botoes.appendChild(btnExcluir);

      item.appendChild(span);
      item.appendChild(botoes);
      container.appendChild(item);
    });

    const totalDiv = document.createElement("div");
    totalDiv.className = "grupo-data";
    totalDiv.innerHTML = `<span style="font-size:14px;">Total: R$ ${totalMes.toFixed(2)}</span>`;
    container.appendChild(totalDiv);
  }
}

function alternarParcela(i, parcelaIndex) {
  const gasto = gastos[i];
  if (!gasto?.parcelasDetalhes) return;

  const parcela = gasto.parcelasDetalhes[parcelaIndex];
  parcela.pago = !parcela.pago;

  gasto.pago = gasto.parcelasDetalhes.every(p => p.pago);

  db.ref("Financeiro").set(gastos).then(() => atualizarFinanceiro());
}

function marcarPago(i) {
  if (gastos[i]) {
    gastos[i].pago = true;
    db.ref("Financeiro").set(gastos).then(() => atualizarFinanceiro());
  }
}

function desfazerPagamento(i) {
  if (gastos[i]) {
    gastos[i].pago = false;
    db.ref("Financeiro").set(gastos).then(() => atualizarFinanceiro());
  }
}

function gerarResumoFinanceiro() {
  let totalPago = 0;
  let totalVencer = 0;

  gastos.forEach(g => {
    if (g.pago) totalPago += g.valor;
    else totalVencer += g.valor;
  });

  const div = document.getElementById("resumoFinanceiroMensal");
  div.innerHTML = `
    <div>Total Pago: R$ ${totalPago.toFixed(2)}</div>
    <div>Total A Vencer: R$ ${totalVencer.toFixed(2)}</div>
    <div>Total Geral: R$ ${(totalPago + totalVencer).toFixed(2)}</div>
  `;
}

function gerarGraficoFinanceiro() {
  const ctx = document.getElementById("graficoGastos").getContext("2d");
  if (graficoGastosChart) graficoGastosChart.destroy();

  const categorias = {};
  gastos.forEach(g => {
    if (g.pago) categorias[g.tipo] = (categorias[g.tipo] || 0) + g.valor;
  });

  const labels = Object.keys(categorias);
  const valores = Object.values(categorias);
  const total = valores.reduce((soma, v) => soma + v, 0);

  const labelsComPercentual = labels.map((l, i) => {
    const percent = ((valores[i] / total) * 100).toFixed(1);
    return `${l} (${percent}%)`;
  });

  graficoGastosChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labelsComPercentual,
      datasets: [{
        data: valores,
        backgroundColor: ['#66bb6a', '#29b6f6', '#ffa726', '#ef5350', '#ab47bc']
      }]
    }
  });
}

function formatarMes(mes) {
  const [ano, mesNum] = mes.split("-");
  const nomes = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${nomes[parseInt(mesNum) - 1]} de ${ano}`;
}

function carregarFinanceiro() {
  db.ref("Financeiro").on("value", snap => {
    gastos.length = 0;
    if (snap.exists()) {
      const data = snap.val();
      if (Array.isArray(data)) {
        gastos.push(...data);
      }
    }
    atualizarFinanceiro();
  });
}

// ===== Colheita =====

function carregarValorLata() {
  db.ref('ValorLata').on('value', snap => {
    if (snap.exists()) {
      valorLataGlobal = snap.val();
      document.getElementById('valorLata').value = valorLataGlobal;
    }
  });
}

function salvarValorLata() {
  valorLataGlobal = parseFloat(document.getElementById('valorLata').value) || 0;
  db.ref('ValorLata').set(valorLataGlobal);
}

function adicionarColheita() {
  const data = document.getElementById("dataColheita").value;
  const colhedor = document.getElementById("colhedor").value.trim();
  const quantidade = parseFloat(document.getElementById("quantidadeLatas").value);

  if (!data || !colhedor || isNaN(quantidade) || quantidade <= 0) {
    alert("Preencha todos os campos corretamente!");
    return;
  }

  const nova = {
    data,
    colhedor,
    quantidade,
    valorLata: valorLataGlobal,
    pago: false,
    pagoParcial: 0,
    historicoPagamentos: []
  };

  colheita.push(nova);
  db.ref('Colheita').set(colheita).then(() => atualizarColheita());

  document.getElementById("dataColheita").value = '';
  document.getElementById("colhedor").value = '';
  document.getElementById("quantidadeLatas").value = '';
}

function carregarColheita() {
  db.ref('Colheita').on('value', snap => {
    colheita.length = 0;
    if (snap.exists()) {
      colheita.push(...snap.val());
    }
    atualizarColheita();
  });
}

function atualizarColheita() {
  const filtro = document.getElementById("pesquisaColheita").value.toLowerCase();
  const inicio = document.getElementById("filtroDataInicio").value;
  const fim = document.getElementById("filtroDataFim").value;
  const pendentes = document.getElementById("colheitaPendentes");
  const pagos = document.getElementById("colheitaPagos");
  const resumo = document.getElementById("resumoColheita");

  pendentes.innerHTML = '';
  pagos.innerHTML = '';

  const agrupadoPend = {};
  const agrupadoPago = {};

  colheita.filter(c =>
    (`${c.data} ${c.colhedor}`.toLowerCase().includes(filtro)) &&
    (!inicio || c.data >= inicio) &&
    (!fim || c.data <= fim)
  ).forEach((c, i) => {
    if (c.pagoParcial > 0) {
      if (!agrupadoPago[c.colhedor]) agrupadoPago[c.colhedor] = [];
      agrupadoPago[c.colhedor].push({ ...c, quantidade: c.pagoParcial, pago: true, i });
    }
    if (c.pagoParcial < c.quantidade) {
      if (!agrupadoPend[c.colhedor]) agrupadoPend[c.colhedor] = [];
      agrupadoPend[c.colhedor].push({ ...c, quantidade: c.quantidade - c.pagoParcial, pago: false, i });
    }
  });

  db.ref('Colheita').set(colheita);

  montarGrupoColheita(agrupadoPend, pendentes, false);
  montarGrupoColheita(agrupadoPago, pagos, true);

  const totalLatas = colheita.reduce((s, c) => s + c.quantidade, 0);
  const totalPago = colheita.reduce((s, c) => s + (c.pagoParcial * (c.valorLata || 0)), 0);
  const totalPendente = colheita.reduce((s, c) => s + ((c.quantidade - c.pagoParcial) * (c.valorLata || 0)), 0);

  resumo.innerHTML = `
    <div class="item"><strong>Total de Latas:</strong> ${totalLatas.toFixed(2)}</div>
    <div class="item"><strong>Total Pago:</strong> R$ ${totalPago.toFixed(2)}</div>
    <div class="item"><strong>Total Pendente:</strong> R$ ${totalPendente.toFixed(2)}</div>
  `;

  gerarGraficoColheita();
  gerarGraficoColhedor();
}

function montarGrupoColheita(grupo, container, pago) {
  for (const nome in grupo) {
    const registros = grupo[nome];
    const totalLatas = registros.reduce((s, c) => s + c.quantidade, 0);
    const valorLata = registros[0].valorLata || 0;
    const valorTotal = totalLatas * valorLata;

    const bloco = document.createElement("div");
    bloco.className = "bloco-colhedor";

    const titulo = document.createElement("div");
    titulo.className = "grupo-data";
    titulo.innerHTML = `<strong>${nome}</strong> - ${totalLatas.toFixed(2)} latas = R$ ${valorTotal.toFixed(2)}`;
    bloco.appendChild(titulo);

    registros.forEach(({ data, quantidade, valorLata, i }) => {
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `
        <span>${data} - ${quantidade.toFixed(2)} latas (R$${(quantidade * valorLata).toFixed(2)})</span>
        <div class="botoes-colheita">
          ${pago
            ? `<button class="botao-excluir-pagamento" onclick="excluirPagamento(${i})">Excluir Pagamento</button>
               <button class="botao-excluir" onclick="excluirColheita(${i})">Excluir Lançamento</button>`
            : `<button class="botao-excluir" onclick="excluirColheita(${i})">Excluir</button>`
          }
        </div>
      `;
      bloco.appendChild(div);
    });

    if (!pago) {
      const botoes = document.createElement("div");
      botoes.className = "botoes-colheita";
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

  colheita.forEach(c => {
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

function pagarParcialColhedor(nome) {
  colhedorAtual = nome;
  document.getElementById("modalParcialTexto").innerText = `Qual valor (R$) deseja pagar para ${nome}?`;
  document.getElementById("inputParcial").value = '';
  document.getElementById("modalParcial").style.display = 'flex';
}

function confirmarParcial() {
  const valorPagar = parseFloat(document.getElementById("inputParcial").value);
  if (isNaN(valorPagar) || valorPagar <= 0) {
    alert("Valor inválido!");
    return;
  }

  const hoje = new Date().toISOString().split('T')[0];
  let restante = valorPagar;
  let alterou = false;

  colheita.sort((a, b) => a.data.localeCompare(b.data));

  for (const c of colheita) {
    if (c.colhedor !== colhedorAtual || c.quantidade <= c.pagoParcial || restante <= 0) continue;

    const latasDisp = c.quantidade - c.pagoParcial;
    const valorDisp = latasDisp * c.valorLata;
    const pagar = Math.min(valorDisp, restante);
    const latas = pagar / c.valorLata;

    c.pagoParcial += latas;
    c.historicoPagamentos = c.historicoPagamentos || [];
    c.historicoPagamentos.push({ data: hoje, quantidade: latas });

    if (c.pagoParcial >= c.quantidade) {
      c.pagoParcial = c.quantidade;
      c.pago = true;
    }

    restante -= pagar;
    alterou = true;
  }

  if (alterou) {
    db.ref('Colheita').set(colheita).then(() => {
      atualizarColheita();
      fecharModalParcial();
      alert(`Pagamento parcial de R$ ${valorPagar.toFixed(2)} registrado!`);
    });
  } else {
    alert("O valor informado não foi suficiente para pagar nenhuma lata.");
  }
}

function fecharModalParcial() {
  document.getElementById("modalParcial").style.display = "none";
}

function excluirPagamento(index) {
  const c = colheita[index];
  if (!c || c.pagoParcial === 0) return;

  if (!confirm("Deseja excluir somente o pagamento deste lançamento? A quantidade voltará como pendente.")) return;

  c.pagoParcial = 0;
  c.pago = false;
  c.historicoPagamentos = [];
  db.ref('Colheita').set(colheita).then(() => atualizarColheita());
}

function excluirColheita(index) {
  if (confirm("Deseja excluir esse lançamento de colheita?")) {
    colheita.splice(index, 1);
    db.ref('Colheita').set(colheita).then(() => atualizarColheita());
  }
}

function gerarGraficoColheita() {
  const ctx = document.getElementById("graficoColheita").getContext("2d");
  if (window.graficoColheitaChart) window.graficoColheitaChart.destroy();

  const dias = {};
  colheita.forEach(c => {
    dias[c.data] = (dias[c.data] || 0) + c.quantidade;
  });

  window.graficoColheitaChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(dias),
      datasets: [{
        label: "Latas por Dia",
        data: Object.values(dias),
        backgroundColor: "#4caf50"
      }]
    }
  });
}

function gerarGraficoColhedor() {
  const ctx = document.getElementById("graficoColhedor").getContext("2d");
  if (window.graficoColhedorChart) window.graficoColhedorChart.destroy();

  const nomes = {};
  colheita.forEach(c => {
    nomes[c.colhedor] = (nomes[c.colhedor] || 0) + c.quantidade;
  });

  window.graficoColhedorChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: Object.keys(nomes),
      datasets: [{
        data: Object.values(nomes),
        backgroundColor: ["#66bb6a", "#29b6f6", "#ffca28", "#ef5350", "#ab47bc"]
      }]
    }
  });
}

