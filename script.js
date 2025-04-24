function showSection(id) {
  document.querySelectorAll('.app-section').forEach(sec => {
    sec.classList.remove('active');
  });
  document.getElementById(id).classList.add('active');
}

window.addEventListener('DOMContentLoaded', () => {
  // Aplicação
  const aplicacoes = JSON.parse(localStorage.getItem('aplicacoes') || '[]');
  const listaAplicacoes = document.getElementById('lista-aplicacoes');
  const formAplicacao = document.getElementById('aplicacao-form');

  function renderAplicacoes() {
    listaAplicacoes.innerHTML = '';
    aplicacoes.forEach((item, i) => {
      const li = document.createElement('li');
      li.textContent = `${item.data} - ${item.produto} - ${item.dosagem}`;
      listaAplicacoes.appendChild(li);
    });
  }

  formAplicacao.addEventListener('submit', e => {
    e.preventDefault();
    aplicacoes.push({
      data: document.getElementById('data-aplicacao').value,
      produto: document.getElementById('produto').value,
      dosagem: document.getElementById('dosagem').value
    });
    localStorage.setItem('aplicacoes', JSON.stringify(aplicacoes));
    formAplicacao.reset();
    renderAplicacoes();
  });

  renderAplicacoes();

  // Tarefas
  const tarefas = JSON.parse(localStorage.getItem('tarefas') || '[]');
  const listaAfazer = document.getElementById('tarefas-afazer');
  const listaExecutadas = document.getElementById('tarefas-executadas');
  const formTarefa = document.getElementById('tarefa-form');

  function renderTarefas() {
    listaAfazer.innerHTML = '';
    listaExecutadas.innerHTML = '';
    tarefas.forEach((t, i) => {
      const li = document.createElement('li');
      li.textContent = `${t.data} - ${t.descricao}`;
      if (t.feita) {
        listaExecutadas.appendChild(li);
      } else {
        li.onclick = () => {
          t.feita = true;
          localStorage.setItem('tarefas', JSON.stringify(tarefas));
          renderTarefas();
        };
        listaAfazer.appendChild(li);
      }
    });
  }

  formTarefa.addEventListener('submit', e => {
    e.preventDefault();
    tarefas.push({
      data: document.getElementById('data-tarefa').value,
      descricao: document.getElementById('descricao-tarefa').value,
      feita: false
    });
    localStorage.setItem('tarefas', JSON.stringify(tarefas));
    formTarefa.reset();
    renderTarefas();
  });

  renderTarefas();

  // Financeiro
  const financeiro = JSON.parse(localStorage.getItem('financeiro') || '[]');
  const listaVencer = document.getElementById('lista-vencer');
  const listaPago = document.getElementById('lista-pago');
  const totalSpan = document.getElementById('total-pagar');
  const formFinanceiro = document.getElementById('financeiro-form');

  function renderFinanceiro() {
    listaVencer.innerHTML = '';
    listaPago.innerHTML = '';
    let total = 0;
    financeiro.forEach((f, i) => {
      const li = document.createElement('li');
      li.textContent = `${f.data} - ${f.produto} - R$ ${parseFloat(f.valor).toFixed(2)}`;
      if (f.pago) {
        listaPago.appendChild(li);
      } else {
        total += parseFloat(f.valor);
        li.onclick = () => {
          f.pago = true;
          localStorage.setItem('financeiro', JSON.stringify(financeiro));
          renderFinanceiro();
        };
        listaVencer.appendChild(li);
      }
    });
    totalSpan.textContent = total.toFixed(2);
  }

  formFinanceiro.addEventListener('submit', e => {
    e.preventDefault();
    financeiro.push({
      data: document.getElementById('data-financeiro').value,
      produto: document.getElementById('produto-financeiro').value,
      valor: document.getElementById('valor-financeiro').value,
      pago: false
    });
    localStorage.setItem('financeiro', JSON.stringify(financeiro));
    formFinanceiro.reset();
    renderFinanceiro();
  });

  renderFinanceiro();
});


function renderResumoMensal() {
  const financeiro = JSON.parse(localStorage.getItem('financeiro') || '[]');
  const resumo = {};

  financeiro.forEach(f => {
    if (!f.pago) {
      const data = new Date(f.data);
      const mes = data.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
      if (!resumo[mes]) resumo[mes] = {};
      const categoria = f.tipo || 'Outros';
      if (!resumo[mes][categoria]) resumo[mes][categoria] = 0;
      resumo[mes][categoria] += parseFloat(f.valor);
    }
  });

  const container = document.getElementById("resumo-mensal");
  container.innerHTML = "<h3>Resumo Mensal por Categoria</h3>";
  for (const mes in resumo) {
    container.innerHTML += `<strong>${mes}</strong><br>`;
    for (const cat in resumo[mes]) {
      container.innerHTML += `- ${cat}: R$ ${resumo[mes][cat].toFixed(2)}<br>`;
    }
    container.innerHTML += "<br>";
  }
}

window.addEventListener("DOMContentLoaded", () => {
  // Resumo mensal dentro do financeiro
  const divResumo = document.createElement("div");
  divResumo.id = "resumo-mensal";
  divResumo.style.marginTop = "20px";
  divResumo.style.background = "#f8f8f8";
  divResumo.style.padding = "10px";
  divResumo.style.borderRadius = "6px";
  divResumo.style.fontSize = "14px";

  document.getElementById("financeiro").querySelector(".container").appendChild(divResumo);
  renderResumoMensal();

  // Botão exportar
  const btnExport = document.createElement("button");
  btnExport.textContent = "Exportar Dados";
  btnExport.style.position = "fixed";
  btnExport.style.bottom = "10px";
  btnExport.style.right = "10px";
  btnExport.style.padding = "10px 15px";
  btnExport.style.backgroundColor = "#2e7d32";
  btnExport.style.color = "white";
  btnExport.style.border = "none";
  btnExport.style.borderRadius = "5px";
  btnExport.style.cursor = "pointer";
  btnExport.onclick = exportarCSV;
  document.body.appendChild(btnExport);
});

function exportarCSV() {
  let csv = "Seção;Data;Descrição;Valor/Dosagem;Status\n";

  const aplicacoes = JSON.parse(localStorage.getItem('aplicacoes') || '[]');
  aplicacoes.forEach(item => {
    csv += `Aplicação;${item.data};${item.produto};${item.dosagem};\n`;
  });

  const tarefas = JSON.parse(localStorage.getItem('tarefas') || '[]');
  tarefas.forEach(item => {
    const status = item.feita ? "Executada" : "A Fazer";
    csv += `Tarefa;${item.data};${item.descricao};;${status}\n`;
  });

  const financeiro = JSON.parse(localStorage.getItem('financeiro') || '[]');
  financeiro.forEach(item => {
    const status = item.pago ? "Pago" : "A Vencer";
    csv += `Financeiro;${item.data};${item.produto};${item.valor};${status}\n`;
  });

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "manejo_cafe_export.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// atualizar resumo após envio
const financeiroForm = document.getElementById("financeiro-form");
if (financeiroForm) {
  financeiroForm.addEventListener("submit", () => {
    setTimeout(() => renderResumoMensal(), 100);
  });
}


function renderGraficoCategorias(dados) {
  const ctx = document.getElementById('grafico-categorias').getContext('2d');
  if (window.graficoCategorias) {
    window.graficoCategorias.destroy();
  }
  const labels = Object.keys(dados);
  const valores = Object.values(dados);
  window.graficoCategorias = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        label: 'Gastos por categoria',
        data: valores,
        backgroundColor: [
          '#66bb6a', '#42a5f5', '#ffa726', '#ab47bc', '#ef5350', '#26c6da'
        ]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}

// Atualizar gráfico dentro do renderResumoMensal
const oldRenderResumo = renderResumoMensal;
renderResumoMensal = function () {
  const financeiro = JSON.parse(localStorage.getItem('financeiro') || '[]');
  const resumo = {};

  financeiro.forEach(f => {
    if (!f.pago) {
      const data = new Date(f.data);
      const mes = data.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
      if (!resumo[mes]) resumo[mes] = {};
      const categoria = f.tipo || 'Outros';
      if (!resumo[mes][categoria]) resumo[mes][categoria] = 0;
      resumo[mes][categoria] += parseFloat(f.valor);
    }
  });

  const container = document.getElementById("resumo-mensal");
  container.innerHTML = "<h3>Resumo Mensal por Categoria</h3>";
  for (const mes in resumo) {
    container.innerHTML += `<strong>${mes}</strong><br>`;
    for (const cat in resumo[mes]) {
      container.innerHTML += `- ${cat}: R$ ${resumo[mes][cat].toFixed(2)}<br>`;
    }
    container.innerHTML += "<br>";
    // Renderiza o gráfico com o primeiro mês encontrado
    renderGraficoCategorias(resumo[mes]);
    break;
  }
}


// Campo de categoria na adição de financeiro
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('financeiro-form');
  if (form) {
    const select = document.createElement('select');
    select.id = 'categoria-financeiro';
    select.innerHTML = `
      <option value="">Categoria</option>
      <option>Adubo</option>
      <option>Fungicida</option>
      <option>Inseticida</option>
      <option>Herbicida</option>
      <option>Ferramenta</option>
      <option>Outros</option>
    `;
    form.insertBefore(select, form.querySelector('button'));
  }
});

// Marcar tudo como pago
function marcarTudoComoPago() {
  financeiro.forEach(f => f.pago = true);
  localStorage.setItem("financeiro", JSON.stringify(financeiro));
  renderFinanceiro();
  renderResumoMensal();
}

window.addEventListener("DOMContentLoaded", () => {
  const btnTudoPago = document.createElement("button");
  btnTudoPago.textContent = "Marcar tudo como pago";
  btnTudoPago.style.marginTop = "10px";
  btnTudoPago.style.backgroundColor = "#555";
  btnTudoPago.style.color = "#fff";
  btnTudoPago.style.padding = "8px";
  btnTudoPago.style.border = "none";
  btnTudoPago.style.borderRadius = "5px";
  btnTudoPago.style.cursor = "pointer";
  btnTudoPago.onclick = marcarTudoComoPago;
  document.getElementById("financeiro").querySelector(".container").appendChild(btnTudoPago);
});

// Salvar com categoria
document.getElementById("financeiro-form").addEventListener("submit", e => {
  e.preventDefault();
  const data = document.getElementById("data-financeiro").value;
  const produto = document.getElementById("produto-financeiro").value;
  const valor = document.getElementById("valor-financeiro").value;
  const tipo = document.getElementById("categoria-financeiro").value || "Outros";
  financeiro.push({ data, produto, valor, pago: false, tipo });
  localStorage.setItem("financeiro", JSON.stringify(financeiro));
  e.target.reset();
  renderFinanceiro();
  renderResumoMensal();
});

// PDF - usando jsPDF e autoTable (biblioteca leve)
function gerarPDF() {
  const doc = new jspdf.jsPDF();
  doc.text("Relatório Financeiro", 14, 10);
  const dados = [["Data", "Produto", "Valor", "Status"]];
  financeiro.forEach(f => {
    dados.push([
      f.data,
      f.produto,
      `R$ ${parseFloat(f.valor).toFixed(2)}`,
      f.pago ? "Pago" : "A Vencer"
    ]);
  });
  doc.autoTable({ head: [dados[0]], body: dados.slice(1), startY: 20 });

  doc.save("relatorio_financeiro.pdf");
}

// Botão gerar PDF
window.addEventListener("DOMContentLoaded", () => {
  const btnPDF = document.createElement("button");
  btnPDF.textContent = "Gerar Relatório PDF";
  btnPDF.style.position = "fixed";
  btnPDF.style.bottom = "60px";
  btnPDF.style.right = "10px";
  btnPDF.style.padding = "10px 15px";
  btnPDF.style.backgroundColor = "#1976d2";
  btnPDF.style.color = "white";
  btnPDF.style.border = "none";
  btnPDF.style.borderRadius = "5px";
  btnPDF.style.cursor = "pointer";
  btnPDF.onclick = gerarPDF;
  document.body.appendChild(btnPDF);
});


// Redefine renderFinanceiro para aplicar botões ✔ e 🗑 no estilo PDF
function renderFinanceiro() {
  const listaVencer = document.getElementById("lista-vencer");
  const listaPago = document.getElementById("lista-pago");
  listaVencer.innerHTML = "";
  listaPago.innerHTML = "";
  let total = 0;

  financeiro.forEach((f, i) => {
    const li = document.createElement("li");
    li.textContent = `${f.data} - ${f.produto} - R$ ${parseFloat(f.valor).toFixed(2)}`;
    li.style.display = "flex";
    li.style.justifyContent = "space-between";
    li.style.alignItems = "center";

    const btnGroup = document.createElement("div");

    if (!f.pago) {
      const btnOk = document.createElement("button");
      btnOk.textContent = "✔";
      btnOk.style.marginRight = "6px";
      btnOk.style.backgroundColor = "#4caf50";
      btnOk.style.color = "white";
      btnOk.style.border = "none";
      btnOk.style.borderRadius = "4px";
      btnOk.style.cursor = "pointer";
      btnOk.onclick = () => {
        f.pago = true;
        localStorage.setItem("financeiro", JSON.stringify(financeiro));
        renderFinanceiro();
        renderResumoMensal();
      };
      btnGroup.appendChild(btnOk);
    }

    const btnDelete = document.createElement("button");
    btnDelete.textContent = "🗑";
    btnDelete.style.backgroundColor = "#f44336";
    btnDelete.style.color = "white";
    btnDelete.style.border = "none";
    btnDelete.style.borderRadius = "4px";
    btnDelete.style.cursor = "pointer";
    btnDelete.onclick = () => {
      financeiro.splice(i, 1);
      localStorage.setItem("financeiro", JSON.stringify(financeiro));
      renderFinanceiro();
      renderResumoMensal();
    };
    btnGroup.appendChild(btnDelete);

    li.appendChild(btnGroup);

    if (f.pago) {
      listaPago.appendChild(li);
    } else {
      total += parseFloat(f.valor);
      listaVencer.appendChild(li);
    }
  });

  document.getElementById("total-pagar").textContent = total.toFixed(2);
}


let editandoIndex = null;

// Redefinindo evento de envio do formulário com lógica de edição
document.getElementById("financeiro-form").addEventListener("submit", e => {
  e.preventDefault();
  const data = document.getElementById("data-financeiro").value;
  const produto = document.getElementById("produto-financeiro").value;
  const valor = document.getElementById("valor-financeiro").value;
  const tipo = document.getElementById("categoria-financeiro").value || "Outros";

  if (editandoIndex !== null) {
    // Atualiza item existente
    financeiro[editandoIndex] = { data, produto, valor, pago: false, tipo };
    editandoIndex = null;
    e.target.querySelector("button[type='submit']").textContent = "Adicionar";
  } else {
    // Adiciona novo
    financeiro.push({ data, produto, valor, pago: false, tipo });
  }

  localStorage.setItem("financeiro", JSON.stringify(financeiro));
  e.target.reset();
  renderFinanceiro();
  renderResumoMensal();
});

// Redefinindo renderFinanceiro para incluir botão de edição
function renderFinanceiro() {
  const listaVencer = document.getElementById("lista-vencer");
  const listaPago = document.getElementById("lista-pago");
  listaVencer.innerHTML = "";
  listaPago.innerHTML = "";
  let total = 0;

  financeiro.forEach((f, i) => {
    const li = document.createElement("li");
    li.textContent = `${f.data} - ${f.produto} - R$ ${parseFloat(f.valor).toFixed(2)}`;
    li.style.display = "flex";
    li.style.justifyContent = "space-between";
    li.style.alignItems = "center";

    const btnGroup = document.createElement("div");

    if (!f.pago) {
      const btnOk = document.createElement("button");
      btnOk.textContent = "✔";
      btnOk.style.marginRight = "6px";
      btnOk.style.backgroundColor = "#4caf50";
      btnOk.style.color = "white";
      btnOk.style.border = "none";
      btnOk.style.borderRadius = "4px";
      btnOk.style.cursor = "pointer";
      btnOk.onclick = () => {
        f.pago = true;
        localStorage.setItem("financeiro", JSON.stringify(financeiro));
        renderFinanceiro();
        renderResumoMensal();
      };
      btnGroup.appendChild(btnOk);

      const btnEdit = document.createElement("button");
      btnEdit.textContent = "✏️";
      btnEdit.style.marginRight = "6px";
      btnEdit.style.backgroundColor = "#1976d2";
      btnEdit.style.color = "white";
      btnEdit.style.border = "none";
      btnEdit.style.borderRadius = "4px";
      btnEdit.style.cursor = "pointer";
      btnEdit.onclick = () => {
        document.getElementById("data-financeiro").value = f.data;
        document.getElementById("produto-financeiro").value = f.produto;
        document.getElementById("valor-financeiro").value = f.valor;
        document.getElementById("categoria-financeiro").value = f.tipo;
        document.getElementById("financeiro-form").querySelector("button[type='submit']").textContent = "Salvar Edição";
        editandoIndex = i;
      };
      btnGroup.appendChild(btnEdit);
    }

    const btnDelete = document.createElement("button");
    btnDelete.textContent = "🗑";
    btnDelete.style.backgroundColor = "#f44336";
    btnDelete.style.color = "white";
    btnDelete.style.border = "none";
    btnDelete.style.borderRadius = "4px";
    btnDelete.style.cursor = "pointer";
    btnDelete.onclick = () => {
      financeiro.splice(i, 1);
      localStorage.setItem("financeiro", JSON.stringify(financeiro));
      renderFinanceiro();
      renderResumoMensal();
    };
    btnGroup.appendChild(btnDelete);

    li.appendChild(btnGroup);

    if (f.pago) {
      listaPago.appendChild(li);
    } else {
      total += parseFloat(f.valor);
      listaVencer.appendChild(li);
    }
  });

  document.getElementById("total-pagar").textContent = total.toFixed(2);
}