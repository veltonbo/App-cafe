// ===== IMPORTAÇÕES =====
import { db, auth } from './firebase-config.js';
import { saveDataOffline, loadDataOffline } from './offline-db.js';

// ===== VARIÁVEIS GLOBAIS =====
let gastos = [];
let indiceEdicaoGasto = null;

// ===== INICIALIZAR FINANCEIRO =====
async function inicializarFinanceiro() {
  try {
    if (navigator.onLine) {
      db.ref("Financeiro").on("value", (snapshot) => {
        const dados = snapshot.val();
        gastos = dados ? Object.values(dados) : [];
        atualizarFinanceiro();
        
        // Salvar offline
        if (gastos.length > 0) {
          saveDataOffline('financeiro', gastos).catch(console.error);
        }
      });
    } else {
      // Modo offline
      const dados = await loadDataOffline('financeiro');
      gastos = dados || [];
      atualizarFinanceiro();
      mostrarNotificacao('Você está visualizando dados offline do financeiro');
    }
  } catch (error) {
    console.error('Erro ao carregar financeiro:', error);
    mostrarNotificacao('Erro ao carregar dados financeiros', 'error');
  }
  
  document.getElementById("btnCancelarFinanceiro").addEventListener("click", cancelarEdicaoFinanceiro);
}

// ===== ALTERNAR FORMULÁRIO FINANCEIRO =====
function alternarFormularioFinanceiro() {
  if (!auth.currentUser) {
    mostrarNotificacao('Você precisa estar logado para adicionar gastos', 'error');
    return;
  }
  
  const form = document.getElementById("formularioFinanceiro");
  form.style.display = form.style.display === "none" ? "block" : "none";
  resetarFormularioFinanceiro();
}

// ===== MOSTRAR CAMPOS DE PARCELAS =====
function mostrarCamposParcelas() {
  const camposParcelas = document.getElementById("camposParcelas");
  const parcelado = document.getElementById("parceladoFin").checked;
  camposParcelas.style.display = parcelado ? "block" : "none";
}

// ===== ADICIONAR OU EDITAR GASTO =====
async function adicionarFinanceiro() {
  if (!auth.currentUser) {
    mostrarNotificacao('Você precisa estar logado para adicionar gastos', 'error');
    return;
  }

  const data = dataFin.value;
  const produto = produtoFin.value.trim();
  const descricao = descricaoFin.value.trim();
  const valor = parseFloat(valorFin.value);
  const tipo = tipoFin.value;
  const parcelado = parceladoFin.checked;
  const numParcelas = parcelado ? parseInt(parcelasFin.value) || 1 : 1;

  if (!data || !produto || isNaN(valor) || valor <= 0) {
    mostrarNotificacao("Preencha todos os campos corretamente!", 'error');
    return;
  }

  try {
    const novoGasto = { 
      data, 
      produto, 
      descricao, 
      valor, 
      tipo, 
      parcelado, 
      parcelas: numParcelas,
      usuario: auth.currentUser.uid,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    if (indiceEdicaoGasto !== null) {
      gastos[indiceEdicaoGasto] = novoGasto;
      indiceEdicaoGasto = null;
    } else {
      gastos.push(novoGasto);
    }

    if (navigator.onLine) {
      await db.ref("Financeiro").set(gastos);
    } else {
      await saveDataOffline('financeiro', gastos);
      mostrarNotificacao('Gasto salvo localmente. Será sincronizado quando online.', 'info');
    }

    atualizarFinanceiro();
    resetarFormularioFinanceiro();
    alternarFormularioFinanceiro();
  } catch (error) {
    console.error('Erro ao salvar gasto:', error);
    mostrarNotificacao('Erro ao salvar gasto: ' + error.message, 'error');
  }
}

// ===== CANCELAR EDIÇÃO =====
function cancelarEdicaoFinanceiro() {
  resetarFormularioFinanceiro();
  alternarFormularioFinanceiro();
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
  mostrarCamposParcelas();
  indiceEdicaoGasto = null;
  document.getElementById("btnCancelarFinanceiro").style.display = "none";
  document.getElementById("btnSalvarFinanceiro").innerText = "Salvar Gasto";
}

// ===== ATUALIZAR LISTAGEM DE GASTOS =====
function atualizarFinanceiro() {
  const lista = document.getElementById("financeiroLista");
  lista.innerHTML = '';

  // Ordenar por data (mais recente primeiro)
  const gastosOrdenados = [...gastos].sort((a, b) => 
    new Date(b.data) - new Date(a.data)
  );

  gastosOrdenados.forEach((gasto, i) => {
    const item = document.createElement("div");
    item.className = "item";
    
    const valorTotal = gasto.parcelado ? (gasto.valor * gasto.parcelas).toFixed(2) : gasto.valor.toFixed(2);
    const infoParcelas = gasto.parcelado ? ` (${gasto.parcelas}x R$ ${(gasto.valor).toFixed(2)})` : '';
    
    item.innerHTML = `
      <span>${gasto.data} - ${gasto.produto} - R$ ${valorTotal}${infoParcelas} (${gasto.tipo})</span>
      <div class="botoes-financeiro">
        <button class="botao-circular azul" onclick="editarFinanceiro(${i})"><i class="fas fa-edit"></i></button>
        <button class="botao-circular vermelho" onclick="excluirFinanceiro(${i})"><i class="fas fa-trash"></i></button>
      </div>
    `;
    lista.appendChild(item);
  });
}

// ===== EDITAR GASTO =====
function editarFinanceiro(index) {
  if (!auth.currentUser) {
    mostrarNotificacao('Você precisa estar logado para editar gastos', 'error');
    return;
  }

  const gasto = gastos[index];
  if (!gasto) return;

  dataFin.value = gasto.data;
  produtoFin.value = gasto.produto;
  descricaoFin.value = gasto.descricao || "";
  valorFin.value = gasto.valor;
  tipoFin.value = gasto.tipo;
  parceladoFin.checked = gasto.parcelado;
  mostrarCamposParcelas();
  parcelasFin.value = gasto.parcelas || "";

  indiceEdicaoGasto = index;
  document.getElementById("btnCancelarFinanceiro").style.display = "inline-block";
  document.getElementById("btnSalvarFinanceiro").innerText = "Salvar Edição";
  document.getElementById("formularioFinanceiro").style.display = "block";
}

// ===== EXCLUIR GASTO =====
async function excluirFinanceiro(index) {
  if (!confirm("Deseja excluir este lançamento financeiro?")) return;
  
  try {
    gastos.splice(index, 1);
    
    if (navigator.onLine) {
      await db.ref("Financeiro").set(gastos);
    } else {
      await saveDataOffline('financeiro', gastos);
      mostrarNotificacao('Exclusão salva localmente. Será sincronizada quando online.', 'info');
    }
    
    atualizarFinanceiro();
  } catch (error) {
    console.error('Erro ao excluir gasto:', error);
    mostrarNotificacao('Erro ao excluir gasto: ' + error.message, 'error');
  }
}

// ===== CARREGAR FINANCEIRO =====
function carregarFinanceiro() {
  inicializarFinanceiro();
}

// ===== INICIALIZAR FINANCEIRO =====
document.addEventListener("dadosCarregados", carregarFinanceiro);

// Exportar funções para uso no HTML
window.alternarFormularioFinanceiro = alternarFormularioFinanceiro;
window.mostrarCamposParcelas = mostrarCamposParcelas;
window.adicionarFinanceiro = adicionarFinanceiro;
window.editarFinanceiro = editarFinanceiro;
window.excluirFinanceiro = excluirFinanceiro;
window.cancelarEdicaoFinanceiro = cancelarEdicaoFinanceiro;
