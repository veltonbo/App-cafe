// ===== Firebase Config =====
const firebaseConfig = {
  apiKey: "AIzaSyD773S1h91tovlKTPbaeAZbN2o1yxROcOc",
  authDomain: "manej-cafe.firebaseapp.com",
  databaseURL: "https://manej-cafe-default-rtdb.firebaseio.com",
  projectId: "manej-cafe",
  storageBucket: "manej-cafe.appspot.com",
  messagingSenderId: "808931200634",
  appId: "1:808931200634:web:71357af2ff0dc2e4f5f5c3"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ===== Dados globais =====
const aplicacoes = [];
const tarefas = [];
const tarefasFeitas = [];
const gastos = [];
const colheita = [];

let valorLataGlobal = 0;
let colhedorAtual = '';
let graficoGastosChart = null;
let gastoAtualIndex = null;
let parcelaParaExcluir = null;

// ===== Inicialização da interface =====
window.onload = () => {
  mostrarAba(localStorage.getItem('aba') || 'aplicacoes');
  if (localStorage.getItem('tema') === 'claro') {
    document.body.classList.add('claro');
  }

  carregarAplicacoes();
  carregarTarefas();
  carregarFinanceiro();
  carregarColheita();
  carregarValorLata();
  carregarAnoSafra();
  carregarSafrasDisponiveis();
};

// ===== Controle de abas =====
function mostrarAba(abaId) {
  document.querySelectorAll('.aba').forEach(aba => aba.classList.remove('active'));
  document.getElementById(abaId).classList.add('active');

  document.querySelectorAll('.menu-superior button').forEach(btn => btn.classList.remove('active'));
  const btn = document.getElementById('btn-' + abaId);
  if (btn) btn.classList.add('active');

  localStorage.setItem('aba', abaId);
}

// ===== Tema claro/escuro =====
function alternarTema() {
  document.body.classList.toggle('claro');
  localStorage.setItem('tema', document.body.classList.contains('claro') ? 'claro' : 'escuro');
}

// ===== Aplicações =====

function adicionarAplicacao() {
  const data = document.getElementById("dataApp").value;
  const produto = document.getElementById("produtoApp").value.trim();
  const dosagem = document.getElementById("dosagemApp").value.trim();
  const tipo = document.getElementById("tipoApp").value;
  const setor = document.getElementById("setorApp").value;

  if (!data || !produto || !dosagem) {
    alert("Preencha todos os campos da aplicação!");
    return;
  }

  const nova = { data, produto, dosagem, tipo, setor };
  aplicacoes.push(nova);
  db.ref('Aplicacoes').set(aplicacoes).then(() => {
    atualizarAplicacoes();
  });
}

function atualizarAplicacoes() {
  const filtro = document.getElementById("pesquisaAplicacoes").value.toLowerCase();
  const filtroSetor = document.getElementById("filtroSetorAplicacoes").value;
  const container = document.getElementById("listaAplicacoes");
  container.innerHTML = "";

  const agrupado = {};

  aplicacoes.forEach((a, i) => {
    const texto = `${a.data} ${a.produto} ${a.dosagem} ${a.tipo} ${a.setor}`.toLowerCase();
    if (texto.includes(filtro) && (filtroSetor === "" || a.setor === filtroSetor)) {
      if (!agrupado[a.data]) agrupado[a.data] = [];
      agrupado[a.data].push({ ...a, i });
    }
  });

  Object.keys(agrupado).forEach(data => {
    const titulo = document.createElement("div");
    titulo.className = "grupo-data";
    titulo.textContent = data;
    container.appendChild(titulo);

    agrupado[data].forEach(({ produto, dosagem, tipo, setor, i }) => {
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `
        <span>${produto} (${dosagem}) - ${tipo} - ${setor}</span>
        <div class="botoes-financeiro">
          <button class="botao-excluir" onclick="excluirAplicacao(${i})"><i class="fas fa-trash-alt"></i></button>
        </div>
      `;
      container.appendChild(div);
    });
  });
}

function excluirAplicacao(index) {
  aplicacoes.splice(index, 1);
  db.ref('Aplicacoes').set(aplicacoes).then(() => {
    atualizarAplicacoes();
  });
}

function carregarAplicacoes() {
  db.ref('Aplicacoes').on('value', snap => {
    if (snap.exists()) {
      aplicacoes.length = 0;
      aplicacoes.push(...snap.val());
    }
    atualizarAplicacoes();
  });
}

function mostrarCamposAplicacao() {
  const campos = document.getElementById("camposAplicacao");
  campos.style.display = document.getElementById("eAplicacaoCheckbox").checked ? "block" : "none";
}

function adicionarTarefa() {
  const nova = {
    data: document.getElementById("dataTarefa").value,
    descricao: document.getElementById("descricaoTarefa").value,
    prioridade: document.getElementById("prioridadeTarefa").value,
    setor: document.getElementById("setorTarefa").value,
    executada: false,
    eAplicacao: document.getElementById("eAplicacaoCheckbox").checked,
    dosagem: document.getElementById("dosagemAplicacao").value,
    tipoAplicacao: document.getElementById("tipoAplicacao").value
  };

  if (!nova.data || !nova.descricao) {
    alert("Preencha todos os campos obrigatórios!");
    return;
  }

  tarefas.push(nova);
  salvarTarefas();
  atualizarTarefas();
}

function salvarTarefas() {
  db.ref('Tarefas').set([...tarefas, ...tarefasFeitas]);
}

function marcarTarefa(index, marcado) {
  const tarefa = tarefas.splice(index, 1)[0];
  tarefa.executada = true;
  tarefasFeitas.push(tarefa);
  salvarTarefas();
  atualizarTarefas();

  if (tarefa.eAplicacao) {
    const novaAplicacao = {
      data: tarefa.data,
      produto: tarefa.descricao,
      dosagem: tarefa.dosagem,
      tipo: tarefa.tipoAplicacao,
      setor: tarefa.setor
    };
    aplicacoes.push(novaAplicacao);
    db.ref('Aplicacoes').set(aplicacoes).then(() => {
      atualizarAplicacoes();
    });
  }
}

function desfazerTarefa(index) {
  const tarefa = tarefasFeitas.splice(index, 1)[0];
  tarefa.executada = false;
  tarefas.push(tarefa);

  if (tarefa.eAplicacao) {
    const idx = aplicacoes.findIndex(app =>
      app.data === tarefa.data &&
      app.produto === tarefa.descricao &&
      app.setor === tarefa.setor
    );
    if (idx > -1) {
      aplicacoes.splice(idx, 1);
      db.ref('Aplicacoes').set(aplicacoes).then(() => {
        atualizarAplicacoes();
      });
    }
  }

  salvarTarefas();
  atualizarTarefas();
}

function atualizarTarefas() {
  const listaAFazer = document.getElementById("listaTarefas");
  const listaExecutadas = document.getElementById("listaTarefasFeitas");
  const filtro = document.getElementById("pesquisaTarefas").value.toLowerCase();
  const setorFiltro = document.getElementById("filtroSetorTarefas").value;

  listaAFazer.innerHTML = "";
  listaExecutadas.innerHTML = "";

  tarefas.forEach((t, i) => {
    if (
      (setorFiltro && t.setor !== setorFiltro) ||
      (filtro && !t.descricao.toLowerCase().includes(filtro))
    ) return;

    const div = document.createElement("div");
    div.className = "item";
    const cor = t.prioridade === "Alta" ? "#f44336" :
                t.prioridade === "Média" ? "#ff9800" : "#4caf50";

    div.innerHTML = `
      <span style="color:${cor}">${t.data} - ${t.descricao} (${t.prioridade}) - ${t.setor}</span>
      <div class="botoes-financeiro">
        <button onclick="marcarTarefa(${i})" style="background-color: #4caf50;">
          <i class="fas fa-check"></i>
        </button>
        <button onclick="excluirTarefa(${i}, false)" class="botao-excluir">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    listaAFazer.appendChild(div);
  });

  tarefasFeitas.forEach((t, i) => {
    if (
      (setorFiltro && t.setor !== setorFiltro) ||
      (filtro && !t.descricao.toLowerCase().includes(filtro))
    ) return;

    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <span>${t.data} - ${t.descricao} (${t.prioridade}) - ${t.setor}</span>
      <div class="botoes-financeiro">
        <button onclick="desfazerTarefa(${i})" style="background-color: #ff9800;">
          <i class="fas fa-undo"></i>
        </button>
        <button onclick="excluirTarefa(${i}, true)" class="botao-excluir">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    listaExecutadas.appendChild(div);
  });
}

function excluirTarefa(index, feita) {
  if (feita) {
    tarefasFeitas.splice(index, 1);
  } else {
    tarefas.splice(index, 1);
  }
  salvarTarefas();
  atualizarTarefas();
}

function carregarTarefas() {
  db.ref("Tarefas").once("value").then(snapshot => {
    if (snapshot.exists()) {
      tarefas.length = 0;
      tarefasFeitas.length = 0;
      snapshot.val().forEach(t => {
        (t.executada ? tarefasFeitas : tarefas).push(t);
      });
      atualizarTarefas();
    }
  });
}

function marcarTarefa(index) {
  const tarefa = tarefas[index];
  tarefa.executada = true;
  tarefas.splice(index, 1);
  tarefasFeitas.push(tarefa);

  if (tarefa.eAplicacao) {
    const novaAplicacao = {
      data: tarefa.data,
      produto: tarefa.descricao,
      dosagem: tarefa.dosagem,
      tipo: tarefa.tipoAplicacao,
      setor: tarefa.setor
    };
    aplicacoes.push(novaAplicacao);
    db.ref("Aplicacoes").set(aplicacoes);
  }

  salvarTarefas();
  atualizarTarefas();
  atualizarAplicacoes();
}

function desfazerTarefa(index) {
  const tarefa = tarefasFeitas[index];
  tarefa.executada = false;
  tarefasFeitas.splice(index, 1);
  tarefas.push(tarefa);

  if (tarefa.eAplicacao) {
    // Remove a aplicação correspondente
    const indexRemover = aplicacoes.findIndex(a =>
      a.data === tarefa.data &&
      a.produto === tarefa.descricao &&
      a.setor === tarefa.setor
    );
    if (indexRemover >= 0) {
      aplicacoes.splice(indexRemover, 1);
      db.ref("Aplicacoes").set(aplicacoes);
    }
  }

  salvarTarefas();
  atualizarTarefas();
  atualizarAplicacoes();
}

function atualizarTarefas() {
  listaTarefas.innerHTML = "";
  listaTarefasFeitas.innerHTML = "";

  const filtro = pesquisaTarefas.value.toLowerCase();
  const setorFiltro = filtroSetorTarefas.value;

  tarefas.forEach((t, i) => {
    if (
      (!t.data || !t.descricao) ||
      (!t.descricao.toLowerCase().includes(filtro) && !t.setor.toLowerCase().includes(filtro)) ||
      (setorFiltro && t.setor !== setorFiltro)
    ) return;

    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <span>${t.data} - ${t.descricao} (${t.prioridade}) - ${t.setor}</span>
      <div class="botoes-financeiro">
        <button class="botao-executar" onclick="marcarTarefa(${i})">
          <i class="fas fa-check"></i>
        </button>
        <button class="botao-excluir" onclick="excluirTarefa(${i}, false)">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    listaTarefas.appendChild(div);
  });

  tarefasFeitas.forEach((t, i) => {
    if (
      (!t.descricao.toLowerCase().includes(filtro) && !t.setor.toLowerCase().includes(filtro)) ||
      (setorFiltro && t.setor !== setorFiltro)
    ) return;

    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <span>${t.data} - ${t.descricao} (${t.prioridade}) - ${t.setor}</span>
      <div class="botoes-financeiro">
        <button class="botao-desfazer" onclick="desfazerTarefa(${i})">
          <i class="fas fa-undo"></i>
        </button>
        <button class="botao-excluir" onclick="excluirTarefa(${i}, true)">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    listaTarefasFeitas.appendChild(div);
  });
}

function marcarTarefa(index) {
  const tarefa = tarefas[index];
  if (!tarefa) return;

  tarefas.splice(index, 1);
  tarefa.executada = true;
  tarefasFeitas.push(tarefa);
  salvarTarefas();

  if (tarefa.eAplicacao) {
    const novaAplicacao = {
      data: tarefa.data,
      produto: tarefa.descricao,
      dosagem: tarefa.dosagem || '',
      tipo: tarefa.tipoAplicacao || '',
      setor: tarefa.setor || ''
    };
    aplicacoes.push(novaAplicacao);
    db.ref('Aplicacoes').set(aplicacoes);
  }

  atualizarTarefas();
  atualizarAplicacoes();
}

function desfazerTarefa(index) {
  const tarefa = tarefasFeitas[index];
  if (!tarefa) return;

  tarefasFeitas.splice(index, 1);
  tarefa.executada = false;
  tarefas.push(tarefa);
  salvarTarefas();

  // Remove aplicação associada
  if (tarefa.eAplicacao) {
    const idx = aplicacoes.findIndex(app =>
      app.data === tarefa.data &&
      app.produto === tarefa.descricao &&
      app.setor === tarefa.setor
    );
    if (idx >= 0) {
      aplicacoes.splice(idx, 1);
      db.ref("Aplicacoes").set(aplicacoes);
    }
  }

  atualizarTarefas();
  atualizarAplicacoes();
}

function excluirTarefa(index, feita) {
  if (feita) {
    tarefasFeitas.splice(index, 1);
  } else {
    tarefas.splice(index, 1);
  }
  salvarTarefas();
  atualizarTarefas();
}

function atualizarTarefas() {
  const filtro = pesquisaTarefas.value.toLowerCase();
  const filtroSetor = filtroSetorTarefas.value;
  listaTarefas.innerHTML = '';
  listaTarefasFeitas.innerHTML = '';

  tarefas.forEach((t, i) => {
    if (
      (`${t.data} ${t.descricao} ${t.setor}`.toLowerCase().includes(filtro)) &&
      (filtroSetor === '' || t.setor === filtroSetor)
    ) {
      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML = `
        <span>${t.data} - ${t.descricao} (${t.prioridade}) - ${t.setor}</span>
        <div class="botoes-financeiro">
          <button onclick="marcarTarefa(${i})" style="background:#4caf50;"><i class="fas fa-check"></i></button>
          <button class="botao-excluir" onclick="excluirTarefa(${i}, false)"><i class="fas fa-trash"></i></button>
        </div>
      `;
      listaTarefas.appendChild(div);
    }
  });

  tarefasFeitas.forEach((t, i) => {
    if (
      (`${t.data} ${t.descricao} ${t.setor}`.toLowerCase().includes(filtro)) &&
      (filtroSetor === '' || t.setor === filtroSetor)
    ) {
      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML = `
        <span>${t.data} - ${t.descricao} (${t.prioridade}) - ${t.setor}</span>
        <div class="botoes-financeiro">
          <button onclick="desfazerTarefa(${i})" style="background:#ff9800;"><i class="fas fa-undo"></i></button>
          <button class="botao-excluir" onclick="excluirTarefa(${i}, true)"><i class="fas fa-trash"></i></button>
        </div>
      `;
      listaTarefasFeitas.appendChild(div);
    }
  });
}

function marcarTarefa(index) {
  const tarefa = tarefas[index];
  tarefas.splice(index, 1);
  tarefa.executada = true;
  tarefasFeitas.push(tarefa);

  if (tarefa.eAplicacao) {
    const novaAplicacao = {
      data: tarefa.data,
      produto: tarefa.descricao,
      dosagem: tarefa.dosagem,
      tipo: tarefa.tipoAplicacao,
      setor: tarefa.setor
    };
    aplicacoes.push(novaAplicacao);
    db.ref('Aplicacoes').set(aplicacoes);
    atualizarAplicacoes();
  }

  salvarTarefas();
  atualizarTarefas();
}

function desfazerTarefa(index) {
  const tarefa = tarefasFeitas[index];
  tarefasFeitas.splice(index, 1);
  tarefa.executada = false;
  tarefas.push(tarefa);

  if (tarefa.eAplicacao) {
    // Remove a aplicação correspondente
    const appIndex = aplicacoes.findIndex(a =>
      a.data === tarefa.data &&
      a.produto === tarefa.descricao &&
      a.tipo === tarefa.tipoAplicacao &&
      a.setor === tarefa.setor
    );
    if (appIndex !== -1) {
      aplicacoes.splice(appIndex, 1);
      db.ref('Aplicacoes').set(aplicacoes);
      atualizarAplicacoes();
    }
  }

  salvarTarefas();
  atualizarTarefas();
}

function excluirTarefa(index, feita) {
  const lista = feita ? tarefasFeitas : tarefas;
  const tarefa = lista[index];

  if (feita && tarefa.eAplicacao) {
    const appIndex = aplicacoes.findIndex(a =>
      a.data === tarefa.data &&
      a.produto === tarefa.descricao &&
      a.tipo === tarefa.tipoAplicacao &&
      a.setor === tarefa.setor
    );
    if (appIndex !== -1) {
      aplicacoes.splice(appIndex, 1);
      db.ref('Aplicacoes').set(aplicacoes);
      atualizarAplicacoes();
    }
  }

  lista.splice(index, 1);
  salvarTarefas();
  atualizarTarefas();
}

function salvarTarefas() {
  const todas = [...tarefas, ...tarefasFeitas];
  db.ref('Tarefas').set(todas);
}

function marcarPago(index) {
  if (!gastos[index]) return;
  gastos[index].pago = true;
  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();
}

function desfazerPagamento(index) {
  if (!gastos[index]) return;
  gastos[index].pago = false;

  if (gastos[index].parcelasDetalhes) {
    gastos[index].parcelasDetalhes.forEach(p => p.pago = false);
  }

  db.ref("Financeiro").set(gastos);
  atualizarFinanceiro();
}

function confirmarExclusaoParcela(index, parcelaIndex) {
  indexGastoExcluir = index;
  parcelaParaExcluir = parcelaIndex;
  document.getElementById("modalConfirmarExclusaoParcela").style.display = "flex";
}

function excluirApenasParcela() {
  const gasto = gastos[indexGastoExcluir];
  if (!gasto || !gasto.parcelasDetalhes) return;

  gasto.parcelasDetalhes.splice(parcelaParaExcluir, 1);

  if (gasto.parcelasDetalhes.length === 0) {
    gastos.splice(indexGastoExcluir, 1);
  } else {
    gasto.parcelas = gasto.parcelasDetalhes.length;
    gasto.valor = gasto.parcelasDetalhes.reduce((acc, p) => acc + p.valor, 0);
    gasto.pago = gasto.parcelasDetalhes.every(p => p.pago);
  }

  db.ref("Financeiro").set(gastos);
  fecharModalExcluirParcela();
  atualizarFinanceiro();
}

function excluirTodasParcelas() {
  gastos.splice(indexGastoExcluir, 1);
  db.ref("Financeiro").set(gastos);
  fecharModalExcluirParcela();
  atualizarFinanceiro();
}

function fecharModalExcluirParcela() {
  document.getElementById("modalConfirmarExclusaoParcela").style.display = "none";
  indexGastoExcluir = null;
  parcelaParaExcluir = null;
}

function montarGrupoColheita(grupo, container, pago) {
  for (const nome in grupo) {
    const registros = grupo[nome];
    const totalLatas = registros.reduce((sum, c) => sum + c.quantidade, 0);
    const valorLata = registros[0]?.valorLata || 0;
    const valorTotal = totalLatas * valorLata;

    const bloco = document.createElement('div');
    bloco.className = 'bloco-colhedor';

    const titulo = document.createElement('div');
    titulo.className = 'grupo-data';
    titulo.innerHTML = `<strong>${nome}</strong> - ${totalLatas.toFixed(2)} latas = R$${valorTotal.toFixed(2)}`;
    bloco.appendChild(titulo);

    registros.forEach(({ data, quantidade, valorLata, i }) => {
      const div = document.createElement('div');
      div.className = 'item';
      div.innerHTML = `
        <span>${data} - ${quantidade.toFixed(2)} latas (R$${(quantidade * valorLata).toFixed(2)})</span>
        <div class="botoes-financeiro">
          ${pago
            ? `<button class="botao-excluir" onclick="excluirPagamento(${i})"><i class="fas fa-trash"></i> Excluir Pagamento</button>`
            : `<button class="botao-excluir" onclick="excluirColheita(${i})"><i class="fas fa-trash"></i> Excluir</button>`
          }
        </div>
      `;
      bloco.appendChild(div);
    });

    if (!pago) {
      const botoes = document.createElement('div');
      botoes.className = 'botoes-financeiro';
      botoes.innerHTML = `
        <button onclick="pagarTudoColhedor('${nome}')"><i class="fas fa-check"></i> Pagar Tudo</button>
        <button onclick="pagarParcialColhedor('${nome}')"><i class="fas fa-hand-holding-usd"></i> Pagar Parcial</button>
      `;
      bloco.appendChild(botoes);
    }

    container.appendChild(bloco);
  }
}

// ========== MOSTRAR ABA DE RELATÓRIO ==========
function mostrarRelatorioCompleto(id) {
  document.querySelectorAll('.relatorio-subaba').forEach(div => {
    div.style.display = 'none';
  });

  document.getElementById(id).style.display = 'block';

  // Ativa o botão correspondente
  document.querySelectorAll('#relatorio .menu-superior button').forEach(btn => {
    btn.classList.remove('active');
  });
  const btnAtivo = document.getElementById(`btn-${id}`);
  if (btnAtivo) btnAtivo.classList.add('active');
}

// ========== GERAR RELATÓRIO COMPLETO ==========
function gerarRelatorioCompleto() {
  atualizarRelatorioAplicacoes();
  atualizarRelatorioTarefas();
  atualizarRelatorioFinanceiro();
  atualizarRelatorioColheita();
}

// ========== ATUALIZAÇÃO INICIAL DO RELATÓRIO ==========
document.getElementById("btn-relatorio").addEventListener("click", () => {
  mostrarAba("relatorio");
  gerarRelatorioCompleto();
  mostrarRelatorioCompleto('rel-aplicacoes'); // Mostrar subaba inicial
});

// ========== FUNÇÕES MENU CONFIGURAÇÕES ==========
function carregarAnoSafra() {
  const ano = new Date().getFullYear();
  document.getElementById("anoSafraAtual").innerText = ano;
}

function carregarSafrasDisponiveis() {
  const select = document.getElementById("safraSelecionada");
  select.innerHTML = "<option value=''>Selecione o ano</option>";
  db.ref().once("value").then(snapshot => {
    Object.keys(snapshot.val() || {}).forEach(key => {
      if (!["Aplicacoes", "Tarefas", "Financeiro", "Colheita", "ValorLata"].includes(key)) {
        const option = document.createElement("option");
        option.value = key;
        option.innerText = key;
        select.appendChild(option);
      }
    });
  });
}

function fecharSafraAtual() {
  const ano = new Date().getFullYear();
  if (!confirm(`Deseja fechar a safra ${ano}? Isso arquivará todos os dados atuais.`)) return;

  Promise.all([
    db.ref("Aplicacoes").once("value"),
    db.ref("Tarefas").once("value"),
    db.ref("Financeiro").once("value"),
    db.ref("Colheita").once("value"),
    db.ref("ValorLata").once("value")
  ]).then(([app, tar, fin, col, lata]) => {
    const dados = {
      Aplicacoes: app.val() || [],
      Tarefas: tar.val() || [],
      Financeiro: fin.val() || [],
      Colheita: col.val() || [],
      ValorLata: lata.val() || 0
    };

    db.ref(ano).set(dados).then(() => {
      db.ref("Aplicacoes").remove();
      db.ref("Tarefas").remove();
      db.ref("Financeiro").remove();
      db.ref("Colheita").remove();
      db.ref("ValorLata").remove();
      alert(`Safra ${ano} fechada com sucesso.`);
      location.reload();
    });
  });
}

function restaurarSafra() {
  const safra = document.getElementById("safraSelecionada").value;
  if (!safra) return alert("Selecione uma safra para restaurar.");
  if (!confirm(`Deseja restaurar os dados da safra ${safra}? Isso substituirá os dados atuais.`)) return;

  db.ref(safra).once("value").then(snapshot => {
    const dados = snapshot.val();
    if (!dados) return alert("Dados da safra não encontrados.");

    Promise.all([
      db.ref("Aplicacoes").set(dados.Aplicacoes || []),
      db.ref("Tarefas").set(dados.Tarefas || []),
      db.ref("Financeiro").set(dados.Financeiro || []),
      db.ref("Colheita").set(dados.Colheita || []),
      db.ref("ValorLata").set(dados.ValorLata || 0)
    ]).then(() => {
      alert("Safra restaurada com sucesso!");
      location.reload();
    });
  });
}

function deletarSafra() {
  const safra = document.getElementById("safraSelecionada").value;
  if (!safra) return alert("Selecione uma safra para deletar.");
  if (!confirm(`Deseja excluir permanentemente a safra ${safra}?`)) return;

  db.ref(safra).remove().then(() => {
    alert(`Safra ${safra} deletada.`);
    carregarSafrasDisponiveis();
  });
}

function fazerBackup() {
  const backup = {};
  Promise.all([
    db.ref("Aplicacoes").once("value"),
    db.ref("Tarefas").once("value"),
    db.ref("Financeiro").once("value"),
    db.ref("Colheita").once("value"),
    db.ref("ValorLata").once("value")
  ]).then(([app, tar, fin, col, lata]) => {
    backup.Aplicacoes = app.val() || [];
    backup.Tarefas = tar.val() || [];
    backup.Financeiro = fin.val() || [];
    backup.Colheita = col.val() || [];
    backup.ValorLata = lata.val() || 0;

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup_manejo_cafe_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
  });
}

function importarBackup() {
  const input = document.getElementById("arquivoBackup");
  const file = input.files[0];
  if (!file) return alert("Selecione um arquivo .json.");

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const dados = JSON.parse(e.target.result);
      Promise.all([
        db.ref("Aplicacoes").set(dados.Aplicacoes || []),
        db.ref("Tarefas").set(dados.Tarefas || []),
        db.ref("Financeiro").set(dados.Financeiro || []),
        db.ref("Colheita").set(dados.Colheita || []),
        db.ref("ValorLata").set(dados.ValorLata || 0)
      ]).then(() => {
        alert("Backup importado com sucesso!");
        location.reload();
      });
    } catch {
      alert("Erro ao importar o backup. Verifique se o arquivo é válido.");
    }
  };
  reader.readAsText(file);
}

function carregarFinanceiro() {
  db.ref("Financeiro").once("value").then(snapshot => {
    if (snapshot.exists()) {
      gastos.length = 0;
      gastos.push(...snapshot.val());
      atualizarFinanceiro();
    }
  });
}

function salvarValorLata() {
  const valor = parseFloat(document.getElementById("valorLata").value);
  if (!isNaN(valor)) {
    valorLataGlobal = valor;
    db.ref("ValorLata").set(valor);
  }
}

function mostrarParcelas() {
  const temParcelas = document.getElementById("temParcelas").checked;
  document.getElementById("campoParcelas").style.display = temParcelas ? "block" : "none";
}

function adicionarColheita() {
  const data = document.getElementById("dataColheita").value;
  const quantidade = parseFloat(document.getElementById("quantidadeLatas").value);
  const colhedor = document.getElementById("colhedor").value.trim();
  const valorLata = parseFloat(document.getElementById("valorLata").value);

  if (!data || isNaN(quantidade) || !colhedor || isNaN(valorLata)) {
    alert("Preencha todos os campos da colheita.");
    return;
  }

  const nova = { data, quantidade, colhedor, valorLata, pago: false };
  colheita.push(nova);
  db.ref("Colheita").set(colheita).then(() => {
    atualizarColheita();
  });
}

function atualizarRelatorioAplicacoes() {
  const container = document.getElementById("relatorioAplicacoes");
  container.innerHTML = "";

  if (aplicacoes.length === 0) {
    container.innerHTML = "<p>Nenhuma aplicação registrada.</p>";
    return;
  }

  aplicacoes.forEach(app => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <span>${app.data} - ${app.produto} (${app.dosagem}) - ${app.tipo} - ${app.setor}</span>
    `;
    container.appendChild(div);
  });
}

function carregarColheita() {
  db.ref("Colheita").once("value").then(snapshot => {
    if (snapshot.exists()) {
      colheita.length = 0;
      colheita.push(...snapshot.val());
      atualizarColheita();
    }
  });
}

function atualizarFinanceiro() {
  const containerVencer = document.getElementById("gastosAVencer");
  const containerPago = document.getElementById("gastosPagos");

  containerVencer.innerHTML = "";
  containerPago.innerHTML = "";

  gastos.forEach((gasto, index) => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <span>${gasto.data} - ${gasto.descricao} (${gasto.categoria}) - R$ ${parseFloat(gasto.valor).toFixed(2)}</span>
      <div class="botoes-financeiro">
        ${gasto.pago
          ? `<button onclick="desfazerPagamento(${index})" style="background:#ff9800;"><i class="fas fa-undo"></i></button>`
          : `<button onclick="marcarPago(${index})" style="background:#4caf50;"><i class="fas fa-check"></i></button>`
        }
        <button class="botao-excluir" onclick="confirmarExclusaoParcela(${index}, null)">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    if (gasto.pago) {
      containerPago.appendChild(div);
    } else {
      containerVencer.appendChild(div);
    }
  });
}
