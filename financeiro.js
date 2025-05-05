// ===== VARIÁVEIS =====
let gastos = [];
let graficoGastosChart = null;
let indiceEdicaoGasto = null;
let editarTodasParcelas = false;

// ===== CARREGAR FINANCEIRO =====
function carregarFinanceiro() {
  db.ref("Financeiro").on("value", snap => {
    gastos = snap.exists() ? snap.val() : [];
    atualizarFinanceiro();
  });
}

// ===== MOSTRAR PARCELAS =====
function mostrarParcelas() {
  const isParcelado = document.getElementById("parceladoFin").checked;
  document.getElementById("parcelasFin").style.display = isParcelado ? "inline-block" : "none";
}

// ===== TOGGLE FILTROS =====
function toggleFiltrosFinanceiro() {
  const div = document.getElementById("filtrosFinanceiro");
  div.style.display = div.style.display === "none" ? "block" : "none";
}

// ===== CANCELAR EDIÇÃO =====
function cancelarEdicaoFinanceiro() {
  indiceEdicaoGasto = null;
  editarTodasParcelas = false;
  limparCamposFinanceiro();
  document.getElementById("btnSalvarFinanceiro").innerHTML = '<i class="fas fa-save"></i> Salvar Gasto';
  document.getElementById("btnCancelarFinanceiro").style.display = "none";
}

// ===== ADICIONAR OU EDITAR GASTO =====
function adicionarFinanceiro() {
  const data = document.getElementById("dataFin").value;
  const produto = document.getElementById("produtoFin").value.trim();
  const descricao = document.getElementById("descricaoFin").value.trim();
  const valor = parseFloat(document.getElementById("valorFin").value);
  const tipo = document.getElementById("tipoFin").value;
  const parcelado = document.getElementById("parceladoFin").checked;
  const numParcelas = parcelado ? parseInt(document.getElementById("parcelasFin").value) || 1 : 1;

  if (!data || !produto || isNaN(valor)) {
    alert("Preencha os campos obrigatórios.");
    return;
  }

  if (indiceEdicaoGasto !== null) {
    const original = gastos[indiceEdicaoGasto];

    if (original.parcelasDetalhes && original.parcelasDetalhes.length > 0) {
      if (editarTodasParcelas) {
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

        gastos[indiceEdicaoGasto] = {
          data, produto, descricao, valor, tipo,
          pago: false,
          parcelas: numParcelas,
          parcelasDetalhes: parcelas
        };
      } else {
        const parcelaSelecionada = document.getElementById("parcelasFin").dataset.parcelaIndex;
        const i = parseInt(parcelaSelecionada);
        if (!isNaN(i)) {
          original.parcelasDetalhes[i].valor = valor;
          original.parcelasDetalhes[i].vencimento = data;
        }
      }
    } else {
      gastos[indiceEdicaoGasto] = {
        data, produto, descricao, valor, tipo,
        pago: false,
        parcelas: 1
      };
    }

    indiceEdicaoGasto = null;
    editarTodasParcelas = false;
    document.getElementById("btnSalvarFinanceiro").innerHTML = '<i class="fas fa-save"></i> Salvar Gasto';
    document.getElementById("btnCancelarFinanceiro").style.display = "none";
  } else {
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

    gastos.push(novo);
  }

  db.ref("Financeiro").set(gastos);
  limparCamposFinanceiro();
  atualizarFinanceiro();
}

// ===== LIMPAR CAMPOS =====
function limparCamposFinanceiro() {
  document.getElementById("dataFin").value = "";
  document.getElementById("produtoFin").value = "";
  document.getElementById("descricaoFin").value = "";
  document.getElementById("valorFin").value = "";
  document.getElementById("tipoFin").value = "Adubo";
  document.getElementById("parceladoFin").checked = false;
  document.getElementById("parcelasFin").value = "";
  document.getElementById("parcelasFin").style.display = "none";
  document.getElementById("btnSalvarFinanceiro").innerHTML = '<i class="fas fa-save"></i> Salvar Gasto';
  document.getElementById("btnCancelarFinanceiro").style.display = "none";
  document.getElementById("parcelasFin").dataset.parcelaIndex = "";
  indiceEdicaoGasto = null;
  editarTodasParcelas = false;
}

// ===== MOSTRAR/ESCONDER PARCELAS =====
function mostrarParcelas() {
  const campoParcelas = document.getElementById("parcelasFin");
  campoParcelas.style.display = document.getElementById("parceladoFin").checked ? "block" : "none";
}

// ===== MOSTRAR/ESCONDER FILTROS =====
function toggleFiltrosFinanceiro() {
  const filtros = document.getElementById("filtrosFinanceiro");
  filtros.style.display = filtros.style.display === "none" ? "block" : "none";
}

// ===== EDITAR GASTO =====
function editarFinanceiro(index, parcelaIndex = null) {
  const g = gastos[index];
  if (!g) return;

  document.getElementById("dataFin").value = parcelaIndex !== null ? g.parcelasDetalhes[parcelaIndex].vencimento : g.data;
  document.getElementById("produtoFin").value = g.produto;
  document.getElementById("descricaoFin").value = g.descricao || "";
  document.getElementById("valorFin").value = parcelaIndex !== null ? g.parcelasDetalhes[parcelaIndex].valor : g.valor;
  document.getElementById("tipoFin").value = g.tipo;
  document.getElementById("parceladoFin").checked = !!g.parcelasDetalhes;
  document.getElementById("parcelasFin").style.display = !!g.parcelasDetalhes ? "block" : "none";
  document.getElementById("parcelasFin").value = g.parcelas || "";
  document.getElementById("parcelasFin").dataset.parcelaIndex = parcelaIndex !== null ? parcelaIndex : "";

  indiceEdicaoGasto = index;

  if (g.parcelasDetalhes && parcelaIndex !== null) {
    mostrarModalEditarParcela();
  } else {
    editarTodasParcelas = true;
  }

  document.getElementById("btnSalvarFinanceiro").innerHTML = '<i class="fas fa-edit"></i> Salvar Edição';
  document.getElementById("btnCancelarFinanceiro").style.display = "inline-block";
}

// ===== CANCELAR EDIÇÃO =====
function cancelarEdicaoFinanceiro() {
  limparCamposFinanceiro();
}

// ===== MODAL PARA ESCOLHER TIPO DE EDIÇÃO DE PARCELA =====
function mostrarModalEditarParcela() {
  const modal = document.createElement("div");
  modal.id = "modalEditarParcela";
  modal.style.cssText = `
    position:fixed;top:0;left:0;width:100%;height:100%;
    background:#000a;z-index:9999;display:flex;
    align-items:center;justify-content:center;
  `;

  modal.innerHTML = `
    <div style="background:#2c2c2c;padding:20px;border-radius:10px;width:90%;max-width:300px;text-align:center;">
      <p style="color:white;font-size:16px;">Editar todas as parcelas ou somente esta?</p>
      <button onclick="confirmarEditarParcela(true)" style="background:#4caf50;margin-bottom:10px;">Todas</button><br>
      <button onclick="confirmarEditarParcela(false)" style="background:#2196f3;margin-bottom:10px;">Somente esta</button><br>
      <button onclick="fecharModalEditarParcela()" style="background:#f44336;">Cancelar</button>
    </div>
  `;
  document.body.appendChild(modal);
}

function confirmarEditarParcela(todas) {
  editarTodasParcelas = todas;
  fecharModalEditarParcela();
}

function fecharModalEditarParcela() {
  const modal = document.getElementById("modalEditarParcela");
  if (modal) modal.remove();
}
