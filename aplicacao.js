// ===== VARIÁVEIS =====
let aplicacoes = [];
let sugestoesProdutos = [];

// ===== CARREGAR DADOS =====
function carregarAplicacoes() {
  db.ref("Aplicacoes").on("value", snap => {
    aplicacoes = snap.exists() ? snap.val() : [];
    atualizarAplicacoes();
    carregarSugestoesProdutos();
  });
}

// ===== ATUALIZAR LISTA =====
function atualizarAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  lista.innerHTML = "";

  const setorFiltro = document.getElementById("filtroSetorAplicacoes").value;
  const termoBusca = document.getElementById("pesquisaAplicacoes").value.toLowerCase();

  let agrupado = {};

  aplicacoes
    .filter(a =>
      (!setorFiltro || a.setor === setorFiltro) &&
      (`${a.produto} ${a.tipo} ${a.setor}`.toLowerCase().includes(termoBusca))
    )
    .sort((a, b) => b.data.localeCompare(a.data))
    .forEach(a => {
      const chaveGrupo = `${a.setor} | ${a.data}`;
      if (!agrupado[chaveGrupo]) agrupado[chaveGrupo] = [];
      agrupado[chaveGrupo].push(a);
    });

  for (const grupo in agrupado) {
    const titulo = document.createElement("div");
    titulo.className = "grupo-data";
    titulo.innerHTML = `<strong>${grupo}</strong>`;
    lista.appendChild(titulo);

    agrupado[grupo].forEach((a, i) => {
      const item = document.createElement("div");
      item.className = "item fade-in";

      item.innerHTML = `
        <span>
          ${a.data} - ${a.produto} (${a.tipo}) - ${a.setor}<br>
          <small>Dosagem: ${a.dosagem}</small>
        </span>
        <div class="botoes-aplicacao">
          <button class="botao-circular vermelho" onclick="excluirAplicacao(${i})">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      `;
      lista.appendChild(item);
    });
  }
}

// ===== ADICIONAR APLICAÇÃO =====
function adicionarAplicacao() {
  const nova = {
    data: document.getElementById("dataAplicacao").value,
    produto: document.getElementById("produtoAplicacao").value.trim(),
    tipo: document.getElementById("tipoAplicacao").value,
    dosagem: document.getElementById("dosagemAplicacao").value.trim(),
    setor: document.getElementById("setorAplicacao").value
  };

  if (!nova.data || !nova.produto || !nova.dosagem || isNaN(parseFloat(nova.dosagem)) || parseFloat(nova.dosagem) <= 0) {
    alert("Preencha todos os campos corretamente com valores válidos.");
    return;
  }

  aplicacoes.push(nova);
  db.ref("Aplicacoes").set(aplicacoes);
  limparCamposAplicacao();
  atualizarAplicacoes();
  carregarSugestoesProdutos();
}

// ===== EXCLUIR APLICAÇÃO =====
function excluirAplicacao(index) {
  if (!confirm("Deseja realmente excluir esta aplicação?")) return;
  aplicacoes.splice(index, 1);
  db.ref("Aplicacoes").set(aplicacoes);
  atualizarAplicacoes();
}

// ===== LIMPAR CAMPOS =====
function limparCamposAplicacao() {
  document.getElementById("dataAplicacao").value = "";
  document.getElementById("produtoAplicacao").value = "";
  document.getElementById("dosagemAplicacao").value = "";
  document.getElementById("tipoAplicacao").value = "Adubo";
  document.getElementById("setorAplicacao").value = "Setor 01";
}

// ===== EXPORTAR CSV =====
function exportarAplicacoesCSV() {
  if (!aplicacoes.length) {
    alert("Nenhuma aplicação registrada para exportar.");
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

// ===== CARREGAR SUGESTÕES DE PRODUTOS =====
function carregarSugestoesProdutos() {
  sugestoesProdutos = [...new Set(aplicacoes.map(a => a.produto))];
  const datalist = document.getElementById("sugestoesProdutos");
  if (!datalist) return;

  datalist.innerHTML = "";
  sugestoesProdutos.forEach(produto => {
    const option = document.createElement("option");
    option.value = produto;
    datalist.appendChild(option);
  });
}
