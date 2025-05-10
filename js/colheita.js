// ====== VARIÁVEIS ======
let colheita = [];
let valorLataGlobal = 0;
let colhedorAtual = null;

// ====== CARREGAMENTO DO VALOR DA LATA ======
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

// ====== ADIÇÃO DE LANÇAMENTO DE COLHEITA ======
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
            ? `<button class="botao-financeiro" onclick="excluirPagamento(${i})">
                 <i class="fas fa-trash"></i> Excluir Pagamento
               </button>`
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
        <button class="botao-financeiro" onclick="pagarTudoColhedor('${nome}')">
          <i class="fas fa-check"></i> Pagar Tudo
        </button>
        <button class="botao-financeiro" onclick="pagarParcialColhedor('${nome}')">
          <i class="fas fa-coins"></i> Pagar Parcial
        </button>
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

