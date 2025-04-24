
function showSection(id) {
    document.querySelectorAll('.app-section').forEach(sec => sec.style.display = 'none');
    document.getElementById(id).style.display = 'block';
}

// ---------------- APLICACAO ----------------
document.getElementById("aplicacao").innerHTML = `
    <div class="container">
        <h2>Aplicações realizadas</h2>
        <form id="aplicacao-form">
            <input type="date" id="data-aplicacao" required>
            <input type="text" id="produto" placeholder="Produto" required>
            <input type="text" id="dosagem" placeholder="Dosagem" required>
            <select id="tipo">
                <option value="">Tipo de Produto</option>
                <option>Adubo</option>
                <option>Herbicida</option>
                <option>Inseticida</option>
                <option>Fungicida</option>
            </select>
            <button type="submit">Adicionar</button>
        </form>
        <input type="text" id="filtro-aplicacao" placeholder="Filtrar aplicações...">
        <button onclick="limparFiltroAplicacao()">✔️ Limpar filtro</button>
        <ul id="lista-aplicacoes"></ul>
    </div>
`;

let aplicacoes = JSON.parse(localStorage.getItem("aplicacoes")) || [];

function salvarAplicacoes() {
    localStorage.setItem("aplicacoes", JSON.stringify(aplicacoes));
    listarAplicacoes();
}

function listarAplicacoes(filtro = "") {
    const lista = document.getElementById("lista-aplicacoes");
    lista.innerHTML = "";

    aplicacoes
        .filter(ap => ap.produto.toLowerCase().includes(filtro.toLowerCase()))
        .forEach((ap, index) => {
            const li = document.createElement("li");
            li.innerHTML = `${ap.data} - ${ap.produto} - ${ap.dosagem} - ${ap.tipo}
                <button onclick="deletarAplicacao(${index})">🗑️</button>`;
            lista.appendChild(li);
        });
}

function deletarAplicacao(index) {
    aplicacoes.splice(index, 1);
    salvarAplicacoes();
}

document.getElementById("aplicacao-form").addEventListener("submit", e => {
    e.preventDefault();
    const data = document.getElementById("data-aplicacao").value;
    const produto = document.getElementById("produto").value;
    const dosagem = document.getElementById("dosagem").value;
    const tipo = document.getElementById("tipo").value;

    aplicacoes.push({ data, produto, dosagem, tipo });
    salvarAplicacoes();
    e.target.reset();
});

document.getElementById("filtro-aplicacao").addEventListener("input", e => {
    listarAplicacoes(e.target.value);
});

function limparFiltroAplicacao() {
    document.getElementById("filtro-aplicacao").value = "";
    listarAplicacoes();
}

listarAplicacoes();

// ---------------- TAREFAS ----------------
document.getElementById("tarefas").innerHTML = `
    <div class="container">
        <h2>Tarefas</h2>
        <form id="tarefa-form">
            <input type="date" id="data-tarefa" required>
            <input type="text" id="descricao-tarefa" placeholder="Descrição da tarefa" required>
            <button type="submit">Adicionar</button>
        </form>
        <h3>Tarefas a fazer</h3>
        <ul id="tarefas-afazer"></ul>
        <h3>Tarefas executadas</h3>
        <ul id="tarefas-executadas"></ul>
    </div>
`;

let tarefas = JSON.parse(localStorage.getItem("tarefas")) || [];

function salvarTarefas() {
    localStorage.setItem("tarefas", JSON.stringify(tarefas));
    listarTarefas();
}

function listarTarefas() {
    const listaAfazer = document.getElementById("tarefas-afazer");
    const listaExecutadas = document.getElementById("tarefas-executadas");
    listaAfazer.innerHTML = "";
    listaExecutadas.innerHTML = "";

    tarefas.forEach((t, index) => {
        const li = document.createElement("li");
        li.innerHTML = `${t.data} - ${t.descricao} 
            ${!t.executada ? `<button onclick="executarTarefa(${index})">✔️</button>` : ""}
            <button onclick="deletarTarefa(${index})">🗑️</button>`;
        if (t.executada) {
            listaExecutadas.appendChild(li);
        } else {
            listaAfazer.appendChild(li);
        }
    });
}

function executarTarefa(index) {
    tarefas[index].executada = true;
    salvarTarefas();
}

function deletarTarefa(index) {
    tarefas.splice(index, 1);
    salvarTarefas();
}

document.getElementById("tarefa-form").addEventListener("submit", e => {
    e.preventDefault();
    const data = document.getElementById("data-tarefa").value;
    const descricao = document.getElementById("descricao-tarefa").value;
    tarefas.push({ data, descricao, executada: false });
    salvarTarefas();
    e.target.reset();
});

listarTarefas();

// ---------------- FINANCEIRO ----------------
document.getElementById("financeiro").innerHTML = `
    <div class="container">
        <h2>Financeiro</h2>
        <form id="financeiro-form">
            <input type="date" id="data-financeiro" required>
            <input type="text" id="produto-financeiro" placeholder="Produto" required>
            <input type="number" id="valor-financeiro" placeholder="Valor (R$)" required>
            <select id="tipo-financeiro" required>
                <option value="">Tipo de Produto</option>
                <option>Adubo</option>
                <option>Herbicida</option>
                <option>Inseticida</option>
                <option>Fungicida</option>
            </select>
            <button type="submit">Adicionar</button>
        </form>
        <input type="text" id="filtro-financeiro" placeholder="Filtrar...">
        <button onclick="limparFiltroFinanceiro()">✔️ Limpar filtro</button>
        <h3>A vencer</h3>
        <ul id="lista-vencer"></ul>
        <h3>Pago</h3>
        <ul id="lista-pago"></ul>
        <div><strong>Total a pagar:</strong> R$ <span id="total-pagar">0.00</span></div>
        <div class="container" id="resumo-mensal"></div>
<div class="container"><h4>Gráfico de Gastos por Tipo</h4><canvas id="grafico-gastos" height="200"></canvas></div>
    </div>
`;

let financeiro = JSON.parse(localStorage.getItem("financeiro")) || [];

function salvarFinanceiro() {
    localStorage.setItem("financeiro", JSON.stringify(financeiro));
    listarFinanceiro();
}

function listarFinanceiro(filtro = "") {
    const listaVencer = document.getElementById("lista-vencer");
    const listaPago = document.getElementById("lista-pago");
    listaVencer.innerHTML = "";
    listaPago.innerHTML = "";

    let total = 0;

    financeiro
        .filter(f => f.produto.toLowerCase().includes(filtro.toLowerCase()))
        .forEach((item, index) => {
            const li = document.createElement("li");
            li.innerHTML = `${item.data} - ${item.produto} - R$ ${parseFloat(item.valor).toFixed(2)} - ${item.tipo}
                ${!item.pago ? `<button onclick="marcarPago(${index})">✔️ Pagar</button>` : ""}
                <button onclick="deletarFinanceiro(${index})">🗑️</button>`;
            if (item.pago) {
                listaPago.appendChild(li);
            } else {
                listaVencer.appendChild(li);
                total += parseFloat(item.valor);
            }
        });

    document.getElementById("total-pagar").innerText = total.toFixed(2);
    resumoMensalGastos();
    atualizarGraficoGastos();
}

function marcarPago(index) {
    financeiro[index].pago = true;
    salvarFinanceiro();
}

function deletarFinanceiro(index) {
    financeiro.splice(index, 1);
    salvarFinanceiro();
}

document.getElementById("financeiro-form").addEventListener("submit", e => {
    e.preventDefault();
    const data = document.getElementById("data-financeiro").value;
    const produto = document.getElementById("produto-financeiro").value;
    const valor = document.getElementById("valor-financeiro").value;
    const tipo = document.getElementById("tipo-financeiro").value;
    if (!tipo) {
        alert("Por favor, selecione o tipo de produto.");
        return;
    }

    financeiro.push({ data, produto, valor, tipo, pago: false });
    salvarFinanceiro();
    e.target.reset();
});

document.getElementById("filtro-financeiro").addEventListener("input", e => {
    listarFinanceiro(e.target.value);
});

function limparFiltroFinanceiro() {
    document.getElementById("filtro-financeiro").value = "";
    listarFinanceiro();
}

function resumoMensalGastos() {
    const resumoDiv = document.getElementById("resumo-mensal");
    const resumo = {};

    financeiro.forEach(f => {
        if (!f.pago) {
            const mesAno = new Date(f.data).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
            resumo[mesAno] = (resumo[mesAno] || 0) + parseFloat(f.valor);
        }
    });

    resumoDiv.innerHTML = "<h4>Resumo Mensal de Gastos</h4>";
    for (const mes in resumo) {
        resumoDiv.innerHTML += `<div>${mes}: R$ ${resumo[mes].toFixed(2)}</div>`;
    }
}

listarFinanceiro();

function atualizarGraficoGastos() {
    const ctx = document.getElementById('grafico-gastos').getContext('2d');
    const tipos = {};
    financeiro.forEach(item => {
        if (!item.pago && item.tipo) {
            tipos[item.tipo] = (tipos[item.tipo] || 0) + parseFloat(item.valor);
        }
    });

    const labels = Object.keys(tipos);
    const dados = Object.values(tipos);

    if (window.graficoGastos) window.graficoGastos.destroy();

    window.graficoGastos = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Gastos (R$)',
                data: dados
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                title: { display: false }
            }
        }
    });
}
