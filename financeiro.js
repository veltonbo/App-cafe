// ===== VARIÁVEIS =====
let gastos = [];
let graficoGastosChart = null;
let indiceEdicaoGasto = null;
let indiceParcelaEdicao = null;
let editarTodasParcelas = false;

// ===== CARREGAR DADOS =====
function carregarFinanceiro() {
  db.ref("Financeiro").on("value", snap => {
    gastos = snap.exists() ? snap.val() : [];
    atualizarFinanceiro();
  });
}

// ===== MOSTRAR OCULTAR PARCELAS =====
function mostrarParcelas() {
  document.getElementById("parcelasFin").style.display = parceladoFin.checked ? "inline-block" : "none";
}

// ===== ADICIONAR OU EDITAR FINANCEIRO =====
function adicionarFinanceiro() {
  const novo = {
    data: dataFin.value,
    produto: produtoFin.value.trim(),
    descricao: descricaoFin.value.trim(),
    valor: parseFloat(valorFin.value),
    tipo: tipoFin.value,
    pago: false,
    parcelas: parceladoFin.checked ? parseInt(parcelasFin.value) || 1 : 1
  };

  if (!novo.data || !novo.produto || isNaN(novo.valor)) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  // GERA PARCELAS
  if (novo.parcelas > 1) {
    const valorParcela = parseFloat((novo.valor / novo.parcelas).toFixed(2));
    const base = new Date(novo.data);
    novo.parcelasDetalhes = [];

    for (let i = 0; i < novo.parcelas; i++) {
      const venc = new Date(base);
      venc.setMonth(venc.getMonth() + i);
      novo.parcelasDetalhes.push({
        numero: i + 1,
        valor: valorParcela,
        vencimento: venc.toISOString().split("T")[0],
        pago: false
      });
    }
  }

  if (indiceEdicaoGasto !== null) {
    if (indiceParcelaEdicao !== null && !editarTodasParcelas) {
      // EDITAR APENAS UMA PARCELA
      gastos[indiceEdicaoGasto].parcelasDetalhes[indiceParcelaEdicao].valor = novo.valor;
      gastos[indiceEdicaoGasto].parcelasDetalhes[indiceParcelaEdicao].vencimento = novo.data;
      gastos[indiceEdicaoGasto].produto = novo.produto;
      gastos[indiceEdicaoGasto].descricao = novo.descricao;
      gastos[indiceEdicaoGasto].tipo = novo.tipo;
    } else {
      // EDITAR TODO O LANÇAMENTO
      gastos[indiceEdicaoGasto] = novo;
    }

    indiceEdicaoGasto = null;
    indiceParcelaEdicao = null;
    editarTodasParcelas = false;
    document.getElementById("btnSalvarFinanceiro").innerHTML = `<i class="fas fa-save"></i> Salvar Gasto`;
    document.getElementById("btnCancelarEdicaoFin").style.display = "none";
  } else {
    gastos.push(novo);
  }

  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();
  limparCamposFinanceiro();
}

// ===== CANCELAR EDIÇÃO =====
function cancelarEdicaoFinanceiro() {
  indiceEdicaoGasto = null;
  indiceParcelaEdicao = null;
  editarTodasParcelas = false;
  limparCamposFinanceiro();
  document.getElementById("btnSalvarFinanceiro").innerHTML = `<i class="fas fa-save"></i> Salvar Gasto`;
  document.getElementById("btnCancelarEdicaoFin").style.display = "none";
}

// ===== LIMPAR CAMPOS =====
function limparCamposFinanceiro() {
  dataFin.value = '';
  produtoFin.value = '';
  descricaoFin.value = '';
  valorFin.value = '';
  tipoFin.value = 'Adubo';
  parcelasFin.value = '';
  parceladoFin.checked = false;
  mostrarParcelas();
}

// ===== ATUALIZAR LISTAGEM =====
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

  gastos.forEach((g, i) => {
    const txt = `${g.data} ${g.produto} ${(g.descricao || "")} ${g.tipo}`.toLowerCase();
    if (!txt.includes(filtroTexto)) return;
    if (tipoFiltro && g.tipo !== tipoFiltro) return;

    if (g.parcelasDetalhes?.length) {
      g.parcelasDetalhes.forEach((p, pi) => {
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
          i,
          parcelaIndex: pi,
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
      grupo[mes].push({ ...g, i, isParcela: false });
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
      div.className = "item fade-in";
      const botoes = [];

      if (isParcela) {
        if (!pago) {
          botoes.push(`<button class="botao-circular verde" onclick="alternarParcela(${i}, ${parcelaIndex})"><i class="fas fa-check"></i></button>`);
          botoes.push(`<button class="botao-circular azul" onclick="editarParcela(${i}, ${parcelaIndex})"><i class="fas fa-edit"></i></button>`);
        } else {
          botoes.push(`<button class="botao-circular verde" onclick="alternarParcela(${i}, ${parcelaIndex})"><i class="fas fa-undo"></i></button>`);
        }
        botoes.push(`<button class="botao-circular vermelho" onclick="confirmarExclusaoParcela(${i}, ${parcelaIndex})"><i class="fas fa-trash"></i></button>`);
      } else {
        if (!pago) {
          botoes.push(`<button class="botao-circular verde" onclick="marcarPago(${i})"><i class="fas fa-check"></i></button>`);
          botoes.push(`<button class="botao-circular azul" onclick="editarGasto(${i})"><i class="fas fa-edit"></i></button>`);
        } else {
          botoes.push(`<button class="botao-circular verde" onclick="desfazerPagamento(${i})"><i class="fas fa-undo"></i></button>`);
        }
        botoes.push(`<button class="botao-circular vermelho" onclick="confirmarExclusaoParcela(${i})"><i class="fas fa-trash"></i></button>`);
      }

      const classeBotoes = botoes.length === 3 ? 'botoes-3' : 'botoes-2';
      div.classList.add(classeBotoes);
      div.innerHTML = `
        <span>
          <i class="fas fa-${icone}"></i> 
          <strong>${produto}</strong> - R$ ${valor.toFixed(2)} (${tipo}) 
          ${descricao ? `<br><small style="color:#ccc;">${descricao}</small>` : ''}
          ${isParcela ? `<br><small>Venc: ${vencimento}</small>` : ''}
        </span>
        <div class="botoes-tarefa">${botoes.join('')}</div>
      `;
      container.appendChild(div);
    });

    const totalDiv = document.createElement("div");
    totalDiv.className = "grupo-data";
    totalDiv.innerHTML = `<span style="font-size:14px;">Total: R$ ${totalMes.toFixed(2)}</span>`;
    container.appendChild(totalDiv);
  }
}

