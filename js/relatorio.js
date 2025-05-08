// ===== CARREGAR RELATÓRIO =====
function carregarRelatorio() {
  atualizarRelatorioAplicacoes();
  atualizarRelatorioTarefas();
  atualizarRelatorioFinanceiro();
  atualizarRelatorioColheita();
}

// ===== RELATÓRIO DE APLICAÇÕES =====
function atualizarRelatorioAplicacoes() {
  db.ref('Aplicacoes').once('value', snap => {
    const aplicacoes = snap.exists() ? snap.val() : [];
    const container = document.getElementById("relatorioAplicacoes");
    container.innerHTML = aplicacoes.map(app => `
      <div>
        ${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} L/ha - ${app.setor}
      </div>
    `).join('');
  });
}

// ===== RELATÓRIO DE TAREFAS =====
function atualizarRelatorioTarefas() {
  db.ref('Tarefas').once('value', snap => {
    const tarefas = snap.exists() ? snap.val() : [];
    const container = document.getElementById("relatorioTarefas");
    container.innerHTML = tarefas.map(tar => `
      <div>
        ${tar.data} - ${tar.descricao} (${tar.prioridade}) - ${tar.setor} - ${tar.feita ? "Feita" : "Pendente"}
      </div>
    `).join('');
  });
}

// ===== RELATÓRIO FINANCEIRO =====
function atualizarRelatorioFinanceiro() {
  db.ref('Financeiro').once('value', snap => {
    const lancamentos = snap.exists() ? snap.val() : [];
    const container = document.getElementById("relatorioFinanceiro");
    container.innerHTML = lancamentos.map(lanc => `
      <div>
        ${lanc.data} - ${lanc.descricao} - R$ ${lanc.valor.toFixed(2)} - ${lanc.tipo}
        ${lanc.parcelado ? `(Parcelado: ${lanc.parcelas.length}x)` : ''}
      </div>
    `).join('');
  });
}

// ===== RELATÓRIO DE COLHEITA =====
function atualizarRelatorioColheita() {
  db.ref('Colheita').once('value', snap => {
    const colheitas = snap.exists() ? snap.val() : [];
    const container = document.getElementById("relatorioColheita");
    container.innerHTML = colheitas.map(col => `
      <div>
        ${col.data} - ${col.quantidade} Kg ${col.descricao ? `- ${col.descricao}` : ''}
      </div>
    `).join('');
  });
}

// ===== EXPORTAR RELATÓRIO COMO PDF =====
function gerarRelatorioPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("Relatório Completo - Manejo Café", 20, 20);

  let y = 40;
  ["Aplicacoes", "Tarefas", "Financeiro", "Colheita"].forEach(secao => {
    doc.text(secao, 20, y);
    y += 10;
    const container = document.getElementById(`relatorio${secao}`);
    container.querySelectorAll("div").forEach(div => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(div.textContent, 20, y);
      y += 8;
    });
    y += 10;
  });

  doc.save("relatorio_manejo_cafe.pdf");
}

// ===== EXPORTAR RELATÓRIO COMO CSV =====
function gerarRelatorioCSV() {
  const csv = [
    "Seção,Data,Descrição,Detalhes",
    ...document.querySelectorAll("#relatorioAplicacoes div, #relatorioTarefas div, #relatorioFinanceiro div, #relatorioColheita div")
      .map(div => `Relatório,${div.textContent.replaceAll(" - ", ",")}`)
  ].join("\n");

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `relatorio_manejo_cafe_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
}

// ===== INICIALIZAR =====
document.addEventListener("DOMContentLoaded", carregarRelatorio);
