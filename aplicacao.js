// ===== VARIÁVEL GLOBAL =====
let aplicacoes = [];

// ===== CARREGAR APLICAÇÕES =====
function carregarAplicacoes() {
  db.ref("Aplicacoes").on("value", snap => {
    aplicacoes = snap.exists() ? snap.val() : [];
    atualizarAplicacoes();
  });
}

// ===== ATUALIZAR LISTAGEM =====
function atualizarAplicacoes() {
  const lista = document.getElementById("listaAplicacoes");
  lista.innerHTML = "";

  const filtroSetor = document.getElementById("filtroSetorAplicacoes").value;
  const termoBusca = document.getElementById("pesquisaAplicacoes").value.toLowerCase();

  aplicacoes
    .filter(app =>
      (!filtroSetor || app.setor === filtroSetor) &&
      (`${app.produto} ${app.tipo} ${app.setor}`.toLowerCase().includes(termoBusca))
    )
    .sort((a, b) => (a.data > b.data ? -1 : 1))
    .forEach((app, i) => {
      const item = document.createElement("div");
      item.className = "item fade-in";
      item.innerHTML = `
        <span>${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}</span>
        <div class="botoes-aplicacao">
          <button class="botao-circular vermelho" onclick="excluirAplicacao(${i})">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      `;
      lista.appendChild(item);
    });
}

// ===== EXCLUIR =====
function excluirAplicacao(index) {
  if (!confirm("Deseja excluir esta aplicação?")) return;
  aplicacoes.splice(index, 1);
  db.ref("Aplicacoes").set(aplicacoes);
  atualizarAplicacoes();
}

// ===== EXPORTAR CSV =====
function exportarAplicacoesCSV() {
  if (!aplicacoes.length) {
    alert("Nenhuma aplicação para exportar.");
    return;
  }

  let csv = 'Data,Produto,Tipo,Dosagem,Setor\n';

  aplicacoes.forEach(app => {
    csv += `${app.data},${app.produto},${app.tipo},${app.dosagem},${app.setor}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `aplicacoes_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
}

// ===== EXPORTAR PDF =====
function exportarAplicacoesPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("Relatório de Aplicações", 20, 20);
  let y = 40;

  aplicacoes.forEach(app => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(`${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}`, 20, y);
    y += 10;
  });

  doc.save("relatorio_aplicacoes.pdf");
}
