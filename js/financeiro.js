// ===== VARIÁVEIS GLOBAIS =====
let lancamentos = [];
let indiceEdicaoFinanceiro = null;

// ===== CARREGAR LANÇAMENTOS =====
function carregarFinanceiro() {
  db.ref('Financeiro').on('value', snap => {
    lancamentos = snap.exists() ? snap.val() : [];
    atualizarFinanceiro();
  });
}

// ===== ADICIONAR OU EDITAR LANÇAMENTO =====
function adicionarFinanceiro() {
  const data = document.getElementById("dataFinanceiro").value;
  const descricao = document.getElementById("descricaoFinanceiro").value.trim();
  const valor = parseFloat(document.getElementById("valorFinanceiro").value);
  const tipo = document.getElementById("tipoFinanceiro").value;
  const parcelado = document.getElementById("parceladoFinanceiro").checked;
  const parcelas = parcelado ? parseInt(document.getElementById("parcelasFinanceiro").value) || 1 : 1;

  if (!data || !descricao || isNaN(valor)) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  const novoLancamento = {
    data,
    descricao,
    valor,
    tipo,
    parcelado,
    parcelas: parcelado ? gerarParcelas(valor, parcelas) : null
  };

  if (indiceEdicaoFinanceiro !== null) {
    lancamentos[indiceEdicaoFinanceiro] = novoLancamento;
    indiceEdicaoFinanceiro = null;
  } else {
    lancamentos.push(novoLancamento);
  }

  db.ref('Financeiro').set(lancamentos);
  atualizarFinanceiro();
  limparCamposFinanceiro();
}

// ===== GERAR PARCELAS =====
function gerarParcelas(valorTotal, numParcelas) {
  const valorParcela = (valorTotal / numParcelas).toFixed(2);
  const parcelas = [];
  for (let i = 0; i < numParcelas; i++) {
    parcelas.push({
      numero: i + 1,
      valor: parseFloat(valorParcela),
      pago: false
    });
  }
  return parcelas;
}

// ===== LIMPAR CAMPOS =====
function limparCamposFinanceiro() {
  document.getElementById("dataFinanceiro").value = '';
  document.getElementById("descricaoFinanceiro").value = '';
  document.getElementById("valorFinanceiro").value = '';
  document.getElementById("tipoFinanceiro").value = 'Receita';
  document.getElementById("parceladoFinanceiro").checked = false;
  document.getElementById("parcelasFinanceiro").style.display = 'none';
}

// ===== MOSTRAR PARCELAS =====
function mostrarParcelas() {
  const checkbox = document.getElementById("parceladoFinanceiro");
  const inputParcelas = document.getElementById("parcelasFinanceiro");
  inputParcelas.style.display = checkbox.checked ? "block" : "none";
}

// ===== ATUALIZAR LISTAGEM =====
function atualizarFinanceiro() {
  const lista = document.getElementById("listaFinanceiro");
  lista.innerHTML = '';

  const termoBusca = document.getElementById("pesquisaFinanceiro").value.toLowerCase();
  lancamentos.forEach((lanc, index) => {
    const item = document.createElement('div');
    item.className = "item";
    item.innerHTML = `
      <div>
        ${lanc.data} - ${lanc.descricao} - R$ ${lanc.valor.toFixed(2)} - ${lanc.tipo}
        ${lanc.parcelado ? `(Parcelado: ${lanc.parcelas.length}x)` : ''}
      </div>
      <div>
        <button class="botao-circular azul" onclick="editarFinanceiro(${index})"><i class="fas fa-edit"></i></button>
        <button class="botao-circular vermelho" onclick="excluirFinanceiro(${index})"><i class="fas fa-trash"></i></button>
      </div>
    `;
    lista.appendChild(item);
  });
}

// ===== EDITAR LANÇAMENTO =====
function editarFinanceiro(index) {
  const lanc = lancamentos[index];
  document.getElementById("dataFinanceiro").value = lanc.data;
  document.getElementById("descricaoFinanceiro").value = lanc.descricao;
  document.getElementById("valorFinanceiro").value = lanc.valor;
  document.getElementById("tipoFinanceiro").value = lanc.tipo;
  document.getElementById("parceladoFinanceiro").checked = lanc.parcelado;
  document.getElementById("parcelasFinanceiro").value = lanc.parcelado ? lanc.parcelas.length : '';
  mostrarParcelas();
  indiceEdicaoFinanceiro = index;
}

// ===== EXCLUIR LANÇAMENTO =====
function excluirFinanceiro(index) {
  if (confirm("Deseja excluir este lançamento?")) {
    lancamentos.splice(index, 1);
    db.ref('Financeiro').set(lancamentos);
    atualizarFinanceiro();
  }
}

// ===== INICIALIZAR =====
document.addEventListener("DOMContentLoaded", carregarFinanceiro);
