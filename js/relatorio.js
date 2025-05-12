// ====== VARIÁVEIS GLOBAIS ======
const relatorios = {
  aplicacoes: [],
  tarefas: [],
  financeiro: [],
  colheita: []
};

// ====== ATUALIZAR RELATÓRIO COMPLETO (Versão unificada) ======
function atualizarRelatorioCompleto() {
  const elementos = {
    aplicacoes: "resumoRelAplicacoes",
    tarefas: "resumoRelTarefas",
    financeiro: "resumoRelFinanceiro",
    colheita: "resumoRelColheita"
  };

  Object.keys(elementos).forEach(tipo => {
    if (document.getElementById(elementos[tipo])) {
      atualizarRelatorio(tipo);
    }
  });
}

// ====== FUNÇÃO GENÉRICA PARA ATUALIZAR RELATÓRIOS ======
function atualizarRelatorio(tipo) {
  const mapeamento = {
    aplicacoes: dados => dados.map(app => 
      `${app.data} - ${app.produto} (${app.tipo}) - ${app.dosagem} - ${app.setor}`),
    tarefas: dados => dados.map(t => 
      `${t.data} - ${t.descricao} (${t.prioridade}) - ${t.setor}`),
    financeiro: dados => dados.map(g => 
      `${g.data} - ${g.produto} - R$ ${g.valor.toFixed(2)} (${g.tipo})`),
    colheita: dados => dados.map(c => 
      `${c.data} - ${c.colhedor} - ${c.quantidade.toFixed(2)} latas`)
  };

  const dados = window[tipo] || [];
  relatorios[tipo] = dados;
  const elemento = document.getElementById(`resumoRel${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`);
  
  if (elemento) {
    elemento.innerHTML = dados.length 
      ? mapeamento[tipo](dados).join('<br>')
      : `Nenhum ${tipo === 'colheita' ? 'registro de colheita' : tipo + ' registrada'}.`;
  }
}

// ====== EXPORTAÇÃO DE RELATÓRIOS ======
function exportarRelatorio(formato) {
  const hoje = new Date().toISOString().split("T")[0];
  
  if (formato === 'pdf') {
    exportarPDF();
  } else {
    exportarCSV();
  }

  // Funções internas
  function exportarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(16);
    doc.text("Relatório Geral - Manejo Café", 20, y);
    y += 10;

    Object.keys(relatorios).forEach(tipo => {
      if (relatorios[tipo].length) {
        doc.setFontSize(12);
        doc.text(`${tipo.charAt(0).toUpperCase() + tipo.slice(1)}:`, 20, y);
        y += 8;
        
        relatorios[tipo].forEach(item => {
          const texto = mapeamentoPDF[tipo](item);
          doc.text(texto, 20, y);
          y += 6;
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
        });
      }
    });

    doc.save(`relatorio_manejo_cafe_${hoje}.pdf`);
  }

  function exportarCSV() {
    let csv = "Tipo,Data,Descrição,Setor,Valor\n";
    
    // Mapeamento genérico para CSV
    const processadores = {
      aplicacoes: a => `Aplicação,${a.data},"${a.produto} (${a.dosagem})",${a.setor},`,
      tarefas: t => `Tarefa,${t.data},"${t.descricao} (${t.prioridade})",${t.setor},`,
      financeiro: g => `Financeiro,${g.data},"${g.produto}",,${g.valor.toFixed(2)}`,
      colheita: c => `Colheita,${c.data},${c.colhedor},,${(c.quantidade * c.valorLata).toFixed(2)}`
    };

    Object.keys(relatorios).forEach(tipo => {
      relatorios[tipo].forEach(item => {
        csv += processadores[tipo](item) + "\n";
      });
    });

    downloadArquivo(csv, `relatorio_manejo_cafe_${hoje}.csv`, "text/csv");
  }
}

// Função auxiliar para download
function downloadArquivo(conteudo, nome, tipo) {
  const blob = new Blob([conteudo], { type: `${tipo};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

// Inicialização
document.addEventListener("dadosCarregados", atualizarRelatorioCompleto);
