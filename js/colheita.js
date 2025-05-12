// ===== VARIÁVEIS GLOBAIS =====
let colheita = [];
let valorLataGlobal = 0;

// ===== CARREGAR COLHEITA E VALOR DA LATA =====
async function carregarColheita() {
  const cache = localStorage.getItem('colheita');
  if (cache) {
    colheita = JSON.parse(cache);
    atualizarColheita();
  }

  const snapshot = await db.ref('Colheita').once('value');
  colheita = snapshot.val() ? Object.values(snapshot.val()) : [];
  localStorage.setItem('colheita', JSON.stringify(colheita));
  atualizarColheita();
}

async function carregarValorLata() {
  const snapshot = await db.ref('ValorLata').once('value');
  if (snapshot.exists()) {
    valorLataGlobal = snapshot.val();
    document.getElementById('valorLata').value = valorLataGlobal;
  }
}

// ===== SALVAR VALOR DA LATA =====
function salvarValorLata() {
  valorLataGlobal = parseFloat(document.getElementById('valorLata').value) || 0;
  db.ref('ValorLata').set(valorLataGlobal);
  mostrarSucesso("Valor da lata atualizado com sucesso!");
}

// ===== ADICIONAR COLHEITA =====
function adicionarColheita() {
  const nova = {
    data: document.getElementById('dataColheita').value,
    colhedor: document.getElementById('colhedor').value.trim(),
    quantidade: parseFloat(document.getElementById('quantidadeLatas').value),
    valorLata: valorLataGlobal,
    pago: false,
    pagoParcial: 0
  };

  if (!nova.data || !nova.colhedor || isNaN(nova.quantidade) || nova.quantidade <= 0) {
    mostrarErro("Preencha todos os campos corretamente.");
    return;
  }

  colheita.push(nova);
  db.ref('Colheita').set(colheita);
  atualizarColheita();
  limparCamposColheita();
  mostrarSucesso("Colheita adicionada com sucesso!");
}

// ===== LIMPAR CAMPOS =====
function limparCamposColheita() {
  document.getElementById('dataColheita').value = '';
  document.getElementById('colhedor').value = '';
  document.getElementById('quantidadeLatas').value = '';
}

// ===== ATUALIZAR LISTAGEM =====
function atualizarColheita() {
  const listaPendentes = document.getElementById("colheitaPendentes");
  const listaPagos = document.getElementById("colheitaPagos");
  listaPendentes.innerHTML = '';
  listaPagos.innerHTML = '';

  colheita.forEach((c, index) => {
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
      <span>${c.data} - ${c.colhedor} - ${c.quantidade} latas</span>
      <div class="botoes-colheita">
        <button class="botao-circular azul" onclick="marcarComoPago(${index})">
          <i class="fas fa-check"></i>
        </button>
        <button class="botao-circular vermelho" onclick="confirmarExclusaoColheita(${index})">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    (c.pago ? listaPagos : listaPendentes).appendChild(item);
  });

  atualizarResumoColheita();
}

// ===== MARCAR COMO PAGO =====
function marcarComoPago(index) {
  colheita[index].pago = true;
  db.ref('Colheita').set(colheita);
  atualizarColheita();
  mostrarSucesso("Pagamento confirmado!");
}

// ===== CONFIRMAR EXCLUSÃO =====
function confirmarExclusaoColheita(index) {
  Swal.fire({
    title: 'Você tem certeza?',
    text: "Esta ação não pode ser desfeita!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Sim, excluir!',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      excluirColheita(index);
    }
  });
}

// ===== EXCLUIR COLHEITA =====
function excluirColheita(index) {
  colheita.splice(index, 1);
  db.ref('Colheita').set(colheita);
  atualizarColheita();
  mostrarSucesso("Registro de colheita excluído com sucesso!");
}

// ===== ATUALIZAR RESUMO =====
function atualizarResumoColheita() {
  const totalLatas = colheita.reduce((soma, c) => soma + c.quantidade, 0);
  const totalPago = colheita.filter(c => c.pago).reduce((soma, c) => soma + (c.quantidade * c.valorLata), 0);
  const totalPendente = colheita.filter(c => !c.pago).reduce((soma, c) => soma + (c.quantidade * c.valorLata), 0);

  document.getElementById("resumoColheita").innerHTML = `
    <div><strong>Total de Latas:</strong> ${totalLatas.toFixed(2)}</div>
    <div><strong>Total Pago:</strong> R$ ${totalPago.toFixed(2)}</div>
    <div><strong>Total Pendente:</strong> R$ ${totalPendente.toFixed(2)}</div>
  `;
}

// ===== FEEDBACK VISUAL (SWEETALERT) =====
function mostrarSucesso(mensagem) {
  Swal.fire({
    icon: 'success',
    title: 'Sucesso!',
    text: mensagem,
    timer: 2000,
    showConfirmButton: false
  });
}

function mostrarErro(mensagem) {
  Swal.fire({
    icon: 'error',
    title: 'Erro!',
    text: mensagem,
    timer: 2000,
    showConfirmButton: false
  });
}

// ===== INICIALIZAR COLHEITA =====
document.addEventListener("dadosCarregados", () => {
  carregarColheita();
  carregarValorLata();
});
