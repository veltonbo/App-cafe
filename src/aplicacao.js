// ===== VARIÁVEIS GLOBAIS =====
window.aplicacoes = window.aplicacoes || [];
let indiceEdicaoAplicacao = null;

// ===== MODAL DE FORMULÁRIO =====
function abrirModalAplicacao(editar = false) {
  document.getElementById('modalAplicacaoBg').style.display = 'flex';
  document.getElementById('btnFlutuanteAddApp').style.display = 'none';
  if (!editar) limparCamposAplicacao();
}
function fecharModalAplicacao() {
  document.getElementById('modalAplicacaoBg').style.display = 'none';
  document.getElementById('btnFlutuanteAddApp').style.display = 'block';
  limparCamposAplicacao();
  indiceEdicaoAplicacao = null;
  if (document.getElementById('btnSalvarAplicacao')) document.getElementById('btnSalvarAplicacao').innerText = 'Salvar Aplicação';
  // Só tenta esconder o botão de cancelar se ele existir
  var btnCancelar = document.getElementById('btnCancelarEdicaoApp');
  if (btnCancelar) btnCancelar.style.display = 'none';
}

// ===== SALVAR OU EDITAR APLICAÇÃO =====
function salvarOuEditarAplicacao() {
  const nova = {
    data: document.getElementById("dataApp").value,
    produto: document.getElementById("produtoApp").value.trim(),
    dosagem: document.getElementById("dosagemApp").value.trim(),
    tipo: document.getElementById("tipoApp").value,
    setor: document.getElementById("setorApp").value
  };

  // NOVO: Só cria tarefa de reaplicação se o toggle estiver ativado
  const toggleReaplicacao = document.getElementById("toggleReaplicacaoApp");
  if (toggleReaplicacao && toggleReaplicacao.checked) {
    const dataReaplicacao = document.getElementById("dataReaplicacaoApp") ? document.getElementById("dataReaplicacaoApp").value : '';
    const prioridadeReaplicacao = document.getElementById("prioridadeReaplicacaoApp") ? document.getElementById("prioridadeReaplicacaoApp").value : 'Alta';
    if (dataReaplicacao) {
      adicionarTarefaReaplicacao({
        data: dataReaplicacao,
        descricao: `Reaplicar ${nova.produto} (${nova.tipo}) - Dosagem: ${nova.dosagem}`,
        prioridade: prioridadeReaplicacao,
        setor: nova.setor
      });
    }
  }

  if (!nova.data || !nova.produto || !nova.dosagem || isNaN(parseFloat(nova.dosagem))) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  if (indiceEdicaoAplicacao !== null) {
    aplicacoes[indiceEdicaoAplicacao] = nova;
    indiceEdicaoAplicacao = null;
  } else {
    aplicacoes.push(nova);
  }

  db.ref('Aplicacoes').set(aplicacoes.reduce((acc, app, index) => {
    acc[index] = app;
    return acc;
  }, {}));

  atualizarAplicacoes();
  fecharModalAplicacao();
}

// Função auxiliar para criar tarefa de reaplicação
function adicionarTarefaReaplicacao({data, descricao, prioridade, setor}) {
  db.ref('Tarefas').once('value').then(snapshot => {
    let tarefas = snapshot.exists() ? Object.values(snapshot.val()) : [];
    tarefas.push({
      data,
      descricao,
      prioridade: prioridade || 'Alta',
      setor: setor || 'Setor 01',
      feita: false,
      eAplicacao: false,
      dosagem: '',
      tipo: ''
    });
    db.ref('Tarefas').set(tarefas);
  });
}

// ===== CANCELAR EDIÇÃO =====
function cancelarEdicaoAplicacao() {
  fecharModalAplicacao();
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

  // Agrupa aplicações por mês/ano
  const grupos = {};
  (window.aplicacoes || []).forEach((app, i) => {
    if (!app.data) return;
    const [ano, mes] = app.data.split('-');
    const chave = `${ano}-${mes}`;
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push({ ...app, _index: i });
  });

  // Ordena os grupos do mais recente para o mais antigo
  const chavesOrdenadas = Object.keys(grupos).sort((a, b) => b.localeCompare(a));

  chavesOrdenadas.forEach(chave => {
    const [ano, mes] = chave.split('-');
    const nomeMes = obterNomeMes(mes);
    // Título do mês
    const titulo = document.createElement('h3');
    titulo.innerText = `${nomeMes} ${ano}`;
    lista.appendChild(titulo);

    // Ordena aplicações do mês por data decrescente
    grupos[chave].sort((a, b) => b.data.localeCompare(a.data));
    grupos[chave].forEach(app => {
      const i = app._index;
      const item = document.createElement('div');
      item.className = 'item';
      item.innerHTML = `
        <span>${formatarDataBR(app.data)} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}</span>
        <div class="opcoes-wrapper">
          <button class="seta-menu-opcoes-padrao" aria-label="Abrir opções">&#8250;</button>
          <ul class="menu-opcoes-padrao-lista" style="display:none;">
            <li class='opcao-menu-padrao' data-acao='editar'>Editar</li>
            <li class='opcao-menu-padrao' data-acao='deletar'>Deletar</li>
          </ul>
        </div>
      `;
      const opcoesWrapper = item.querySelector('.opcoes-wrapper');
      const seta = opcoesWrapper.querySelector('.seta-menu-opcoes-padrao');
      const menu = opcoesWrapper.querySelector('.menu-opcoes-padrao-lista');
      if (seta && menu) {
        seta.onclick = (e) => {
          e.stopPropagation();
          document.querySelectorAll('.menu-opcoes-padrao-lista').forEach(m => {
            if (m !== menu) {
              m.classList.remove('aberta');
              m.style.display = '';
            }
          });
          const aberto = menu.classList.contains('aberta');
          if (aberto) {
            menu.classList.remove('aberta');
            menu.style.display = '';
            seta.setAttribute('aria-expanded', 'false');
          } else {
            menu.classList.add('aberta');
            menu.style.display = 'block';
            seta.setAttribute('aria-expanded', 'true');
          }
        };
        // PADRÃO: clique nas opções do menu
        menu.querySelectorAll('.opcao-menu-padrao').forEach(opcao => {
          opcao.onclick = (e) => {
            e.stopPropagation();
            menu.classList.remove('aberta');
            menu.style.display = '';
            seta.setAttribute('aria-expanded', 'false');
            if (opcao.dataset.acao === 'editar') editarAplicacao(i);
            if (opcao.dataset.acao === 'deletar') excluirAplicacao(i);
          };
        });
        document.addEventListener('click', function fecharMenu(e) {
          if (!item.contains(e.target)) {
            menu.classList.remove('aberta');
            menu.style.display = '';
            seta.setAttribute('aria-expanded', 'false');
          }
        }, { once: true });
      }
      lista.appendChild(item);
    });
  });

  // Garante que o botão de filtro sempre aparece após atualizar a lista
  if (typeof criarBotaoFiltroLista === 'function') {
    criarBotaoFiltroLista('listaAplicacoes');
  }
}

// Função auxiliar para obter nome do mês
function obterNomeMes(mes) {
  const nomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const idx = parseInt(mes, 10) - 1;
  return nomes[idx] || mes;
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
  abrirModalAplicacao(true);
}

// ===== EXCLUIR APLICAÇÃO =====
function excluirAplicacao(index) {
  if (!confirm("Deseja excluir esta aplicação?")) return;
  aplicacoes.splice(index, 1);
  db.ref('Aplicacoes').set(aplicacoes.reduce((acc, app, idx) => {
    acc[idx] = app;
    return acc;
  }, {}));
  atualizarAplicacoes();
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

// ===== FORMATAÇÃO =====
function formatarValorBR(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatarDataBR(dataISO) {
  if (!dataISO) return '';
  const [ano, mes, dia] = dataISO.split('-');
  if (!ano || !mes || !dia) return dataISO;
  return `${dia}/${mes}/${ano}`;
}

// ===== INICIALIZAR APLICAÇÕES =====
document.addEventListener("dadosCarregados", carregarAplicacoes);

function carregarAplicacoes() {
  db.ref('Aplicacoes').on('value', (snapshot) => {
    const dados = snapshot.exists() ? Object.values(snapshot.val()) : [];
    if (JSON.stringify(window.aplicacoes) !== JSON.stringify(dados)) {
      window.aplicacoes = dados;
    }
    atualizarAplicacoes();
  });
}

// Atualiza selects de setor ao carregar setores dinâmicos
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function() {
    if (typeof atualizarSelectsSetor === 'function') atualizarSelectsSetor();
  });
}
