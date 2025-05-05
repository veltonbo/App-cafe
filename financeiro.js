// ===== VARIÁVEIS =====
let gastos = [];
let graficoGastosChart = null;
let indiceEdicaoGasto = null;
let editarTodasParcelas = false;

// ===== CARREGAR FINANCEIRO =====
function carregarFinanceiro() {
  const ano = localStorage.getItem('anoAtual');
  if (!ano) return;
  db.ref(`safras/${ano}/financeiro`).on("value", snap => {
    gastos = snap.exists() ? snap.val() : [];
    atualizarFinanceiro();
  });
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
    alert("Preencha todos os campos obrigatórios.");
    return;
  }

  const ano = localStorage.getItem('anoAtual');
  if (!ano) return;

  const novo = {
    data, produto, descricao, valor, tipo,
    pago: false,
    parcelas: numParcelas
  };

  if (numParcelas > 1) {
    const valorParcela = parseFloat((valor / numParcelas).toFixed(2));
    const parcelas = [];
    const dataBase = new Date(data);
    for (let i = 0; i < numParcelas; i++) {
      const venc = new Date(dataBase);
      venc.setMonth(venc.getMonth() + i);
      parcelas.push({
        numero: i + 1,
        valor: valorParcela,
        vencimento: venc.toISOString().split("T")[0],
        pago: false
      });
    }
    novo.parcelasDetalhes = parcelas;
  }

  if (indiceEdicaoGasto !== null) {
    gastos[indiceEdicaoGasto] = novo;
    indiceEdicaoGasto = null;
    editarTodasParcelas = false;
  } else {
    gastos.push(novo);
  }

  db.ref(`safras/${ano}/financeiro`).set(gastos);
  limparCamposFinanceiro();
  atualizarFinanceiro();
}

// ===== LIMPAR CAMPOS =====
function limparCamposFinanceiro() {
  dataFin.value = "";
  produtoFin.value = "";
  descricaoFin.value = "";
  valorFin.value = "";
  tipoFin.value = "Adubo";
  parcelasFin.value = "";
  parceladoFin.checked = false;
  mostrarParcelas();
  indiceEdicaoGasto = null;
  editarTodasParcelas = false;
  btnSalvarGasto.innerHTML = '<i class="fas fa-save"></i> Salvar Gasto';
  btnCancelarEdicaoGasto.style.display = "none";
}

// ===== ATUALIZAR LISTAGEM =====
function atualizarFinanceiro() {
  const filtroTexto = pesquisaFinanceiro.value.toLowerCase();
  const tipoFiltro = filtroTipoFin.value;
  const statusFiltro = filtroStatusFin.value;
  const dataIni = filtroDataInicioFin.value;
  const dataFim = filtroDataFimFin.value;

  const vencer = document.getElementById("financeiroVencer");
  const pagos = document.getElementById("financeiroPago");
  vencer.innerHTML = "";
  pagos.innerHTML = "";

  const grupoVencer = {};
  const grupoPago = {};

  gastos.forEach((g, index) => {
    const texto = `${g.data} ${g.produto} ${(g.descricao || "")} ${g.tipo}`.toLowerCase();
    if (!texto.includes(filtroTexto)) return;
    if (tipoFiltro && g.tipo !== tipoFiltro) return;

    if (g.parcelasDetalhes) {
      g.parcelasDetalhes.forEach((p, parcelaIndex) => {
        if (statusFiltro === "pago" && !p.pago) return;
        if (statusFiltro === "vencer" && p.pago) return;
        if (dataIni && p.vencimento < dataIni) return;
        if (dataFim && p.vencimento > dataFim) return;
        const mes = p.vencimento.slice(0, 7);
        const grupo = p.pago ? grupoPago : grupoVencer;
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
      const mes = g.data.slice(0, 7);
      const grupo = g.pago ? grupoPago : grupoVencer;
      if (!grupo[mes]) grupo[mes] = [];
      grupo[mes].push({ ...g, i: index, isParcela: false });
    }
  });

  renderizarFinanceiro(grupoVencer, vencer, false);
  renderizarFinanceiro(grupoPago, pagos, true);
  gerarResumoFinanceiro();
  gerarGraficoFinanceiro();
}

// ===== RENDERIZAR ITENS =====
function renderizarFinanceiro(grupo, container, pago) {
  for (const mes in grupo) {
    const titulo = document.createElement("div");
    titulo.className = "grupo-data";
    titulo.innerText = formatarMes(mes);
    container.appendChild(titulo);

    grupo[mes].forEach(({ produto, descricao, valor, tipo, vencimento, i, parcelaIndex, isParcela, pago }) => {
      const icone = tipo === "Adubo" ? "leaf"
        : tipo === "Fungicida" ? "bug"
        : tipo === "Inseticida" ? "spray-can"
        : tipo === "Herbicida" ? "recycle"
        : "tag";

      const item = document.createElement("div");
      item.className = `item fade-in ${pago ? 'botoes-2' : 'botoes-3'}`;
      item.innerHTML = `
        <span>
          <i class="fas fa-${icone}"></i>
          <strong>${produto}</strong> - R$ ${valor.toFixed(2)} (${tipo})
          ${descricao ? `<br><small style="color:#ccc;">${descricao}</small>` : ''}
          ${isParcela ? `<br><small>Venc: ${vencimento}</small>` : ''}
        </span>
        <div class="botoes-tarefa">
          ${isParcela
            ? `<button class="botao-circular verde" onclick="alternarParcela(${i}, ${parcelaIndex})"><i class="fas ${pago ? 'fa-undo' : 'fa-check'}"></i></button>`
            : pago
              ? `<button class="botao-circular verde" onclick="desfazerPagamento(${i})"><i class="fas fa-undo"></i></button>`
              : `<button class="botao-circular verde" onclick="marcarPago(${i})"><i class="fas fa-check"></i></button>`}
          <button class="botao-circular azul" onclick="editarFinanceiro(${i}, ${isParcela ? parcelaIndex : 'null'})"><i class="fas fa-pen"></i></button>
          <button class="botao-circular vermelho" onclick="confirmarExclusaoParcela(${i}, ${isParcela ? parcelaIndex : 'null'})"><i class="fas fa-trash"></i></button>
        </div>
      `;
      container.appendChild(item);
    });
  }
}
