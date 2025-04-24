
// Manejo Café - script.js completo
// Funcionalidades: Aplicações, Tarefas, Financeiro, Tema Escuro, Exportar, Backup, Gráfico

function showSection(id) {
    document.querySelectorAll('.app-section').forEach(sec => sec.style.display = 'none');
    document.getElementById(id).style.display = 'block';
}

// ------ Aplicações ------
document.getElementById("aplicacao").innerHTML = `
<div class="container">
    <h2>Aplicações</h2>
    <form id="aplicacao-form">
        <input type="date" id="data-aplicacao" required>
        <input type="text" id="produto-aplicacao" placeholder="Produto" required>
        <input type="text" id="dosagem-aplicacao" placeholder="Dosagem" required>
        <select id="tipo-aplicacao" required>
            <option value="">Tipo</option>
            <option>Adubo</option>
            <option>Herbicida</option>
            <option>Inseticida</option>
            <option>Fungicida</option>
        </select>
        <button type="submit">Adicionar</button>
    </form>
    <input type="text" id="filtro-aplicacao" placeholder="Filtrar...">
    <ul id="lista-aplicacoes"></ul>
</div>
`;

let aplicacoes = JSON.parse(localStorage.getItem("aplicacoes") || "[]");

function salvarAplicacoes() {
    localStorage.setItem("aplicacoes", JSON.stringify(aplicacoes));
    listarAplicacoes();
}

function listarAplicacoes(filtro = "") {
    const ul = document.getElementById("lista-aplicacoes");
    ul.innerHTML = "";
    aplicacoes
        .filter(a => a.produto.toLowerCase().includes(filtro.toLowerCase()))
        .forEach((a, i) => {
            const li = document.createElement("li");
            li.innerHTML = `${a.data} - ${a.produto} - ${a.dosagem} - ${a.tipo}
                <button onclick="removerAplicacao(${i})">🗑️</button>`;
            ul.appendChild(li);
        });
}

function removerAplicacao(i) {
    aplicacoes.splice(i, 1);
    salvarAplicacoes();
}

document.getElementById("aplicacao-form").addEventListener("submit", e => {
    e.preventDefault();
    aplicacoes.push({
        data: document.getElementById("data-aplicacao").value,
        produto: document.getElementById("produto-aplicacao").value,
        dosagem: document.getElementById("dosagem-aplicacao").value,
        tipo: document.getElementById("tipo-aplicacao").value
    });
    salvarAplicacoes();
    e.target.reset();
});

document.getElementById("filtro-aplicacao").addEventListener("input", e => listarAplicacoes(e.target.value));
listarAplicacoes();

// ------ Tarefas ------
document.getElementById("tarefas").innerHTML = `
<div class="container">
    <h2>Tarefas</h2>
    <form id="tarefa-form">
        <input type="date" id="data-tarefa" required>
        <input type="text" id="descricao-tarefa" placeholder="Descrição" required>
        <button type="submit">Adicionar</button>
    </form>
    <h3>A Fazer</h3>
    <ul id="tarefas-afazer"></ul>
    <h3>Executadas</h3>
    <ul id="tarefas-executadas"></ul>
</div>
`;

let tarefas = JSON.parse(localStorage.getItem("tarefas") || "[]");

function salvarTarefas() {
    localStorage.setItem("tarefas", JSON.stringify(tarefas));
    listarTarefas();
}

function listarTarefas() {
    const afazer = document.getElementById("tarefas-afazer");
    const feitas = document.getElementById("tarefas-executadas");
    afazer.innerHTML = "";
    feitas.innerHTML = "";

    tarefas.forEach((t, i) => {
        const li = document.createElement("li");
        li.innerHTML = `${t.data} - ${t.descricao}
            ${!t.executada ? `<button onclick="executarTarefa(${i})">✔️</button>` : ""}
            <button onclick="removerTarefa(${i})">🗑️</button>`;
        (t.executada ? feitas : afazer).appendChild(li);
    });
}

function executarTarefa(i) {
    tarefas[i].executada = true;
    salvarTarefas();
}

function removerTarefa(i) {
    tarefas.splice(i, 1);
    salvarTarefas();
}

document.getElementById("tarefa-form").addEventListener("submit", e => {
    e.preventDefault();
    tarefas.push({
        data: document.getElementById("data-tarefa").value,
        descricao: document.getElementById("descricao-tarefa").value,
        executada: false
    });
    salvarTarefas();
    e.target.reset();
});
listarTarefas();

// ------ Financeiro ------
document.getElementById("financeiro").innerHTML = `
<div class="container">
    <h2>Financeiro</h2>
    <form id="financeiro-form">
        <input type="date" id="data-financeiro" required>
        <input type="text" id="produto-financeiro" placeholder="Produto" required>
        <input type="number" id="valor-financeiro" placeholder="Valor" required>
        <select id="tipo-financeiro" required>
            <option value="">Tipo</option>
            <option>Adubo</option>
            <option>Herbicida</option>
            <option>Inseticida</option>
            <option>Fungicida</option>
        </select>
        <button type="submit">Adicionar</button>
    </form>
    <input type="text" id="filtro-financeiro" placeholder="Filtrar...">
    <h3>A Vencer</h3>
    <ul id="financeiro-vencer"></ul>
    <h3>Pago</h3>
    <ul id="financeiro-pago"></ul>
    <div><strong>Total a pagar:</strong> R$ <span id="total-pagar">0.00</span></div>
</div>
<canvas id="grafico-gastos" height="150"></canvas>
`;

let financeiro = JSON.parse(localStorage.getItem("financeiro") || "[]");

function salvarFinanceiro() {
    localStorage.setItem("financeiro", JSON.stringify(financeiro));
    listarFinanceiro();
}

function listarFinanceiro(filtro = "") {
    const vencer = document.getElementById("financeiro-vencer");
    const pago = document.getElementById("financeiro-pago");
    vencer.innerHTML = "";
    pago.innerHTML = "";
    let total = 0;
    const tipoTotais = {};

    financeiro.filter(f => f.produto.toLowerCase().includes(filtro.toLowerCase())).forEach((f, i) => {
        const li = document.createElement("li");
        li.innerHTML = `${f.data} - ${f.produto} - R$ ${parseFloat(f.valor).toFixed(2)} - ${f.tipo}
            ${!f.pago ? `<button onclick="pagarFinanceiro(${i})">✔️</button>` : ""}
            <button onclick="removerFinanceiro(${i})">🗑️</button>`;

        if (f.pago) {
            pago.appendChild(li);
        } else {
            vencer.appendChild(li);
            total += parseFloat(f.valor);
            tipoTotais[f.tipo] = (tipoTotais[f.tipo] || 0) + parseFloat(f.valor);
        }
    });

    document.getElementById("total-pagar").innerText = total.toFixed(2);
    desenharGrafico(tipoTotais);
}

function pagarFinanceiro(i) {
    financeiro[i].pago = true;
    salvarFinanceiro();
}

function removerFinanceiro(i) {
    financeiro.splice(i, 1);
    salvarFinanceiro();
}

document.getElementById("financeiro-form").addEventListener("submit", e => {
    e.preventDefault();
    financeiro.push({
        data: document.getElementById("data-financeiro").value,
        produto: document.getElementById("produto-financeiro").value,
        valor: document.getElementById("valor-financeiro").value,
        tipo: document.getElementById("tipo-financeiro").value,
        pago: false
    });
    salvarFinanceiro();
    e.target.reset();
});

document.getElementById("filtro-financeiro").addEventListener("input", e => listarFinanceiro(e.target.value));
listarFinanceiro();

// ------ Gráfico com Chart.js ------
function desenharGrafico(dados) {
    const ctx = document.getElementById("grafico-gastos").getContext("2d");
    if (window.grafico) window.grafico.destroy();
    window.grafico = new Chart(ctx, {
        type: "bar",
        data: {
            labels: Object.keys(dados),
            datasets: [{ label: "Gastos (R$)", data: Object.values(dados) }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });
}

// ------ Botões fixos: Tema, Backup, Exportar ------
const tema = document.createElement("button");
tema.innerText = "Tema Escuro";
tema.style.position = "fixed";
tema.style.bottom = "10px";
tema.style.left = "10px";
tema.onclick = () => {
    document.body.classList.toggle("dark");
    tema.innerText = document.body.classList.contains("dark") ? "Tema Claro" : "Tema Escuro";
};
document.body.appendChild(tema);

const exportar = document.createElement("button");
exportar.innerText = "Exportar CSV";
exportar.style.position = "fixed";
exportar.style.bottom = "50px";
exportar.style.left = "10px";
exportar.onclick = () => {
    let csv = "TABELA;DATA;PRODUTO;VALOR/DOSAGEM;TIPO;STATUS\n";
    aplicacoes.forEach(a => csv += `Aplicacao;${a.data};${a.produto};${a.dosagem};${a.tipo};\n`);
    tarefas.forEach(t => csv += `Tarefa;${t.data};${t.descricao};;;${t.executada ? "Executada" : "A Fazer"}\n`);
    financeiro.forEach(f => csv += `Financeiro;${f.data};${f.produto};${f.valor};${f.tipo};${f.pago ? "Pago" : "A Vencer"}\n`);
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "manejo_cafe_export.csv";
    a.click();
};
document.body.appendChild(exportar);

const backup = document.createElement("button");
backup.innerText = "Fazer Backup";
backup.style.position = "fixed";
backup.style.bottom = "90px";
backup.style.left = "10px";
backup.onclick = async () => {
    const dados = { aplicacoes, tarefas, financeiro };
    try {
        const r = await fetch("https://script.google.com/macros/s/AKfycbwU_nIK-l7aEDRA8yYRSDB70F1p1bAjCmJNmzRPOAKVrwx1_ceRT3oWbbD15niPxkCGtQ/exec", {
            method: "POST",
            body: JSON.stringify(dados),
            headers: { "Content-Type": "application/json" }
        });
        const txt = await r.text();
        alert("Backup: " + txt);
    } catch (e) {
        alert("Erro no backup: " + e.message);
    }
};
document.body.appendChild(backup);
