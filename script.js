
document.addEventListener("DOMContentLoaded", () => {
    mostrarMenu('aplicacao');
    carregarFinanceiro();
    carregarAplicacoes();
    carregarTarefas();
});

function mostrarMenu(id) {
    document.querySelectorAll('.conteudo').forEach(div => div.classList.remove('ativo'));
    document.getElementById(id).classList.add('ativo');
}

// APLICAÇÕES
function adicionarAplicacao() {
    const data = document.getElementById('dataAplicacao').value;
    const produto = document.getElementById('produto').value;
    const dosagem = document.getElementById('dosagem').value;
    const tipo = document.getElementById('tipo').value;

    if (!produto || !dosagem) return;

    const aplicacoes = JSON.parse(localStorage.getItem('aplicacoes') || '[]');
    aplicacoes.push({ data, produto, dosagem, tipo });
    localStorage.setItem('aplicacoes', JSON.stringify(aplicacoes));
    carregarAplicacoes();
}

function carregarAplicacoes() {
    const lista = document.getElementById('listaAplicacoes');
    const aplicacoes = JSON.parse(localStorage.getItem('aplicacoes') || '[]');
    lista.innerHTML = '';
    aplicacoes.forEach((ap, i) => {
        const li = document.createElement('li');
        li.innerHTML = `${ap.data} - ${ap.produto} - ${ap.dosagem} - ${ap.tipo} <button onclick="deletarAplicacao(${i})">🗑️</button>`;
        lista.appendChild(li);
    });
}

function deletarAplicacao(index) {
    const aplicacoes = JSON.parse(localStorage.getItem('aplicacoes') || '[]');
    aplicacoes.splice(index, 1);
    localStorage.setItem('aplicacoes', JSON.stringify(aplicacoes));
    carregarAplicacoes();
}

function limparFiltroAplicacao() {
    document.getElementById('filtroAplicacao').value = '';
    carregarAplicacoes();
}

// TAREFAS
function adicionarTarefa() {
    const data = document.getElementById('dataTarefa').value;
    const descricao = document.getElementById('descricaoTarefa').value;

    if (!descricao) return;

    const tarefas = JSON.parse(localStorage.getItem('tarefas') || '[]');
    tarefas.push({ data, descricao, feita: false });
    localStorage.setItem('tarefas', JSON.stringify(tarefas));
    carregarTarefas();
}

function carregarTarefas() {
    const tarefasAFazer = document.getElementById('tarefasAFazer');
    const tarefasExecutadas = document.getElementById('tarefasExecutadas');
    tarefasAFazer.innerHTML = '';
    tarefasExecutadas.innerHTML = '';
    const tarefas = JSON.parse(localStorage.getItem('tarefas') || '[]');
    tarefas.forEach((t, i) => {
        const li = document.createElement('li');
        li.textContent = `${t.data} - ${t.descricao}`;
        li.onclick = () => {
            tarefas[i].feita = !tarefas[i].feita;
            localStorage.setItem('tarefas', JSON.stringify(tarefas));
            carregarTarefas();
        };
        if (t.feita) tarefasExecutadas.appendChild(li);
        else tarefasAFazer.appendChild(li);
    });
}

// FINANCEIRO
function adicionarFinanceiro() {
    const data = document.getElementById('dataFinanceiro').value;
    const produto = document.getElementById('produtoFinanceiro').value;
    const valor = parseFloat(document.getElementById('valorFinanceiro').value);
    const categoria = document.getElementById('categoriaFinanceiro').value;

    if (!produto || isNaN(valor)) return;

    const financeiro = JSON.parse(localStorage.getItem('financeiro') || '[]');
    financeiro.push({ data, produto, valor, categoria, pago: false });
    localStorage.setItem('financeiro', JSON.stringify(financeiro));
    carregarFinanceiro();
}

function carregarFinanceiro() {
    const lista = document.getElementById('listaFinanceiro');
    const resumo = document.getElementById('resumoFinanceiro');
    const dados = JSON.parse(localStorage.getItem('financeiro') || '[]');
    lista.innerHTML = '';
    let total = 0;
    const categorias = {};

    dados.forEach((item, i) => {
        if (!item.pago) total += item.valor;
        if (!categorias[item.categoria]) categorias[item.categoria] = 0;
        categorias[item.categoria] += item.valor;

        const li = document.createElement('li');
        if (item.pago) li.classList.add('pago');
        li.innerHTML = `
            ${item.data} - ${item.produto} - R$ ${item.valor.toFixed(2)}<br>
            <button onclick="marcarPago(${i})">✔️</button>
            <button onclick="editarFinanceiro(${i})">✏️</button>
            <button onclick="deletarFinanceiro(${i})">🗑️</button>
        `;
        lista.appendChild(li);
    });

    document.getElementById('totalPagar').innerText = `Total a pagar: R$ ${total.toFixed(2)}`;

    resumo.innerHTML = '<h3>Resumo Mensal por Categoria</h3>';
    for (const cat in categorias) {
        const p = document.createElement('p');
        p.textContent = `${cat}: R$ ${categorias[cat].toFixed(2)}`;
        resumo.appendChild(p);
    }

    // gráfico
    const ctx = document.getElementById('graficoPizza').getContext('2d');
    if (window.grafico) window.grafico.destroy();
    window.grafico = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(categorias),
            datasets: [{
                data: Object.values(categorias),
                backgroundColor: ['#4caf50', '#2196f3', '#ff9800', '#9c27b0', '#f44336']
            }]
        }
    });
}

function marcarPago(index) {
    const dados = JSON.parse(localStorage.getItem('financeiro') || '[]');
    dados[index].pago = true;
    localStorage.setItem('financeiro', JSON.stringify(dados));
    carregarFinanceiro();
}

function deletarFinanceiro(index) {
    const dados = JSON.parse(localStorage.getItem('financeiro') || '[]');
    dados.splice(index, 1);
    localStorage.setItem('financeiro', JSON.stringify(dados));
    carregarFinanceiro();
}

function editarFinanceiro(index) {
    const dados = JSON.parse(localStorage.getItem('financeiro') || '[]');
    const item = dados[index];
    document.getElementById('dataFinanceiro').value = item.data;
    document.getElementById('produtoFinanceiro').value = item.produto;
    document.getElementById('valorFinanceiro').value = item.valor;
    document.getElementById('categoriaFinanceiro').value = item.categoria;
    dados.splice(index, 1);
    localStorage.setItem('financeiro', JSON.stringify(dados));
    carregarFinanceiro();
}

function marcarTudoComoPago() {
    const dados = JSON.parse(localStorage.getItem('financeiro') || '[]');
    dados.forEach(i => i.pago = true);
    localStorage.setItem('financeiro', JSON.stringify(dados));
    carregarFinanceiro();
}

function exportarFinanceiro() {
    const dados = localStorage.getItem('financeiro');
    const blob = new Blob([dados], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "financeiro.json";
    a.click();
}

function gerarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Relatório Financeiro", 10, 10);
    const dados = JSON.parse(localStorage.getItem('financeiro') || '[]');
    let y = 20;
    dados.forEach(i => {
        doc.text(`${i.data} - ${i.produto} - R$ ${i.valor.toFixed(2)} - ${i.categoria}`, 10, y);
        y += 10;
    });
    doc.save("relatorio.pdf");
}
