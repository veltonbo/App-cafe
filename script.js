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

// ========== INICIALIZAÇÃO DO APP ==========
  function inicializarApp() {
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
  }

  function mostrarAba(abaId) {
    document.querySelectorAll('.aba').forEach(aba => aba.classList.remove('active'));
    document.getElementById(abaId).classList.add('active');

    document.querySelectorAll('.menu-superior button').forEach(btn => btn.classList.remove('active'));
    const btnId = 'btn-' + abaId;
    const btn = document.getElementById(btnId);
    if (btn) btn.classList.add('active');

    localStorage.setItem('aba', abaId);
  }

  window.onload = inicializarApp;
</script>

<script>
  // ========== FUNÇÕES MENU APLICAÇÕES ==========
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

  // ========== FUNÇÕES MENU TAREFAS ==========
  function adicionarTarefa() {
    const nova = {
      data: dataTarefa.value,
      descricao: descricaoTarefa.value,
      prioridade: prioridadeTarefa.value,
      setor: setorTarefa.value,
      executada: false,
      eAplicacao: eAplicacaoCheckbox.checked,
      dosagem: dosagemAplicacao.value,
      tipoAplicacao: tipoAplicacao.value
    };

    if (!nova.data || !nova.descricao) {
      alert("Preencha todos os campos da tarefa!");
      return;
    }

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
        const cor = prioridade === 'Alta' ? '#f44336' : prioridade === 'Média' ? '#ff9800' : '#4caf50';
        const div = document.createElement('div');
        div.className = 'item';
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
      tarefasFeitas[index].executada = false;
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
    camposAplicacao.style.display = eAplicacaoCheckbox.checked ? 'block' : 'none';
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

  // ========== FUNÇÕES MENU FINANCEIRO ==========
  function mostrarParcelas() {
    const checkbox = document.getElementById("parceladoFin");
    document.getElementById("parcelasFin").style.display = checkbox.checked ? "block" : "none";
  }

  function adicionarFinanceiro() {
  const gasto = {
    data: dataFin.value,
    produto: produtoFin.value.trim(),
    descricao: descricaoFin.value.trim(),
    valor: parseFloat(valorFin.value),
    tipo: tipoFin.value,
    pago: false,
    parcelas: document.getElementById("parceladoFin").checked ? parseInt(parcelasFin.value) || 1 : 1
  };

  if (!gasto.data || !gasto.produto || isNaN(gasto.valor)) {
    alert("Preencha todos os campos corretamente!");
    return;
  }

  // GERAÇÃO DAS PARCELAS DETALHADAS
  if (gasto.parcelas > 1) {
    const parcelas = [];
    const valorParcela = parseFloat((gasto.valor / gasto.parcelas).toFixed(2));
    const dataBase = new Date(gasto.data);

    for (let i = 0; i < gasto.parcelas; i++) {
      const vencimento = new Date(dataBase);
      vencimento.setMonth(vencimento.getMonth() + i);
      const vencStr = vencimento.toISOString().split("T")[0];
      parcelas.push({
        numero: i + 1,
        valor: valorParcela,
        vencimento: vencStr,
        pago: false
      });
    }

    gasto.parcelasDetalhes = parcelas;
  }

  gastos.push(gasto);
  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();

  // Limpa o formulário
  dataFin.value = "";
  produtoFin.value = "";
  descricaoFin.value = "";
  valorFin.value = "";
  parcelasFin.value = "";
  parceladoFin.checked = false;
  mostrarParcelas();
}

  function atualizarFinanceiro() {
  const filtroTexto = pesquisaFinanceiro.value.toLowerCase();
  const tipoFiltro = filtroTipoFin.value;
  const statusFiltro = filtroStatusFin.value;
  const dataIni = filtroDataInicioFin.value;
  const dataFim = filtroDataFimFin.value;

  const venc = document.getElementById("financeiroVencer");
  const pagos = document.getElementById("financeiroPago");
  venc.innerHTML = "";
  pagos.innerHTML = "";

  const dadosVencer = {};
  const dadosPago = {};

  gastos.forEach((g, index) => {
    const txt = `${g.data} ${g.produto} ${(g.descricao || "")} ${g.tipo}`.toLowerCase();
    if (!txt.includes(filtroTexto)) return;
    if (tipoFiltro && g.tipo !== tipoFiltro) return;

    if (g.parcelasDetalhes && g.parcelasDetalhes.length > 0) {
      g.parcelasDetalhes.forEach((p, parcelaIndex) => {
        const grupo = p.pago ? dadosPago : dadosVencer;
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
          parcelaIndex,
          isParcela: true
        });
      });
    } else {
      if (statusFiltro === "pago" && !g.pago) return;
      if (statusFiltro === "vencer" && g.pago) return;
      if (dataIni && g.data < dataIni) return;
      if (dataFim && g.data > dataFim) return;
      const grupo = g.pago ? dadosPago : dadosVencer;
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
    titulo.innerText = formatarMes(mes);
    container.appendChild(titulo);

    let totalMes = 0;

    grupo[mes].forEach(({ produto, descricao, valor, tipo, vencimento, i, parcelaIndex, isParcela, pago }) => {
      totalMes += valor;

      const icone = tipo === "Adubo" ? "leaf"
                  : tipo === "Fungicida" ? "bug"
                  : tipo === "Inseticida" ? "spray-can"
                  : tipo === "Herbicida" ? "recycle"
                  : "tag";

      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `
        <span>
          <i class="fas fa-${icone}"></i> 
          <strong>${produto}</strong> - R$ ${valor.toFixed(2)} (${tipo}) 
          ${descricao ? `<br><small style="color:#ccc;">${descricao}</small>` : ''}
          ${isParcela ? `<br><small>Venc: ${vencimento}</small>` : ''}
        </span>
        <div class="botoes-financeiro">
          ${isParcela
            ? `<button onclick="alternarParcela(${i}, ${parcelaIndex})"><i class="fas ${pago ? 'fa-undo' : 'fa-check'}"></i></button>`
            : pago
              ? `<button onclick="desfazerPagamento(${i})"><i class="fas fa-undo"></i></button>`
              : `<button onclick="marcarPago(${i})"><i class="fas fa-check"></i></button>`
          }
          <button class="botao-excluir" onclick="confirmarExclusaoParcela(${i}, ${parcelaIndex})"><i class="fas fa-trash"></i></button>
        </div>
      `;
      container.appendChild(div);
    });

    const totalDiv = document.createElement("div");
    totalDiv.className = "grupo-data";
    totalDiv.innerHTML = `<span style="font-size:14px;">Total: R$ ${totalMes.toFixed(2)}</span>`;
    container.appendChild(totalDiv);
  }
}

  function alternarParcela(gastoIndex, parcelaIndex) {
  const gasto = gastos[gastoIndex];
  if (!gasto || !gasto.parcelasDetalhes) return;

  const parcela = gasto.parcelasDetalhes[parcelaIndex];
  parcela.pago = !parcela.pago;

  // Atualiza o status geral
  gasto.pago = gasto.parcelasDetalhes.every(p => p.pago);

  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();
}

  function marcarPago(index) {
    if (gastos[index]) {
      gastos[index].pago = true;
      db.ref("Financeiro").set(gastos);
      atualizarFinanceiro();
    }
  }

  function desfazerPagamento(index) {
    if (gastos[index]) {
      gastos[index].pago = false;
      db.ref("Financeiro").set(gastos);
      atualizarFinanceiro();
    }
  }

  function confirmarExclusaoParcela(index, parcelaIndex) {
  indexGastoExcluir = index;
  parcelaParaExcluir = parcelaIndex;
  document.getElementById("modalConfirmarExclusaoParcela").style.display = "flex";
}

function excluirApenasParcela() {
  const g = gastos[indexGastoExcluir];
  g.parcelasDetalhes.splice(parcelaParaExcluir, 1);

  if (g.parcelasDetalhes.length === 0) {
    gastos.splice(indexGastoExcluir, 1);
  } else {
    g.parcelas = g.parcelasDetalhes.length;
    g.valor = g.parcelasDetalhes.reduce((soma, p) => soma + p.valor, 0);
    g.pago = g.parcelasDetalhes.every(p => p.pago);
  }

  db.ref("Financeiro").set(gastos);
  fecharModalExcluirParcela();
  atualizarFinanceiro();
}

function excluirTodasParcelas() {
  gastos.splice(indexGastoExcluir, 1);
  db.ref("Financeiro").set(gastos);
  fecharModalExcluirParcela();
  atualizarFinanceiro();
}

function fecharModalExcluirParcela() {
  document.getElementById("modalConfirmarExclusaoParcela").style.display = "none";
  indexGastoExcluir = null;
  parcelaParaExcluir = null;
}

  function excluirFinanceiro(index, parcelaIndex = null) {
  const g = gastos[index];

  // Se for uma parcela individual
  if (parcelaIndex !== null && g.parcelasDetalhes) {
    // Remove apenas a parcela
    g.parcelasDetalhes.splice(parcelaIndex, 1);

    // Se não restou nenhuma parcela, remove o gasto inteiro
    if (g.parcelasDetalhes.length === 0) {
      gastos.splice(index, 1);
    } else {
      // Atualiza o valor total e número de parcelas
      g.parcelas = g.parcelasDetalhes.length;
      g.valor = g.parcelasDetalhes.reduce((soma, p) => soma + p.valor, 0);
      g.pago = g.parcelasDetalhes.every(p => p.pago);
    }
  } else {
    // Confirmação para excluir gasto inteiro
    if (!confirm("Deseja excluir este gasto por completo?")) return;
    gastos.splice(index, 1);
  }

  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();
}

  function carregarFinanceiro() {
    db.ref("Financeiro").on("value", snap => {
      if (snap.exists()) {
        gastos.length = 0;
        gastos.push(...snap.val());
        atualizarFinanceiro();
      }
    });
  }

  function gerarResumoFinanceiro() {
    let totalPago = 0;
    let totalVencer = 0;

    gastos.forEach(g => {
      if (g.pago) totalPago += g.valor;
      else totalVencer += g.valor;
    });

    document.getElementById("resumoFinanceiroMensal").innerHTML = `
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
      if (!g.pago) return;
      categorias[g.tipo] = (categorias[g.tipo] || 0) + g.valor;
    });

    const labels = Object.keys(categorias);
    const valores = Object.values(categorias);
    const total = valores.reduce((soma, v) => soma + v, 0);
    const labelsComPercentual = labels.map((label, i) => {
      const percent = ((valores[i] / total) * 100).toFixed(1);
      return `${label} (${percent}%)`;
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
    const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                   "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    return `${meses[parseInt(mesNum) - 1]} de ${ano}`;
  }

  function exportarFinanceiroCSV() {
    if (!gastos.length) {
      alert("Nenhum gasto registrado.");
      return;
    }

    let csv = "Data,Produto,Descrição,Valor,Tipo,Parcelas,Status\n";
    let total = 0;

    gastos.forEach(g => {
      const status = g.pago ? "Pago" : "A Vencer";
      csv += `${g.data},"${g.produto}","${g.descricao || ""}",${g.valor.toFixed(2)},${g.tipo},${g.parcelas},${status}\n`;
      total += g.valor;
    });

    csv += `\nTOTAL GERAL, , ,${total.toFixed(2)}\n`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const hoje = new Date().toISOString().split("T")[0];
    a.href = url;
    a.download = `financeiro_${hoje}.csv`;
    a.click();
  }

  function exportarFinanceiroPDF() {
    if (!gastos.length) {
      alert("Nenhum gasto registrado.");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Relatório Financeiro", 20, 20);
    let y = 30;
    let total = 0;

    gastos.forEach(g => {
      const status = g.pago ? "Pago" : "A Vencer";
      const linha = `${g.data} - ${g.produto} - R$ ${g.valor.toFixed(2)} - ${g.tipo} - ${status}`;
      doc.text(linha, 20, y);
      if (g.descricao) {
        y += 6;
        doc.setFontSize(11);
        doc.text(`Descrição: ${g.descricao}`, 25, y);
        doc.setFontSize(14);
      }
      if (g.parcelas > 1) {
        y += 6;
        doc.setFontSize(11);
        doc.text(`Parcelas: ${g.parcelas}`, 25, y);
        doc.setFontSize(14);
      }
      y += 10;
      total += g.valor;

      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });

    doc.setFontSize(13);
    doc.text(`TOTAL GERAL: R$ ${total.toFixed(2)}`, 20, y);
    const hoje = new Date().toISOString().split("T")[0];
    doc.save(`financeiro_${hoje}.pdf`);
  }

    let gastoAtualIndex = null;

function abrirModalParcelas(index) {
  const gasto = gastos[index];
  gastoAtualIndex = index;

  if (!gasto.parcelasDetalhes || gasto.parcelasDetalhes.length === 0) {
    const total = gasto.valor;
    const num = gasto.parcelas;
    const valorParcela = parseFloat((total / num).toFixed(2));
    const parcelas = [];
    let dataBase = new Date(gasto.data);

    for (let i = 0; i < num; i++) {
      const vencimento = new Date(dataBase);
      vencimento.setMonth(vencimento.getMonth() + i);
      const vencStr = vencimento.toISOString().split("T")[0];
      parcelas.push({
        numero: i + 1,
        valor: valorParcela,
        vencimento: vencStr,
        pago: false
      });
    }

    gasto.parcelasDetalhes = parcelas;
  }

  const container = document.getElementById("parcelasLista");
  container.innerHTML = "";

  gasto.parcelasDetalhes.forEach((p, i) => {
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid #444";
    tr.innerHTML = `
      <td style="padding:8px;">${p.numero}</td>
      <td style="padding:8px;">${p.vencimento}</td>
      <td style="padding:8px; text-align:right;">${p.valor.toFixed(2)}</td>
      <td style="padding:8px; text-align:center;">
        <input type="checkbox" ${p.pago ? "checked" : ""} onchange="alternarParcela(${index}, ${i})">
      </td>
    `;
    container.appendChild(tr);
  });

  document.getElementById("modalParcelas").style.display = "flex";
}

function renderizarModalParcelas(parcelas) {
  const container = document.getElementById("parcelasLista");
  container.innerHTML = "";
  parcelas.forEach((p, i) => {
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid #444";
    tr.innerHTML = `
      <td style="padding:8px;">${p.numero}</td>
      <td style="padding:8px;">${p.vencimento}</td>
      <td style="padding:8px; text-align:right;">${p.valor.toFixed(2)}</td>
      <td style="padding:8px; text-align:center;">
        <input type="checkbox" ${p.pago ? "checked" : ""} onchange="alternarParcela(${gastoAtualIndex}, ${i})">
      </td>
    `;
    container.appendChild(tr);
  });
}

function alternarParcela(gastoIndex, parcelaIndex) {
  const gasto = gastos[gastoIndex];
  if (!gasto || !gasto.parcelasDetalhes) return;

  const parcela = gasto.parcelasDetalhes[parcelaIndex];
  parcela.pago = !parcela.pago;

  // Atualiza status geral com base em todas as parcelas
  gasto.pago = gasto.parcelasDetalhes.every(p => p.pago);

  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();
}

function fecharModalParcelas() {
  document.getElementById("modalParcelas").style.display = "none";
}

  // ========== FUNÇÕES MENU COLHEITA ==========
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
    const nova = {
      data: dataColheita.value,
      colhedor: colhedor.value.trim(),
      quantidade: parseFloat(quantidadeLatas.value),
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

  function carregarColheita() {
    db.ref('Colheita').once('value').then(snap => {
      if (snap.exists()) {
        colheita.length = 0;
        colheita.push(...snap.val());
      }
      atualizarColheita();
    });
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
      if (c.pagoParcial > 0) {
        if (!agrupadoPagos[c.colhedor]) agrupadoPagos[c.colhedor] = [];
        agrupadoPagos[c.colhedor].push({ ...c, quantidade: c.pagoParcial, pago: true, i });
      }
      if (c.pagoParcial < c.quantidade) {
        if (!agrupadoPendentes[c.colhedor]) agrupadoPendentes[c.colhedor] = [];
        agrupadoPendentes[c.colhedor].push({ ...c, quantidade: c.quantidade - c.pagoParcial, pago: false, i });
      }
    });

    db.ref('Colheita').set(colheita);
    montarGrupoColheita(agrupadoPendentes, colheitaPendentes, false);
    montarGrupoColheita(agrupadoPagos, colheitaPagos, true);
    gerarGraficoColheita();
    gerarGraficoColhedor();

    const totalLatas = colheita.reduce((soma, c) => soma + c.quantidade, 0);
    const totalPago = colheita.reduce((soma, c) => soma + c.pagoParcial * (c.valorLata || 0), 0);
    const totalPendente = colheita.reduce((soma, c) => soma + (c.quantidade - c.pagoParcial) * (c.valorLata || 0), 0);

    document.getElementById('resumoColheita').innerHTML = `
      <div class="item"><strong>Total de Latas:</strong> ${totalLatas.toFixed(2)}</div>
      <div class="item"><strong>Total Pago:</strong> R$ ${totalPago.toFixed(2)}</div>
      <div class="item"><strong>Total Pendente:</strong> R$ ${totalPendente.toFixed(2)}</div>
    `;
  }

  function montarGrupoColheita(grupo, container, pago) {
    for (const nome in grupo) {
      const registros = grupo[nome];
      const totalLatas = registros.reduce((sum, c) => sum + c.quantidade, 0);
      const valorLata = registros[0]?.valorLata || 0;
      const valorTotal = totalLatas * valorLata;

      const bloco = document.createElement('div');
      bloco.className = 'bloco-colhedor';

      const titulo = document.createElement('div');
      titulo.className = 'grupo-data';
      titulo.innerHTML = `<strong>${nome}</strong> - ${totalLatas.toFixed(2)} latas = R$${valorTotal.toFixed(2)}`;
      bloco.appendChild(titulo);

      registros.forEach(({ data, quantidade, valorLata, i }) => {
        const div = document.createElement('div');
        div.className = 'item';
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

  function excluirColheita(index) {
    if (confirm("Deseja excluir esse lançamento de colheita?")) {
      colheita.splice(index, 1);
      db.ref('Colheita').set(colheita);
      atualizarColheita();
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
    modalParcialTexto.innerText = `Qual valor (R$) deseja pagar para ${nome}?`;
    inputParcial.value = '';
    modalParcial.style.display = 'flex';
  }

  function confirmarParcial() {
    const valorPagar = parseFloat(inputParcial.value);
    if (isNaN(valorPagar) || valorPagar <= 0) {
      alert("Valor inválido!");
      return;
    }

    const hoje = new Date().toISOString().split('T')[0];
    let restanteValor = valorPagar;
    let alterou = false;

    colheita.sort((a, b) => a.data.localeCompare(b.data));

    for (let i = 0; i < colheita.length; i++) {
      const c = colheita[i];
      if (c.colhedor === colhedorAtual && (c.quantidade - c.pagoParcial) > 0 && restanteValor > 0) {
        const disponivelLatas = c.quantidade - c.pagoParcial;
        const valorDisponivel = disponivelLatas * c.valorLata;
        const valorParaEssa = Math.min(valorDisponivel, restanteValor);
        const latasParaPagar = parseFloat((valorParaEssa / c.valorLata).toFixed(10));

        if (latasParaPagar > 0) {
          c.pagoParcial += latasParaPagar;
          c.historicoPagamentos = c.historicoPagamentos || [];
          c.historicoPagamentos.push({ data: hoje, quantidade: latasParaPagar });
          if (c.pagoParcial >= c.quantidade) {
            c.pagoParcial = c.quantidade;
            c.pago = true;
          }
          restanteValor -= latasParaPagar * c.valorLata;
          restanteValor = parseFloat(restanteValor.toFixed(2));
          alterou = true;
        }
      }
    }

    if (alterou) {
      db.ref('Colheita').set(colheita).then(() => {
        atualizarColheita();
        fecharModalParcial();
        alert(`Pagamento parcial de R$ ${valorPagar.toFixed(2)} registrado com sucesso!`);
      });
    } else {
      alert("O valor informado não foi suficiente para pagar nenhuma lata.");
    }
  }

  function fecharModalParcial() {
    modalParcial.style.display = 'none';
  }

  function excluirPagamento(index) {
    const c = colheita[index];
    if (!c || c.pagoParcial === 0) return;
    if (!confirm("Deseja excluir somente o pagamento deste lançamento? A quantidade voltará como pendente.")) return;

    c.pagoParcial = 0;
    c.pago = false;
    c.historicoPagamentos = [];
    db.ref('Colheita').set(colheita).then(() => {
      atualizarColheita();
      alert("Pagamento excluído e valor retornado como pendente.");
    });
  }

  function gerarGraficoColheita() {
    const ctx = document.getElementById('graficoColheita').getContext('2d');
    if (window.graficoColheitaChart) window.graficoColheitaChart.destroy();

    const dias = {};
    colheita.forEach(c => {
      dias[c.data] = (dias[c.data] || 0) + c.quantidade;
    });

    window.graficoColheitaChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Object.keys(dias),
        datasets: [{
          label: 'Latas por Dia',
          data: Object.values(dias).map(v => parseFloat(v.toFixed(2))),
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
          data: Object.values(nomes).map(v => parseFloat(v.toFixed(2))),
          backgroundColor: ['#66bb6a', '#29b6f6', '#ffca28', '#ef5350', '#ab47bc']
        }]
      }
    });
  }

  // ========== EXPORTAR RELATÓRIO DE COLHEITA ==========
  function exportarRelatorioColheita() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text('Relatório de Colheita', 20, 20);
    let y = 40;

    colheita.forEach(c => {
      doc.text(`${c.data} - ${c.colhedor} - ${c.quantidade.toFixed(2)} latas`, 20, y);
      y += 8;
      if (c.historicoPagamentos.length) {
        c.historicoPagamentos.forEach(h => {
          doc.text(`Pagamento: ${h.data} - ${h.quantidade.toFixed(2)} latas`, 30, y);
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

  // ========== EXPORTAR CSV DE COLHEITA ==========
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
      const historico = (c.historicoPagamentos || []).map(h => `${h.data} (${h.quantidade.toFixed(2)})`).join(" | ");

      csv += `${c.data},${c.colhedor},${c.quantidade.toFixed(2)},${pagas.toFixed(2)},${pendentes.toFixed(2)},${c.valorLata.toFixed(2)},${totalPago},${totalPendente},"${historico}"\n`;
    });

    const dataHoje = new Date().toISOString().split("T")[0];
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `colheita_${dataHoje}.csv`;
    a.click();
  }

  // ========== CONFIGURAÇÕES DE SAFRA ==========
  function carregarAnoSafra() {
  const ano = new Date().getFullYear();
  document.getElementById("anoSafraAtual").innerText = ano;
}

function carregarSafrasDisponiveis() {
  const select = document.getElementById("safraSelecionada");
  select.innerHTML = "<option value=''>Selecione o ano</option>";
  db.ref().once("value").then(snapshot => {
    Object.keys(snapshot.val() || {}).forEach(key => {
      if (!["Aplicacoes", "Tarefas", "Financeiro", "Colheita", "ValorLata"].includes(key)) {
        const option = document.createElement("option");
        option.value = key;
        option.innerText = key;
        select.appendChild(option);
      }
    });
  });
}

function fecharSafraAtual() {
  const ano = new Date().getFullYear();
  const confirmacao = confirm(`Deseja fechar a safra ${ano}? Isso arquivará os dados atuais.`);
  if (!confirmacao) return;

  Promise.all([
    db.ref("Aplicacoes").once("value"),
    db.ref("Tarefas").once("value"),
    db.ref("Financeiro").once("value"),
    db.ref("Colheita").once("value"),
    db.ref("ValorLata").once("value")
  ]).then(([app, tar, fin, col, lata]) => {
    const dados = {
      Aplicacoes: app.val() || [],
      Tarefas: tar.val() || [],
      Financeiro: fin.val() || [],
      Colheita: col.val() || [],
      ValorLata: lata.val() || 0
    };
    return db.ref(ano).set(dados).then(() => {
      db.ref("Aplicacoes").remove();
      db.ref("Tarefas").remove();
      db.ref("Financeiro").remove();
      db.ref("Colheita").remove();
      db.ref("ValorLata").remove();
      alert(`Safra ${ano} fechada com sucesso.`);
      location.reload();
    });
  });
}

function restaurarSafra() {
  const safra = document.getElementById("safraSelecionada").value;
  if (!safra) {
    alert("Selecione uma safra para restaurar.");
    return;
  }
  const confirmar = confirm(`Restaurar dados da safra ${safra}? Isso substituirá os dados atuais.`);
  if (!confirmar) return;

  db.ref(safra).once("value").then(snap => {
    const dados = snap.val();
    if (!dados) {
      alert("Dados da safra não encontrados.");
      return;
    }
    return Promise.all([
      db.ref("Aplicacoes").set(dados.Aplicacoes || []),
      db.ref("Tarefas").set(dados.Tarefas || []),
      db.ref("Financeiro").set(dados.Financeiro || []),
      db.ref("Colheita").set(dados.Colheita || []),
      db.ref("ValorLata").set(dados.ValorLata || 0)
    ]).then(() => {
      alert(`Safra ${safra} restaurada com sucesso.`);
      location.reload();
    });
  });
}

function deletarSafra() {
  const safra = document.getElementById("safraSelecionada").value;
  if (!safra) {
    alert("Selecione uma safra para deletar.");
    return;
  }
  const confirmar = confirm(`Deseja excluir permanentemente a safra ${safra}? Esta ação não poderá ser desfeita.`);
  if (!confirmar) return;

  db.ref(safra).remove().then(() => {
    alert(`Safra ${safra} deletada com sucesso.`);
    carregarSafrasDisponiveis();
  });
}

function fazerBackup() {
  const backup = {};
  Promise.all([
    db.ref("Aplicacoes").once("value"),
    db.ref("Tarefas").once("value"),
    db.ref("Financeiro").once("value"),
    db.ref("Colheita").once("value"),
    db.ref("ValorLata").once("value")
  ]).then(([app, tar, fin, col, lata]) => {
    backup.Aplicacoes = app.val() || [];
    backup.Tarefas = tar.val() || [];
    backup.Financeiro = fin.val() || [];
    backup.Colheita = col.val() || [];
    backup.ValorLata = lata.val() || 0;

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup_manejo_cafe_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  });
}

function importarBackup() {
  const input = document.getElementById("arquivoBackup");
  const file = input.files[0];
  if (!file) return alert("Nenhum arquivo selecionado.");

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const dados = JSON.parse(e.target.result);
      Promise.all([
        db.ref("Aplicacoes").set(dados.Aplicacoes || []),
        db.ref("Tarefas").set(dados.Tarefas || []),
        db.ref("Financeiro").set(dados.Financeiro || []),
        db.ref("Colheita").set(dados.Colheita || []),
        db.ref("ValorLata").set(dados.ValorLata || 0)
      ]).then(() => {
        alert("Backup importado com sucesso!");
        location.reload();
      });
    } catch (err) {
      alert("Erro ao importar o backup. Verifique se o arquivo é válido.");
    }
  };
  reader.readAsText(file);
}

  // ========== TEMA CLARO/ESCURO ==========
  function alternarTema() {
    document.body.classList.toggle('claro');
    localStorage.setItem('tema', document.body.classList.contains('claro') ? 'claro' : 'escuro');
  }

// ========== SCRIPT COMPLETO DO MENU RELATÓRIO ==========
  function mostrarRelatorioCompleto(id) {
    document.querySelectorAll('.relatorio-subaba').forEach(div => {
      div.style.display = 'none';
    });
    document.getElementById(id).style.display = 'block';

    // Atualiza os botões
    document.querySelectorAll('#relatorio .menu-superior button').forEach(btn => {
      btn.classList.remove('active');
    });
    const btnAtivo = document.querySelector(`#btn-${id}`);
    if (btnAtivo) btnAtivo.classList.add('active');
  }

// ====== RENDERIZAR APLICAÇÕES NO RELATÓRIO ======
function atualizarRelatorioAplicacoes() {
  const container = document.getElementById("ultimasAplicacoes");
  container.innerHTML = "";
  const contagem = {};

  aplicacoes.forEach(app => {
    const key = app.tipo || "Outro";
    contagem[key] = (contagem[key] || 0) + 1;
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<strong>${app.data}</strong> - ${app.produto} (${app.dosagem}) - ${app.tipo} - ${app.setor}`;
    container.appendChild(div);
  });

  const ctx = document.getElementById("graficoAplicacoes").getContext("2d");
  if (window.graficoAplicacoes) window.graficoAplicacoes.destroy();
  window.graficoAplicacoes = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(contagem),
      datasets: [{
        label: 'Aplicações por Tipo',
        data: Object.values(contagem),
        backgroundColor: '#4caf50'
      }]
    }
  });
}

// ====== RENDERIZAR TAREFAS NO RELATÓRIO ======
function atualizarRelatorioTarefas() {
  const container = document.getElementById("ultimasTarefas");
  container.innerHTML = "";
  const contagem = { Alta: 0, Média: 0, Baixa: 0 };

  tarefas.concat(tarefasFeitas).forEach(t => {
    contagem[t.prioridade] = (contagem[t.prioridade] || 0) + 1;
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<strong>${t.data}</strong> - ${t.descricao} (${t.prioridade}) - ${t.setor}`;
    container.appendChild(div);
  });

  const ctx = document.getElementById("graficoTarefas").getContext("2d");
  if (window.graficoTarefas) window.graficoTarefas.destroy();
  window.graficoTarefas = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(contagem),
      datasets: [{
        data: Object.values(contagem),
        backgroundColor: ['#f44336', '#ff9800', '#4caf50']
      }]
    }
  });
}

// ====== RENDERIZAR FINANCEIRO NO RELATÓRIO ======
function atualizarRelatorioFinanceiro() {
  const container = document.getElementById("resumoFinanceiro");
  container.innerHTML = "";

  const categorias = {};
  let total = 0;

  gastos.forEach(g => {
    if (!g.pago) return;
    categorias[g.tipo] = (categorias[g.tipo] || 0) + g.valor;
    total += g.valor;
  });

  Object.entries(categorias).forEach(([cat, val]) => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<strong>${cat}</strong>: R$ ${val.toFixed(2)}`;
    container.appendChild(div);
  });

  const divTotal = document.createElement("div");
  divTotal.className = "item";
  divTotal.innerHTML = `<strong>Total Geral:</strong> R$ ${total.toFixed(2)}`;
  container.appendChild(divTotal);

  const ctx = document.getElementById("graficoFinanceiro").getContext("2d");
  if (window.graficoFinanceiro) window.graficoFinanceiro.destroy();
  window.graficoFinanceiro = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: Object.keys(categorias),
      datasets: [{
        data: Object.values(categorias),
        backgroundColor: ['#66bb6a', '#29b6f6', '#ffa726', '#ef5350', '#ab47bc']
      }]
    }
  });
}

// ====== EXPORTAR RELATÓRIO COMPLETO EM PDF ======
function exportarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 20;

  doc.setFontSize(16);
  doc.text("Relatório Geral - Manejo Café", 20, y);
  y += 10;

  doc.setFontSize(12);
  doc.text("Aplicações:", 20, y); y += 8;
  aplicacoes.forEach(a => {
    doc.text(`${a.data} - ${a.produto} (${a.dosagem}) - ${a.tipo} - ${a.setor}`, 20, y);
    y += 6; if (y > 270) { doc.addPage(); y = 20; }
  });

  y += 8;
  doc.text("Tarefas:", 20, y); y += 8;
  tarefas.concat(tarefasFeitas).forEach(t => {
    doc.text(`${t.data} - ${t.descricao} (${t.prioridade}) - ${t.setor}`, 20, y);
    y += 6; if (y > 270) { doc.addPage(); y = 20; }
  });

  y += 8;
  doc.text("Financeiro (pagos):", 20, y); y += 8;
  gastos.filter(g => g.pago).forEach(g => {
    doc.text(`${g.data} - ${g.produto} - R$ ${g.valor.toFixed(2)} (${g.tipo})`, 20, y);
    y += 6; if (y > 270) { doc.addPage(); y = 20; }
  });

  y += 8;
  doc.text("Colheita:", 20, y); y += 8;
  colheita.forEach(c => {
    doc.text(`${c.data} - ${c.colhedor} - ${c.quantidade.toFixed(2)} latas`, 20, y);
    y += 6; if (y > 270) { doc.addPage(); y = 20; }
  });

  const hoje = new Date().toISOString().split("T")[0];
  doc.save(`relatorio_manejo_cafe_${hoje}.pdf`);
}

// ====== EXPORTAR RELATÓRIO EM CSV ======
function exportarRelatorioCSV() {
  let csv = "Tipo,Data,Descrição,Setor,Valor\n";

  aplicacoes.forEach(a => {
    csv += `Aplicação,${a.data},"${a.produto} (${a.dosagem})",${a.setor},\n`;
  });

  tarefas.concat(tarefasFeitas).forEach(t => {
    csv += `Tarefa,${t.data},"${t.descricao} (${t.prioridade})",${t.setor},\n`;
  });

  gastos.filter(g => g.pago).forEach(g => {
    csv += `Financeiro,${g.data},"${g.produto}",,${g.valor.toFixed(2)}\n`;
  });

  colheita.forEach(c => {
    const total = (c.quantidade * c.valorLata).toFixed(2);
    csv += `Colheita,${c.data},${c.colhedor},,${total}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio_manejo_cafe_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
}

// ====== ATUALIZAÇÃO INICIAL DO RELATÓRIO ======
function atualizarRelatorioCompleto() {
  atualizarRelatorioAplicacoes();
  atualizarRelatorioTarefas();
  atualizarRelatorioFinanceiro();
}
 
// Aguarda os dados carregarem antes de gerar o relatório
function aguardarDadosCarregados(callback) {
  let tentativas = 0;
  const checar = setInterval(() => {
    tentativas++;
    if (
      aplicacoes.length > 0 ||
      tarefas.length > 0 ||
      tarefasFeitas.length > 0 ||
      gastos.length > 0 ||
      colheita.length > 0
    ) {
      clearInterval(checar);
      callback();
    } else if (tentativas > 50) {
      clearInterval(checar);
      alert("Não foi possível carregar os dados do relatório.");
    }
  }, 200);
}

// Substitui clique no botão de relatório para aguardar os dados
document.getElementById("btn-relatorio").addEventListener("click", () => {
  mostrarAba("relatorio");
  aguardarDadosCarregados(gerarRelatorioCompleto);
});

    let parcelaParaExcluir = null;
    let indexGastoExcluir = null;

function gerarRelatorioCompleto() {
  atualizarRelatorioAplicacoes();
  atualizarRelatorioTarefas();
  atualizarRelatorioFinanceiro();
  atualizarRelatorioColheita();
}

function atualizarRelatorioAplicacoes() {
  const container = document.getElementById("resumoRelAplicacoes");
  container.innerHTML = "";
  const contagem = {};

  aplicacoes.forEach(app => {
    const tipo = app.tipo || "Outro";
    contagem[tipo] = (contagem[tipo] || 0) + 1;
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<strong>${app.data}</strong> - ${app.produto} (${app.dosagem}) - ${app.tipo} - ${app.setor}`;
    container.appendChild(div);
  });

  const ctx = document.getElementById("graficoRelAplicacoes").getContext("2d");
  if (window.graficoRelAplicacoesChart) window.graficoRelAplicacoesChart.destroy();
  window.graficoRelAplicacoesChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(contagem),
      datasets: [{
        label: "Aplicações por Tipo",
        data: Object.values(contagem),
        backgroundColor: "#66bb6a"
      }]
    }
  });
}

function atualizarRelatorioTarefas() {
  const container = document.getElementById("resumoRelTarefas");
  container.innerHTML = "";
  const contagem = { Alta: 0, Média: 0, Baixa: 0 };

  tarefas.concat(tarefasFeitas).forEach(t => {
    contagem[t.prioridade] = (contagem[t.prioridade] || 0) + 1;
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<strong>${t.data}</strong> - ${t.descricao} (${t.prioridade}) - ${t.setor}`;
    container.appendChild(div);
  });

  const ctx = document.getElementById("graficoRelTarefas").getContext("2d");
  if (window.graficoRelTarefasChart) window.graficoRelTarefasChart.destroy();
  window.graficoRelTarefasChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: Object.keys(contagem),
      datasets: [{
        data: Object.values(contagem),
        backgroundColor: ["#f44336", "#ff9800", "#4caf50"]
      }]
    }
  });
}

function atualizarRelatorioFinanceiro() {
  const container = document.getElementById("resumoRelFinanceiro");
  container.innerHTML = "";
  const categorias = {};
  let total = 0;

  gastos.filter(g => g.pago).forEach(g => {
    categorias[g.tipo] = (categorias[g.tipo] || 0) + g.valor;
    total += g.valor;
  });

  Object.entries(categorias).forEach(([tipo, valor]) => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<strong>${tipo}</strong>: R$ ${valor.toFixed(2)}`;
    container.appendChild(div);
  });

  const totalDiv = document.createElement("div");
  totalDiv.className = "item";
  totalDiv.innerHTML = `<strong>Total Geral:</strong> R$ ${total.toFixed(2)}`;
  container.appendChild(totalDiv);

  const ctx = document.getElementById("graficoRelFinanceiro").getContext("2d");
  if (window.graficoRelFinanceiroChart) window.graficoRelFinanceiroChart.destroy();
  window.graficoRelFinanceiroChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: Object.keys(categorias),
      datasets: [{
        data: Object.values(categorias),
        backgroundColor: ["#66bb6a", "#29b6f6", "#ffa726", "#ef5350", "#ab47bc"]
      }]
    }
  });
}

function atualizarRelatorioColheita() {
  const container = document.getElementById("resumoRelColheita");
  container.innerHTML = "";

  const colhedores = {};
  let totalLatas = 0;
  let totalValor = 0;

  colheita.forEach(c => {
    colhedores[c.colhedor] = (colhedores[c.colhedor] || 0) + c.quantidade;
    totalLatas += c.quantidade;
    totalValor += c.quantidade * c.valorLata;
  });

  Object.entries(colhedores).forEach(([colhedor, latas]) => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `<strong>${colhedor}</strong>: ${latas.toFixed(2)} latas`;
    container.appendChild(div);
  });

  const totalDiv = document.createElement("div");
  totalDiv.className = "item";
  totalDiv.innerHTML = `<strong>Total Geral:</strong> ${totalLatas.toFixed(2)} latas - R$ ${totalValor.toFixed(2)}`;
  container.appendChild(totalDiv);

  const ctx = document.getElementById("graficoRelColheita").getContext("2d");
  if (window.graficoRelColheitaChart) window.graficoRelColheitaChart.destroy();
  window.graficoRelColheitaChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(colhedores),
      datasets: [{
        label: "Latas por Colhedor",
        data: Object.values(colhedores).map(v => parseFloat(v.toFixed(2))),
        backgroundColor: "#4caf50"
      }]
    }
  });
}
</script>
