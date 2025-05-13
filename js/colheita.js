// ====== VARIÁVEIS ======
let colheita = [];
let valorLataGlobal = 0;

// ====== CARREGAMENTO DO VALOR DA LATA ======
function carregarValorLata() {
  db.ref('ValorLata').on('value', snap => {
    if (snap.exists()) {
      valorLataGlobal = snap.val();
      document.getElementById('valorLataColheita').value = valorLataGlobal;
    }
  });
}

function salvarValorLata() {
  valorLataGlobal = parseFloat(document.getElementById('valorLataColheita').value) || 0;
  db.ref('ValorLata').set(valorLataGlobal);
}

// ====== ADIÇÃO DE LANÇAMENTO DE COLHEITA ======
function adicionarColheita() {
  const nova = {
    data: dataColheita.value,
    colhedor: colhedorColheita.value.trim(),
    quantidade: parseFloat(quantidadeLatasColheita.value),
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
  colhedorColheita.value = '';
  quantidadeLatasColheita.value = '';
}

// ====== CARREGAR COLHEITA ======
function carregarColheita() {
  db.ref('Colheita').on('value', snap => {
    colheita = snap.exists() ? Object.values(snap.val()) : [];
    atualizarColheita();
  });
}

// ====== ATUALIZAR LISTA DE COLHEITA ======
function atualizarColheita() {
  const colheitaPendentes = document.getElementById('listaColheitaPendentes');
  const colheitaPagos = document.getElementById('listaColheitaPagos');

  if (!colheitaPendentes || !colheitaPagos) return;

  colheitaPendentes.innerHTML = '';
  colheitaPagos.innerHTML = '';

  const agrupadoPendentes = {};
  const agrupadoPagos = {};

  colheita.forEach((c, i) => {
    if (c.pagoParcial > 0) {
      if (!agrupadoPagos[c.colhedor]) agrupadoPagos[c.colhedor] = [];
      agrupadoPagos[c.colhedor].push({ ...c, quantidade: c.pagoParcial, pago: true, i });
    }
    if (c.quantidade > c.pagoParcial) {
      if (!agrupadoPendentes[c.colhedor]) agrupadoPendentes[c.colhedor] = [];
      agrupadoPendentes[c.colhedor].push({ ...c, quantidade: c.quantidade - c.pagoParcial, pago: false, i });
    }
  });

  montarGrupoColheita(agrupadoPendentes, colheitaPendentes, false);
  montarGrupoColheita(agrupadoPagos, colheitaPagos, true);
  atualizarResumoColheita();
}

// ====== MONTAR LISTAGEM AGRUPADA ======
function montarGrupoColheita(grupo, container, pago) {
  container.innerHTML = '';
  for (const nome in grupo) {
    const bloco = document.createElement('div');
    bloco.className = 'bloco-colhedor';
    bloco.innerHTML = `<strong>${nome}</strong>`;

    grupo[nome].forEach(({ data, quantidade, i }) => {
      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML = `
        <span>${data} - ${quantidade} latas</span>
        <button class="botao-circular vermelho" onclick="excluirColheita(${i})">
          <i class="fas fa-trash"></i>
        </button>
      `;
      bloco.appendChild(div);
    });

    container.appendChild(bloco);
  }
}

// ====== EXCLUIR COLHEITA ======
function excluirColheita(index) {
  if (confirm("Deseja excluir esse lançamento de colheita?")) {
    colheita.splice(index, 1);
    db.ref('Colheita').set(colheita);
    atualizarColheita();
  }
}

// ====== ATUALIZAR RESUMO COLHEITA ======
function atualizarResumoColheita() {
  const resumo = document.getElementById("resumoColheita");
  if (!resumo) return;

  const totalLatas = colheita.reduce((soma, c) => soma + c.quantidade, 0);
  const totalPago = colheita.reduce((soma, c) => soma + (c.pagoParcial * c.valorLata), 0);
  const totalPendente = colheita.reduce((soma, c) => soma + ((c.quantidade - c.pagoParcial) * c.valorLata), 0);

  resumo.innerHTML = `
    <div><strong>Total de Latas:</strong> ${totalLatas.toFixed(2)}</div>
    <div><strong>Total Pago:</strong> R$ ${totalPago.toFixed(2)}</div>
    <div><strong>Total Pendente:</strong> R$ ${totalPendente.toFixed(2)}</div>
  `;
}

// ====== GRÁFICOS (PODE SER IMPLEMENTADO DEPOIS) ======
function gerarGraficoColheita() {
  console.log("Gerar Gráfico de Colheita - Em desenvolvimento");
}

function gerarGraficoColhedor() {
  console.log("Gerar Gráfico de Colhedor - Em desenvolvimento");
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  carregarValorLata();
  carregarColheita();
  document.getElementById('formColheita').addEventListener('submit', adicionarColheita);
});
