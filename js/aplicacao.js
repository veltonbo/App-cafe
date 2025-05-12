// ===== IMPORTAÇÕES =====
import { db, auth } from './firebase-config.js';
import { saveDataOffline, loadDataOffline } from './offline-db.js';

// ===== VARIÁVEIS GLOBAIS =====
let aplicacoes = [];
let indiceEdicaoAplicacao = null;

// ===== CARREGAR APLICAÇÕES =====
async function carregarAplicacoes() {
  try {
    if (navigator.onLine) {
      db.ref('Aplicacoes').on('value', (snapshot) => {
        const dados = snapshot.val();
        if (dados && typeof dados === "object") {
          aplicacoes = Object.values(dados).map(app => ({
            data: app.data || '',
            produto: app.produto || '',
            dosagem: app.dosagem || '',
            tipo: app.tipo || 'Adubo',
            setor: app.setor || 'Setor 01'
          }));
        } else {
          aplicacoes = [];
        }
        atualizarAplicacoes();
        atualizarSugestoesProdutoApp();
        
        // Salvar offline
        if (aplicacoes.length > 0) {
          saveDataOffline('aplicacoes', aplicacoes).catch(console.error);
        }
      });
    } else {
      // Modo offline
      const dados = await loadDataOffline('aplicacoes');
      aplicacoes = dados || [];
      atualizarAplicacoes();
      atualizarSugestoesProdutoApp();
      mostrarNotificacao('Você está visualizando dados offline das aplicações');
    }
  } catch (error) {
    console.error('Erro ao carregar aplicações:', error);
    mostrarNotificacao('Erro ao carregar aplicações', 'error');
  }
}

// ===== ADICIONAR OU EDITAR APLICAÇÃO =====
async function adicionarAplicacao() {
  if (!auth.currentUser) {
    mostrarNotificacao('Você precisa estar logado para adicionar aplicações', 'error');
    return;
  }

  const nova = {
    data: document.getElementById("dataApp").value,
    produto: document.getElementById("produtoApp").value.trim(),
    dosagem: document.getElementById("dosagemApp").value.trim(),
    tipo: document.getElementById("tipoApp").value,
    setor: document.getElementById("setorApp").value,
    usuario: auth.currentUser.uid,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  };

  if (!nova.data || !nova.produto || !nova.dosagem || isNaN(parseFloat(nova.dosagem))) {
    mostrarNotificacao("Preencha todos os campos corretamente.", 'error');
    return;
  }

  try {
    if (indiceEdicaoAplicacao !== null) {
      aplicacoes[indiceEdicaoAplicacao] = nova;
      indiceEdicaoAplicacao = null;
      document.getElementById("btnCancelarEdicaoApp").style.display = "none";
      document.getElementById("btnSalvarAplicacao").innerText = "Salvar Aplicação";
    } else {
      aplicacoes.push(nova);
    }

    if (navigator.onLine) {
      await db.ref('Aplicacoes').set(aplicacoes);
    } else {
      await saveDataOffline('aplicacoes', aplicacoes);
      mostrarNotificacao('Aplicação salva localmente. Será sincronizada quando online.', 'info');
    }

    atualizarAplicacoes();
    limparCamposAplicacao();
  } catch (error) {
    console.error('Erro ao salvar aplicação:', error);
    mostrarNotificacao('Erro ao salvar aplicação: ' + error.message, 'error');
  }
}

// ===== CANCELAR EDIÇÃO =====
function cancelarEdicaoAplicacao() {
  indiceEdicaoAplicacao = null;
  limparCamposAplicacao();
  document.getElementById("btnCancelarEdicaoApp").style.display = "none";
  document.getElementById("btnSalvarAplicacao").innerText = "Salvar Aplicação";
}

// ===== LIMPAR CAMPOS =====
function limparCamposAplicacao() {
  document.getElementById("dataApp").value = '';
  document.getElementById("produtoApp").value = '';
  document.getElementById("dosagemApp").value = '';
  document.getElementById("tipoApp").value = 'Adubo';
  document.getElementById("setorApp").value = 'Setor 01';
}

// ===== ATUALIZAR LISTAGEM =====
function atualizarAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  if (!lista) return;
  lista.innerHTML = '';

  // Ordenar por data (mais recente primeiro)
  const aplicacoesOrdenadas = [...aplicacoes].sort((a, b) => 
    new Date(b.data) - new Date(a.data)
  );

  aplicacoesOrdenadas.forEach((app, i) => {
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `
      <span>${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}</span>
      <div class="botoes-aplicacao">
        <button class="botao-circular azul" onclick="editarAplicacao(${i})">
          <i class="fas fa-edit"></i>
        </button>
        <button class="botao-circular vermelho" onclick="excluirAplicacao(${i})">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    lista.appendChild(item);
  });
}

// ===== EDITAR APLICAÇÃO =====
function editarAplicacao(index) {
  const app = aplicacoes[index];
  if (!app) return;

  document.getElementById("dataApp").value = app.data;
  document.getElementById("produtoApp").value = app.produto;
  document.getElementById("dosagemApp").value = app.dosagem;
  document.getElementById("tipoApp").value = app.tipo;
  document.getElementById("setorApp").value = app.setor;

  indiceEdicaoAplicacao = index;
  document.getElementById("btnSalvarAplicacao").innerText = "Salvar Edição";
  document.getElementById("btnCancelarEdicaoApp").style.display = "inline-block";
}

// ===== EXCLUIR APLICAÇÃO =====
async function excluirAplicacao(index) {
  if (!confirm("Deseja excluir esta aplicação?")) return;
  
  try {
    aplicacoes.splice(index, 1);
    
    if (navigator.onLine) {
      await db.ref('Aplicacoes').set(aplicacoes);
    } else {
      await saveDataOffline('aplicacoes', aplicacoes);
      mostrarNotificacao('Exclusão salva localmente. Será sincronizada quando online.', 'info');
    }
    
    atualizarAplicacoes();
  } catch (error) {
    console.error('Erro ao excluir aplicação:', error);
    mostrarNotificacao('Erro ao excluir aplicação: ' + error.message, 'error');
  }
}

// ===== SUGESTÕES DE PRODUTO =====
function atualizarSugestoesProdutoApp() {
  const lista = document.getElementById("sugestoesProdutoApp");
  const produtosUnicos = [...new Set(aplicacoes.map(a => a.produto))];
  lista.innerHTML = produtosUnicos.map(p => `<option value="${p}">`).join('');
}

// ===== EXPORTAR CSV DE APLICAÇÕES =====
function exportarAplicacoesCSV() {
  let csv = "Data,Produto,Dosagem,Tipo,Setor\n";
  aplicacoes.forEach(app => {
    csv += `${app.data},${app.produto},${app.dosagem},${app.tipo},${app.setor}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aplicacoes_manejo_cafe_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
}

// ===== INICIALIZAR APLICAÇÕES =====
document.addEventListener("dadosCarregados", carregarAplicacoes);

// Exportar funções para uso no HTML
window.adicionarAplicacao = adicionarAplicacao;
window.editarAplicacao = editarAplicacao;
window.excluirAplicacao = excluirAplicacao;
window.cancelarEdicaoAplicacao = cancelarEdicaoAplicacao;
window.exportarAplicacoesCSV = exportarAplicacoesCSV;
