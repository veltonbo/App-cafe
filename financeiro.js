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
      gasto.parcelasDetalhes = Array.from({ length: numParcelas }, (_, i) => ({
        numero: i + 1,
        valor: parseFloat((valor / numParcelas).toFixed(2)),
        vencimento: new Date(data).setMonth(new Date(data).getMonth() + i).toISOString().split("T")[0],
        pago: false
      }));
      gasto.parcelas = numParcelas;
    } else {
      delete gasto.parcelasDetalhes;
      gasto.parcelas = 1;
    }
    gasto.data = data;
    gasto.produto = produto;
    gasto.descricao = descricao;
    gasto.valor = valor;
    gasto.tipo = tipo;
  } else {
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
      novoGasto.parcelasDetalhes = Array.from({ length: numParcelas }, (_, i) => ({
        numero: i + 1,
        valor: parseFloat((valor / numParcelas).toFixed(2)),
        vencimento: new Date(data).setMonth(new Date(data).getMonth() + i).toISOString().split("T")[0],
        pago: false
      }));
    }

    gastos.push(novoGasto);
  }

  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();
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
          parcelaIndex
        });
      });
    } else {
      const grupo = g.pago ? dadosPago : dadosVencer;
      const mes = g.data.slice(0, 7);
      if (!grupo[mes]) grupo[mes] = [];
      grupo[mes].push({ ...g, i: index });
    }
  });

  renderizarFinanceiro(dadosVencer, venc, false);
  renderizarFinanceiro(dadosPago, pagos, true);
  gerarResumoFinanceiro();
  gerarGraficoFinanceiro();
}

// ===== RENDERIZAR GASTOS =====
function renderizarFinanceiro(grupo, container, pago) {
  const mesesOrdenados = Object.keys(grupo).sort((a, b) => b.localeCompare(a));
  for (const mes of mesesOrdenados) {
    const titulo = document.createElement("div");
    titulo.className = "grupo-data";
    titulo.innerText = formatarMes(mes);
    container.appendChild(titulo);

    grupo[mes].forEach(({ produto, descricao, valor, tipo, vencimento, i, parcelaIndex }) => {
      const div = document.createElement("div");
      div.className = "item-financeiro";
      div.innerHTML = `
        <div class="item-texto">
          <strong>${produto}</strong> - ${formatarReal(valor)} (${tipo}) 
          ${descricao ? `<br><small>${descricao}</small>` : ''}
          ${vencimento ? `<br><small>Venc: ${vencimento}</small>` : ''}
        </div>
        <div class="botoes-tarefa">
          <button class="botao-circular verde" onclick="marcarPago(${i}, ${parcelaIndex})">
            <i class="fas ${pago ? 'fa-undo' : 'fa-check'}"></i>
          </button>
          <button class="botao-circular azul" onclick="editarFinanceiro(${i}, ${parcelaIndex})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="botao-circular vermelho" onclick="confirmarExclusao(${i}, ${parcelaIndex})">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
      container.appendChild(div);
    });
  }
}

// ===== FORMATAÇÕES =====
function formatarReal(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarMes(mes) {
  const [ano, mesNum] = mes.split("-");
  return `${mesNum}/${ano}`;
}
