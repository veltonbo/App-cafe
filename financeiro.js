// ===== VARIÁVEIS GLOBAIS =====
let gastos = [];
let indiceEdicaoGasto = null;
let editarTodasParcelas = false;
let graficoGastosChart = null;

// ===== INICIALIZAR MENU FINANCEIRO =====
function inicializarFinanceiro() {
  carregarFinanceiro();
}

// ===== BOTÃO FLUTUANTE PARA FORMULÁRIO =====
function alternarFormularioFinanceiro() {
  const form = document.getElementById("formularioFinanceiro");
  form.style.display = form.style.display === "none" ? "block" : "none";
}

// ===== MOSTRAR/ESCONDER PARCELAS =====
function mostrarParcelas() {
  const chk = document.getElementById("parceladoFin");
  const inputParcelas = document.getElementById("parcelasFin");
  inputParcelas.style.display = chk.checked ? "block" : "none";
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

  const novoGasto = {
    data,
    produto,
    descricao,
    valor,
    tipo,
    pago: false,
    parcelas: numParcelas
  };

  if (numParcelas > 1) {
    const valorParcela = parseFloat((valor / numParcelas).toFixed(2));
    const parcelas = Array.from({ length: numParcelas }, (_, i) => ({
      numero: i + 1,
      valor: valorParcela,
      vencimento: new Date(data).setMonth(new Date(data).getMonth() + i),
      pago: false
    }));
    novoGasto.parcelasDetalhes = parcelas;
  }

  if (indiceEdicaoGasto !== null) {
    const original = gastos[indiceEdicaoGasto];
    if (editarTodasParcelas) {
      original.parcelasDetalhes.forEach((p, idx) => {
        p.valor = parseFloat((valor / numParcelas).toFixed(2));
        p.vencimento = new Date(data).setMonth(new Date(data).getMonth() + idx);
      });
    } else {
      const idx = parseInt(parcelasFin.dataset.parcelaIndex);
      if (!isNaN(idx)) {
        original.parcelasDetalhes[idx].valor = valor;
        original.parcelasDetalhes[idx].vencimento = data;
      }
    }
  } else {
    gastos.push(novoGasto);
  }

  indiceEdicaoGasto = null;
  editarTodasParcelas = false;
  parcelasFin.dataset.parcelaIndex = "";
  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();
  limparFormularioFinanceiro();
}

// ===== LIMPAR FORMULÁRIO =====
function limparFormularioFinanceiro() {
  dataFin.value = "";
  produtoFin.value = "";
  descricaoFin.value = "";
  valorFin.value = "";
  tipoFin.value = "Adubo";
  parcelasFin.value = "";
  parcelasFin.dataset.parcelaIndex = "";
  parceladoFin.checked = false;
  mostrarParcelas();
  document.getElementById("formularioFinanceiro").style.display = "none";
  document.getElementById("btnSalvarFinanceiro").innerHTML = '<i class="fas fa-save"></i> Salvar Gasto';
  document.getElementById("btnCancelarFinanceiro").style.display = "none";
}

// ===== ATUALIZAR LISTAGEM =====
function atualizarFinanceiro() {
  const venc = document.getElementById("financeiroVencer");
  const pagos = document.getElementById("financeiroPago");
  venc.innerHTML = "";
  pagos.innerHTML = "";

  const dadosVencer = {};
  const dadosPago = {};

  gastos.forEach((g, index) => {
    const grupo = g.pago ? dadosPago : dadosVencer;
    const mes = g.data.slice(0, 7);
    if (!grupo[mes]) grupo[mes] = [];
    grupo[mes].push({ ...g, i: index });
  });

  renderizarFinanceiro(dadosVencer, venc, false);
  renderizarFinanceiro(dadosPago, pagos, true);
  gerarResumoFinanceiro();
  gerarGraficoFinanceiro();
}

// ===== RENDERIZAR FINANCEIRO =====
function renderizarFinanceiro(grupo, container, pago) {
  for (const mes in grupo) {
    const titulo = document.createElement("div");
    titulo.className = "grupo-data";
    titulo.innerText = formatarMes(mes);
    container.appendChild(titulo);

    grupo[mes].forEach(({ produto, valor, tipo, i, pago }) => {
      const div = document.createElement("div");
      div.className = "item botoes-3";
      div.innerHTML = `
        <span><strong>${produto}</strong> - R$ ${valor.toFixed(2)} (${tipo})</span>
        <div class="botoes-tarefa">
          <button class="botao-circular laranja" onclick="desfazerPagamento(${i})"><i class="fas fa-undo"></i></button>
          <button class="botao-circular azul" onclick="editarFinanceiro(${i})"><i class="fas fa-edit"></i></button>
          <button class="botao-circular vermelho" onclick="confirmarExclusaoParcela(${i})"><i class="fas fa-trash"></i></button>
        </div>
      `;
      container.appendChild(div);
    });
  }
}

// ===== GERAR RESUMO FINANCEIRO =====
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

// ===== CARREGAR DADOS FINANCEIROS =====
function carregarFinanceiro() {
  db.ref("Financeiro").on("value", (snapshot) => {
    const data = snapshot.val();
    gastos = Array.isArray(data) ? data : [];
    atualizarFinanceiro();
  });
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
