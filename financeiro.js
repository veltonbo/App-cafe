// ===== VARIÁVEIS GLOBAIS =====
let gastos = [];
let indiceEdicaoGasto = null;
let editarTodasParcelas = false;
let graficoGastosChart = null;

// ===== INICIALIZAR MENU FINANCEIRO =====
function inicializarFinanceiro() {
  carregarFinanceiro();
  document.getElementById("btnCancelarFinanceiro").addEventListener("click", cancelarEdicaoFinanceiro);
}

// ===== CARREGAR FINANCEIRO (Firebase) =====
function carregarFinanceiro() {
  db.ref("Financeiro").on("value", (snapshot) => {
    const data = snapshot.val();
    gastos = Array.isArray(data) ? data : [];
    atualizarFinanceiro();
  });
}

// ===== TOGGLE FORMULÁRIO (Botão Flutuante) =====
function alternarFormularioFinanceiro() {
  const form = document.getElementById("formularioFinanceiro");
  form.style.display = form.style.display === "none" ? "block" : "none";
  resetarFormularioFinanceiro();
}

// ===== ADICIONAR OU EDITAR GASTO =====
function adicionarFinanceiro() {
  const data = dataFin.value;
  const produto = produtoFin.value.trim();
  const descricao = descricaoFin.value.trim();
  const valor = parseFloat(valorFin.value);
  const tipo = tipoFin.value;
  const parcelado = parceladoFin.checked;
  const numParcelas = parcelado ? parseInt(parcelasFin.value) || 1 : 1;

  if (!data || !produto || isNaN(valor)) {
    alert("Preencha todos os campos corretamente!");
    return;
  }

  if (indiceEdicaoGasto !== null) {
    // Edição de Gasto Existente
    const gasto = gastos[indiceEdicaoGasto];
    if (parcelado) {
      // Editar Parcelado
      const valorParcela = parseFloat((valor / numParcelas).toFixed(2));
      const dataBase = new Date(data);
      gasto.parcelasDetalhes = Array.from({ length: numParcelas }, (_, i) => ({
        numero: i + 1,
        valor: valorParcela,
        vencimento: new Date(dataBase.setMonth(dataBase.getMonth() + i)).toISOString().split("T")[0],
        pago: false
      }));
      gasto.parcelas = numParcelas;
    } else {
      // Editar Gasto Simples
      delete gasto.parcelasDetalhes;
      gasto.parcelas = 1;
    }

    gasto.data = data;
    gasto.produto = produto;
    gasto.descricao = descricao;
    gasto.valor = valor;
    gasto.tipo = tipo;

  } else {
    // Novo Gasto
    const novoGasto = {
      data,
      produto,
      descricao,
      valor,
      tipo,
      pago: false,
      parcelas: numParcelas
    };

    if (parcelado) {
      const valorParcela = parseFloat((valor / numParcelas).toFixed(2));
      const dataBase = new Date(data);
      novoGasto.parcelasDetalhes = Array.from({ length: numParcelas }, (_, i) => ({
        numero: i + 1,
        valor: valorParcela,
        vencimento: new Date(dataBase.setMonth(dataBase.getMonth() + i)).toISOString().split("T")[0],
        pago: false
      }));
    }

    gastos.push(novoGasto);
  }

  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();
  resetarFormularioFinanceiro();
}

// ===== EDITAR GASTO =====
function editarFinanceiro(index, parcelaIndex = null) {
  const gasto = gastos[index];
  if (!gasto) return;

  dataFin.value = parcelaIndex !== null ? gasto.parcelasDetalhes[parcelaIndex].vencimento : gasto.data;
  produtoFin.value = gasto.produto;
  descricaoFin.value = gasto.descricao || "";
  valorFin.value = parcelaIndex !== null ? gasto.parcelasDetalhes[parcelaIndex].valor : gasto.valor;
  tipoFin.value = gasto.tipo;
  parceladoFin.checked = !!gasto.parcelasDetalhes;
  parcelasFin.style.display = parceladoFin.checked ? "block" : "none";
  parcelasFin.value = gasto.parcelas || 1;

  indiceEdicaoGasto = index;
  editarTodasParcelas = parcelaIndex === null;
  
  document.getElementById("formularioFinanceiro").style.display = "block";
  document.getElementById("btnSalvarFinanceiro").innerHTML = '<i class="fas fa-edit"></i> Salvar Edição';
  document.getElementById("btnCancelarFinanceiro").style.display = "inline-block";
}

// ===== CANCELAR EDIÇÃO =====
function cancelarEdicaoFinanceiro() {
  resetarFormularioFinanceiro();
}

// ===== RESETAR FORMULÁRIO =====
function resetarFormularioFinanceiro() {
  dataFin.value = "";
  produtoFin.value = "";
  descricaoFin.value = "";
  valorFin.value = "";
  tipoFin.value = "Adubo";
  parcelasFin.value = "";
  parceladoFin.checked = false;
  parcelasFin.style.display = "none";
  indiceEdicaoGasto = null;
  editarTodasParcelas = false;
  document.getElementById("formularioFinanceiro").style.display = "none";
  document.getElementById("btnSalvarFinanceiro").innerHTML = '<i class="fas fa-save"></i> Salvar Gasto';
  document.getElementById("btnCancelarFinanceiro").style.display = "none";
}

// ===== ATUALIZAR LISTAGEM DE GASTOS =====
function atualizarFinanceiro() {
  const venc = document.getElementById("financeiroVencer");
  const pagos = document.getElementById("financeiroPago");
  venc.innerHTML = "";
  pagos.innerHTML = "";

  const dadosVencer = {};
  const dadosPago = {};

  gastos.forEach((g, index) => {
    if (g.parcelasDetalhes?.length) {
      g.parcelasDetalhes.forEach((p, parcelaIndex) => {
        const grupo = p.pago ? dadosPago : dadosVencer;
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
      const grupo = g.pago ? dadosPago : dadosVencer;
      const mes = g.data.slice(0, 7);
      if (!grupo[mes]) grupo[mes] = [];
      grupo[mes].push({ ...g, i: index, isParcela: false });
    }
  });

  renderizarFinanceiro(dadosVencer, venc, false);
  renderizarFinanceiro(dadosPago, pagos, true);
}

// ===== RENDERIZAR FINANCEIRO =====
function renderizarFinanceiro(grupo, container, pago) {
  const mesesOrdenados = Object.keys(grupo).sort((a, b) => b.localeCompare(a));
  for (const mes of mesesOrdenados) {
    const titulo = document.createElement("div");
    titulo.className = "grupo-data";
    titulo.innerText = formatarMes(mes);
    container.appendChild(titulo);

    grupo[mes].forEach(({ produto, descricao, valor, tipo, vencimento, i, parcelaIndex, isParcela }) => {
      const div = document.createElement("div");
      div.className = `item-financeiro ${isParcela ? 'botoes-3' : 'botoes-2'}`;

      div.innerHTML = `
        <div class="item-texto">
          <i class="fas fa-${obterIconeTipo(tipo)}"></i>
          <strong>${produto}</strong> - ${formatarReal(valor)} (${tipo}) 
          ${descricao ? `<br><small>${descricao}</small>` : ''}
          ${isParcela ? `<br><small>Venc: ${vencimento}</small>` : ''}
        </div>
        <div class="botoes-tarefa">
          ${gerarBotoesFinanceiro(i, parcelaIndex, isParcela, pago)}
        </div>
      `;
      container.appendChild(div);
    });
  }
}

// ===== GERAR BOTÕES DINÂMICOS =====
function gerarBotoesFinanceiro(i, parcelaIndex, isParcela, pago) {
  if (isParcela) {
    return `
      <button class="botao-circular verde" onclick="marcarPago(${i}, ${parcelaIndex})">
        <i class="fas ${pago ? 'fa-undo' : 'fa-check'}"></i>
      </button>
      <button class="botao-circular azul" onclick="editarFinanceiro(${i}, ${parcelaIndex})">
        <i class="fas fa-edit"></i>
      </button>
      <button class="botao-circular vermelho" onclick="confirmarExclusao(${i}, ${parcelaIndex})">
        <i class="fas fa-trash"></i>
      </button>
    `;
  } else {
    return `
      <button class="botao-circular verde" onclick="marcarPago(${i})">
        <i class="fas ${pago ? 'fa-undo' : 'fa-check'}"></i>
      </button>
      <button class="botao-circular azul" onclick="editarFinanceiro(${i})">
        <i class="fas fa-edit"></i>
      </button>
      <button class="botao-circular vermelho" onclick="confirmarExclusao(${i}, null)">
        <i class="fas fa-trash"></i>
      </button>
    `;
  }
}

// ===== CONFIRMAR EXCLUSÃO DE GASTO OU PARCELA =====
function confirmarExclusao(index, parcelaIndex = null) {
  if (parcelaIndex !== null) {
    if (confirm("Deseja excluir esta parcela?")) {
      gastos[index].parcelasDetalhes.splice(parcelaIndex, 1);
      if (gastos[index].parcelasDetalhes.length === 0) {
        gastos.splice(index, 1);
      }
    }
  } else {
    if (confirm("Deseja excluir este lançamento financeiro?")) {
      gastos.splice(index, 1);
    }
  }

  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();
}

// ===== OBTENÇÃO DO ÍCONE POR TIPO =====
function obterIconeTipo(tipo) {
  return tipo === "Adubo" ? "leaf" :
         tipo === "Fungicida" ? "bug" :
         tipo === "Inseticida" ? "spray-can" :
         tipo === "Herbicida" ? "recycle" : "tag";
}

// ===== FORMATAR MÊS PARA EXIBIÇÃO =====
function formatarMes(mes) {
  const [ano, mesNum] = mes.split("-");
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  return `${meses[parseInt(mesNum) - 1]} de ${ano}`;
}

// ===== FORMATAR VALOR EM REAL =====
function formatarReal(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ===== GERAR RESUMO FINANCEIRO (TOPO) =====
function gerarResumoFinanceiro() {
  let totalPago = 0;
  let totalVencer = 0;

  gastos.forEach(g => {
    if (g.parcelasDetalhes?.length) {
      g.parcelasDetalhes.forEach(p => {
        if (p.pago) totalPago += p.valor;
        else totalVencer += p.valor;
      });
    } else {
      if (g.pago) totalPago += g.valor;
      else totalVencer += g.valor;
    }
  });

  document.getElementById("resumoFinanceiroMensal").innerHTML = `
    <div class="resumo-financeiro">
      <div class="resumo-item verde">Pago: ${formatarReal(totalPago)}</div>
      <div class="resumo-item laranja">A Vencer: ${formatarReal(totalVencer)}</div>
      <div class="resumo-item azul">Total: ${formatarReal(totalPago + totalVencer)}</div>
    </div>
  `;
}

// ===== GERAR GRÁFICO DE GASTOS PAGOS (DONUT) =====
function gerarGraficoFinanceiro() {
  const ctx = document.getElementById("graficoGastos").getContext("2d");
  if (graficoGastosChart) graficoGastosChart.destroy();

  const categorias = {};

  gastos.forEach(g => {
    if (g.parcelasDetalhes?.length) {
      g.parcelasDetalhes.forEach(p => {
        if (p.pago) {
          categorias[g.tipo] = (categorias[g.tipo] || 0) + p.valor;
        }
      });
    } else if (g.pago) {
      categorias[g.tipo] = (categorias[g.tipo] || 0) + g.valor;
    }
  });

  const labels = Object.keys(categorias);
  const valores = Object.values(categorias);
  const total = valores.reduce((sum, v) => sum + v, 0);

  const labelsComPorcentagem = labels.map((l, i) => {
    const pct = ((valores[i] / total) * 100).toFixed(1);
    return `${l} (${pct}%)`;
  });

  graficoGastosChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labelsComPorcentagem,
      datasets: [{
        data: valores,
        backgroundColor: ['#66bb6a', '#29b6f6', '#ffa726', '#ef5350', '#ab47bc']
      }]
    },
    options: {
      plugins: {
        legend: {
          labels: { color: "#ddd" }
        }
      }
    }
  });
}

// ===== EXPORTAR FINANCEIRO COMO CSV =====
function exportarFinanceiroCSV() {
  if (!gastos.length) {
    alert("Nenhum dado disponível para exportação.");
    return;
  }

  let csv = 'Data,Produto,Descrição,Tipo,Valor (R$),Pago\n';

  gastos.forEach(g => {
    if (g.parcelasDetalhes?.length) {
      g.parcelasDetalhes.forEach(p => {
        csv += `${p.vencimento},${g.produto} (Parcela ${p.numero}),${g.descricao || ''},${g.tipo},${p.valor.toFixed(2)},${p.pago ? 'Sim' : 'Não'}\n`;
      });
    } else {
      csv += `${g.data},${g.produto},${g.descricao || ''},${g.tipo},${g.valor.toFixed(2)},${g.pago ? 'Sim' : 'Não'}\n`;
    }
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `financeiro_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
}

// ===== EXPORTAR FINANCEIRO COMO PDF =====
function exportarFinanceiroPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(12);
  doc.text("Relatório Financeiro", 20, 20);
  let y = 30;

  gastos.forEach(g => {
    doc.text(`${g.data} - ${g.produto} (${g.tipo}) - ${formatarReal(g.valor)} - ${g.pago ? "Pago" : "A Vencer"}`, 20, y);
    y += 8;

    if (g.descricao) {
      doc.text(`Descrição: ${g.descricao}`, 25, y);
      y += 6;
    }

    if (g.parcelasDetalhes?.length) {
      g.parcelasDetalhes.forEach(p => {
        doc.text(`Parcela ${p.numero}: ${p.vencimento} - ${formatarReal(p.valor)} - ${p.pago ? "Pago" : "A Vencer"}`, 25, y);
        y += 6;
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
      });
    }

    y += 4;
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
  });

  doc.save("relatorio_financeiro.pdf");
}

