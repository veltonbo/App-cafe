document.addEventListener("DOMContentLoaded", function () {
  mostrarAba('aplicacoes');

  // Navegação
  window.mostrarAba = function (id) {
    document.querySelectorAll('.aba').forEach(secao => {
      secao.classList.remove('ativa');
    });
    document.getElementById(id).classList.add('ativa');
  };

  // ===== APLICACOES =====
  const formAplicacao = document.getElementById("form-aplicacao");
  const listaAplicacoes = document.getElementById("listaAplicacoes");
  let aplicacoes = JSON.parse(localStorage.getItem("aplicacoes") || "[]");

  function renderizarAplicacoes() {
    listaAplicacoes.innerHTML = "";
    aplicacoes.forEach((ap, i) => {
      const li = document.createElement("li");
      li.innerHTML = `${ap.data} - ${ap.produto} - ${ap.dosagem} - ${ap.tipo}
        <button onclick="excluirAplicacao(${i})">🗑</button>`;
      listaAplicacoes.appendChild(li);
    });
  }

  formAplicacao?.addEventListener("submit", function (e) {
    e.preventDefault();
    const nova = {
      data: document.getElementById("dataAplicacao").value,
      produto: document.getElementById("produtoAplicacao").value,
      dosagem: document.getElementById("dosagemAplicacao").value,
      tipo: document.getElementById("tipoAplicacao").value
    };
    aplicacoes.push(nova);
    localStorage.setItem("aplicacoes", JSON.stringify(aplicacoes));
    formAplicacao.reset();
    renderizarAplicacoes();
  });

  window.excluirAplicacao = function (index) {
    aplicacoes.splice(index, 1);
    localStorage.setItem("aplicacoes", JSON.stringify(aplicacoes));
    renderizarAplicacoes();
  };

  renderizarAplicacoes();

  // ===== TAREFAS =====
  const formTarefa = document.getElementById("form-tarefa");
  const tarefasAFazer = document.getElementById("tarefasAFazer");
  const tarefasConcluidas = document.getElementById("tarefasConcluidas");
  let tarefas = JSON.parse(localStorage.getItem("tarefas") || "[]");

  function renderizarTarefas() {
    tarefasAFazer.innerHTML = "";
    tarefasConcluidas.innerHTML = "";

    tarefas.forEach((t, i) => {
      const li = document.createElement("li");
      li.innerHTML = `${t.data} - ${t.descricao}
        <div>
          <button onclick="marcarFeita(${i})">✔</button>
          <button onclick="excluirTarefa(${i})">🗑</button>
        </div>`;
      if (t.feita) {
        li.classList.add("feita");
        tarefasConcluidas.appendChild(li);
      } else {
        tarefasAFazer.appendChild(li);
      }
    });
  }

  formTarefa?.addEventListener("submit", function (e) {
    e.preventDefault();
    tarefas.push({
      data: document.getElementById("dataTarefa").value,
      descricao: document.getElementById("descricaoTarefa").value,
      feita: false
    });
    localStorage.setItem("tarefas", JSON.stringify(tarefas));
    formTarefa.reset();
    renderizarTarefas();
  });

  window.marcarFeita = function (index) {
    tarefas[index].feita = !tarefas[index].feita;
    localStorage.setItem("tarefas", JSON.stringify(tarefas));
    renderizarTarefas();
  };

  window.excluirTarefa = function (index) {
    tarefas.splice(index, 1);
    localStorage.setItem("tarefas", JSON.stringify(tarefas));
    renderizarTarefas();
  };

  renderizarTarefas();

  // ===== FINANCEIRO =====
  const formFinanceiro = document.getElementById("form-financeiro");
  const listaFinanceiro = document.getElementById("listaFinanceiro");
  const totalPagar = document.getElementById("totalPagar");
  let financeiro = JSON.parse(localStorage.getItem("financeiro") || "[]");

  function renderizarFinanceiro() {
    listaFinanceiro.innerHTML = "";
    let total = 0;
    financeiro.forEach((item, i) => {
      total += parseFloat(item.valor);
      const li = document.createElement("li");
      li.innerHTML = `${item.data} - ${item.produto} - R$ ${parseFloat(item.valor).toFixed(2)} - ${item.categoria}
        <div>
          <button onclick="marcarPago(${i})">✔</button>
          <button onclick="editarFinanceiro(${i})">✏️</button>
          <button onclick="excluirFinanceiro(${i})">🗑</button>
        </div>`;
      listaFinanceiro.appendChild(li);
    });
    totalPagar.textContent = "Total a pagar: R$ " + total.toFixed(2);
  }

  formFinanceiro?.addEventListener("submit", function (e) {
    e.preventDefault();
    financeiro.push({
      data: document.getElementById("dataFinanceiro").value,
      produto: document.getElementById("produtoFinanceiro").value,
      valor: parseFloat(document.getElementById("valorFinanceiro").value),
      categoria: document.getElementById("categoriaFinanceiro").value,
      pago: false
    });
    localStorage.setItem("financeiro", JSON.stringify(financeiro));
    formFinanceiro.reset();
    renderizarFinanceiro();
  });

  window.marcarPago = function (index) {
    financeiro[index].pago = true;
    localStorage.setItem("financeiro", JSON.stringify(financeiro));
    renderizarFinanceiro();
  };

  window.editarFinanceiro = function (index) {
    const item = financeiro[index];
    document.getElementById("dataFinanceiro").value = item.data;
    document.getElementById("produtoFinanceiro").value = item.produto;
    document.getElementById("valorFinanceiro").value = item.valor;
    document.getElementById("categoriaFinanceiro").value = item.categoria;
    financeiro.splice(index, 1);
    localStorage.setItem("financeiro", JSON.stringify(financeiro));
    renderizarFinanceiro();
  };

  window.excluirFinanceiro = function (index) {
    financeiro.splice(index, 1);
    localStorage.setItem("financeiro", JSON.stringify(financeiro));
    renderizarFinanceiro();
  };

  renderizarFinanceiro();
});