// ===== VARIÁVEIS =====
let aplicacoes = [];
let sugestoesProdutos = [];
let indiceEdicaoAplicacao = null;

// ===== CARREGAR APLICAÇÕES =====
function carregarAplicacoes() {
  db.ref("Aplicacoes").on("value", snap => {
    aplicacoes = snap.exists() ? snap.val() : [];
    atualizarAplicacoes();
    carregarSugestoesProdutos();
  });
}

// ===== ATUALIZAR LISTAGEM =====
function atualizarAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  lista.innerHTML = "";

  const filtroSetor = document.getElementById("filtroSetorAplicacoes").value;
  const termoBusca = document.getElementById("pesquisaAplicacoes").value.toLowerCase();

  const agrupado = {};

  aplicacoes
    .filter(a =>
      (!filtroSetor || a.setor === filtroSetor) &&
      (`${a.produto} ${a.tipo} ${a.setor}`.toLowerCase().includes(termoBusca))
    )
    .sort((a, b) => b.data.localeCompare(a.data))
    .forEach(a => {
      const chave = `${a.setor} | ${a.data}`;
      if (!agrupado[chave]) agrupado[chave] = [];
      agrupado[chave].push(a);
    });

  for (const grupo in agrupado) {
    const header = document.createElement("div");
    header.className = "grupo-data";
    header.innerText = grupo;
    lista.appendChild(header);

    agrupado[grupo].forEach(a => {
      const index = aplicacoes.findIndex(ap =>
        ap.data === a.data &&
        ap.produto === a.produto &&
        ap.setor === a.setor &&
        ap.dosagem === a.dosagem &&
        ap.tipo === a.tipo
      );
      const item = document.createElement("div");
      item.className = "item fade-in";
      item.innerHTML = `
        <span>
          ${a.data} - ${a.produto} (${a.tipo}) - ${a.setor}<br>
          <small>Dosagem: ${a.dosagem}</small>
        </span>
        <div class="botoes-aplicacao">
          <button class="botao-circular azul" onclick="editarAplicacao(${index})">
            <i class="fas fa-edit"></i>
          </button>
          <button class="botao-circular vermelho" onclick="excluirAplicacao(${index})">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      `;
      lista.appendChild(item);
    });
  }
}

// ===== ADICIONAR OU SALVAR EDIÇÃO =====
function adicionarAplicacao() {
  const nova = {
    data: document.getElementById("dataAplicacao").value,
    produto: document.getElementById("produtoAplicacao").value.trim(),
    tipo: document.getElementById("tipoAplicacao").value,
    dosagem: document.getElementById("dosagemAplicacao").value.trim(),
    setor: document.getElementById("setorAplicacao").value
  };

  if (!nova.data || !nova.produto || !nova.dosagem || isNaN(parseFloat(nova.dosagem)) || parseFloat(nova.dosagem) <= 0) {
    alert("Preencha todos os campos corretamente.");
    return;
  }

  if (indiceEdicaoAplicacao !== null) {
    aplicacoes[indiceEdicaoAplicacao] = nova;
    indiceEdicaoAplicacao = null;
    document.getElementById("btnCancelarEdicaoAplicacao").style.display = "none";
    document.querySelector('#aplicacoes button[onclick="adicionarAplicacao()"]').innerText = "Adicionar Aplicação";
  } else {
    aplicacoes.push(nova);
  }

  db.ref("Aplicacoes").set(aplicacoes);
  limparCamposAplicacao();
  atualizarAplicacoes();
  carregarSugestoesProdutos();
}

// ===== EDITAR APLICAÇÃO =====
function editarAplicacao(index) {
  const a = aplicacoes[index];
  if (!a) return;

  document.getElementById("dataAplicacao").value = a.data;
  document.getElementById("produtoAplicacao").value = a.produto;
  document.getElementById("tipoAplicacao").value = a.tipo;
  document.getElementById("dosagemAplicacao").value = a.dosagem;
  document.getElementById("setorAplicacao").value = a.setor;

  indiceEdicaoAplicacao = index;
  document.querySelector('#aplicacoes button[onclick="adicionarAplicacao()"]').innerText = "Salvar Edição";
  document.getElementById("btnCancelarEdicaoAplicacao").style.display = "inline-block";
}

// ===== CANCELAR EDIÇÃO =====
function cancelarEdicaoAplicacao() {
  limparCamposAplicacao();
  indiceEdicaoAplicacao = null;
  document.querySelector('#aplicacoes button[onclick="adicionarAplicacao()"]').innerText = "Adicionar Aplicação";
  document.getElementById("btnCancelarEdicaoAplicacao").style.display = "none";
}

// ===== EXCLUIR APLICAÇÃO =====
function excluirAplicacao(index) {
  if (!confirm("Deseja excluir esta aplicação?")) return;
  aplicacoes.splice(index, 1);
  db.ref("Aplicacoes").set(aplicacoes);
  atualizarAplicacoes();
}

// ===== LIMPAR CAMPOS =====
function limparCamposAplicacao() {
  document.getElementById("dataAplicacao").value = "";
  document.getElementById("produtoAplicacao").value = "";
  document.getElementById("tipoAplicacao").value = "Adubo";
  document.getElementById("dosagemAplicacao").value = "";
  document.getElementById("setorAplicacao").value = "Setor 01";
}

// ===== EXPORTAR CSV =====
function exportarAplicacoesCSV() {
  if (!aplicacoes.length) {
    alert("Nenhum dado disponível para exportar.");
    return;
  }

  let csv = "Data,Produto,Tipo,Dosagem,Setor\n";
  aplicacoes.forEach(a => {
    csv += `${a.data},${a.produto},${a.tipo},${a.dosagem},${a.setor}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `aplicacoes_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
}

// ===== SUGESTÕES DE PRODUTOS =====
function carregarSugestoesProdutos() {
  const unicos = [...new Set(aplicacoes.map(a => a.produto))];
  if (JSON.stringify(unicos) === JSON.stringify(sugestoesProdutos)) return;
  sugestoesProdutos = unicos;

  const datalist = document.getElementById("sugestoesProdutos");
  if (!datalist) return;

  datalist.innerHTML = "";
  sugestoesProdutos.forEach(produto => {
    const op = document.createElement("option");
    op.value = produto;
    datalist.appendChild(op);
  });
}
