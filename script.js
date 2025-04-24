document.addEventListener("DOMContentLoaded", function () {
  mostrarSecao("aplicacao");
  carregarDados();
});

function mostrarSecao(secaoId) {
  document.querySelectorAll(".secao").forEach(secao => {
    secao.classList.remove("active");
  });
  document.getElementById(secaoId).classList.add("active");
}

function salvarDados(chave, dados) {
  localStorage.setItem(chave, JSON.stringify(dados));
}

function carregarDados() {
  atualizarLista("Aplicacoes");
  atualizarLista("Tarefas");
  atualizarLista("Financeiro");
  atualizarResumoFinanceiro();
}

function atualizarLista(tipo) {
  const lista = JSON.parse(localStorage.getItem(tipo)) || [];
  const ul = document.getElementById(`lista${tipo}`);
  if (!ul) return;
  ul.innerHTML = "";

  lista.forEach((item, index) => {
    const li = document.createElement("li");

    if (tipo === "Financeiro") {
      li.innerHTML = `${item.data} - ${item.produto} - R$ ${item.valor.toFixed(2)} 
        <button onclick="marcarPago(${index})">✔</button>
        <button onclick="editarFinanceiro(${index})">✏️</button>
        <button onclick="removerItem('${tipo}', ${index})">🗑</button>`;
    } else if (tipo === "Tarefas") {
      li.innerHTML = `${item.data} - ${item.descricao}
        <button onclick="marcarExecutada(${index})">✔</button>`;
    } else {
      li.innerHTML = `${item.data} - ${item.produto} - ${item.dosagem} - ${item.tipo}
        <button onclick="removerItem('${tipo}', ${index})">🗑</button>`;
    }

    ul.appendChild(li);
  });

  if (tipo === "Financeiro") {
    const total = lista.reduce((soma, item) => soma + item.valor, 0);
    document.getElementById("totalFinanceiro").innerText = total.toFixed(2);
  }
}

function adicionarAplicacao() {
  const data = document.getElementById("dataAplicacao").value;
  const produto = document.getElementById("produtoAplicacao").value;
  const dosagem = document.getElementById("dosagemAplicacao").value;
  const tipo = document.getElementById("tipoProduto").value;

  if (produto && dosagem && tipo) {
    const lista = JSON.parse(localStorage.getItem("Aplicacoes")) || [];
    lista.push({ data, produto, dosagem, tipo });
    salvarDados("Aplicacoes", lista);
    atualizarLista("Aplicacoes");
  }
}

function adicionarTarefa() {
  const data = document.getElementById("dataTarefa").value;
  const descricao = document.getElementById("descricaoTarefa").value;
  if (descricao) {
    const lista = JSON.parse(localStorage.getItem("Tarefas")) || [];
    lista.push({ data, descricao });
    salvarDados("Tarefas", lista);
    atualizarLista("Tarefas");
  }
}

function adicionarFinanceiro() {
  const data = document.getElementById("dataFinanceiro").value;
  const produto = document.getElementById("produtoFinanceiro").value;
  const valor = parseFloat(document.getElementById("valorFinanceiro").value);
  const categoria = document.getElementById("categoriaFinanceiro").value;

  if (produto && valor && categoria) {
    const lista = JSON.parse(localStorage.getItem("Financeiro")) || [];
    lista.push({ data, produto, valor, categoria });
    salvarDados("Financeiro", lista);
    atualizarLista("Financeiro");
    atualizarResumoFinanceiro();
  }
}

function marcarPago(index) {
  const lista = JSON.parse(localStorage.getItem("Financeiro")) || [];
  lista.splice(index, 1);
  salvarDados("Financeiro", lista);
  atualizarLista("Financeiro");
  atualizarResumoFinanceiro();
}

function editarFinanceiro(index) {
  const lista = JSON.parse(localStorage.getItem("Financeiro")) || [];
  const item = lista[index];
  document.getElementById("dataFinanceiro").value = item.data;
  document.getElementById("produtoFinanceiro").value = item.produto;
  document.getElementById("valorFinanceiro").value = item.valor;
  document.getElementById("categoriaFinanceiro").value = item.categoria;
  lista.splice(index, 1);
  salvarDados("Financeiro", lista);
  atualizarLista("Financeiro");
  atualizarResumoFinanceiro();
}

function marcarExecutada(index) {
  const lista = JSON.parse(localStorage.getItem("Tarefas")) || [];
  const item = lista.splice(index, 1)[0];
  salvarDados("Tarefas", lista);
  atualizarLista("Tarefas");
  const feitas = JSON.parse(localStorage.getItem("TarefasExecutadas")) || [];
  feitas.push(item);
  salvarDados("TarefasExecutadas", feitas);
  const ul = document.getElementById("listaTarefasExecutadas");
  const li = document.createElement("li");
  li.innerText = `${item.data} - ${item.descricao}`;
  ul.appendChild(li);
}

function removerItem(tipo, index) {
  const lista = JSON.parse(localStorage.getItem(tipo)) || [];
  lista.splice(index, 1);
  salvarDados(tipo, lista);
  atualizarLista(tipo);
  if (tipo === "Financeiro") atualizarResumoFinanceiro();
}

function exportarFinanceiro() {
  const lista = JSON.parse(localStorage.getItem("Financeiro")) || [];
  const csv = "Data,Produto,Valor,Categoria\n" + lista.map(i => 
    [i.data, i.produto, i.valor, i.categoria].join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "financeiro.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function gerarRelatorioPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("Relatório Financeiro", 10, 10);
  const lista = JSON.parse(localStorage.getItem("Financeiro")) || [];
  lista.forEach((item, i) => {
    doc.text(`${item.data} - ${item.produto} - R$${item.valor} - ${item.categoria}`, 10, 20 + i * 8);
  });
  doc.save("relatorio.pdf");
}

function atualizarResumoFinanceiro() {
  const lista = JSON.parse(localStorage.getItem("Financeiro")) || [];
  const resumo = {};
  lista.forEach(i => {
    if (!resumo[i.categoria]) resumo[i.categoria] = 0;
    resumo[i.categoria] += i.valor;
  });

  const container = document.getElementById("resumoFinanceiro");
  container.innerHTML = "<h3>Resumo Mensal por Categoria</h3><ul>" + Object.entries(resumo).map(
    ([cat, val]) => `<li>${cat}: R$ ${val.toFixed(2)}</li>`
  ).join("") + "</ul>";

  const ctx = document.getElementById("graficoFinanceiro").getContext("2d");
  if (window.graficoPizza) window.graficoPizza.destroy();
  window.graficoPizza = new Chart(ctx, {
    type: "pie",
    data: {
      labels: Object.keys(resumo),
      datasets: [{
        data: Object.values(resumo),
        backgroundColor: ["#4caf50", "#2196f3", "#ff9800", "#9c27b0", "#f44336"]
      }]
    }
  });
}

function marcarTudoPago() {
  salvarDados("Financeiro", []);
  atualizarLista("Financeiro");
  atualizarResumoFinanceiro();
}

function filtrarAplicacoes() {
  const filtro = document.getElementById("filtroAplicacao").value.toLowerCase();
  const itens = document.querySelectorAll("#listaAplicacoes li");
  itens.forEach(item => {
    item.style.display = item.textContent.toLowerCase().includes(filtro) ? "" : "none";
  });
}

function limparFiltroAplicacao() {
  document.getElementById("filtroAplicacao").value = "";
  filtrarAplicacoes();
}