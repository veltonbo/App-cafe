
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
        <button onclick="limparFiltroAplicacao()"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="green" viewBox="0 0 24 24"><path d="M20.285 2.859L9 14.143l-5.285-5.286L2 10.572 9 17.572l12-12z"/></svg></button>Limpar filtro</button>
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
                <button onclick="deletarAplicacao(${index})" class="btn-delete"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="red" viewBox="0 0 24 24"><path d="M9 3v1H4v2h1v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6h1V4h-5V3H9zm2 4v12h2V7h-2z"/></svg></button>`;
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
            ${!t.executada ? `<button onclick="executarTarefa(${index})"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="green" viewBox="0 0 24 24"><path d="M20.285 2.859L9 14.143l-5.285-5.286L2 10.572 9 17.572l12-12z"/></svg></button>` : ""}
            <button onclick="deletarTarefa(${index})" class="btn-delete"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="red" viewBox="0 0 24 24"><path d="M9 3v1H4v2h1v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6h1V4h-5V3H9zm2 4v12h2V7h-2z"/></svg></button>`;
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
            <select id="tipo-financeiro">
                <option value="">Tipo de Produto</option>
                <option>Adubo</option>
                <option>Herbicida</option>
                <option>Inseticida</option>
                <option>Fungicida</option>
            </select>
            <button type="submit">Adicionar</button>
        </form>

        <input type="text" id="filtro-financeiro" placeholder="Filtrar...">
        <button onclick="limparFiltroFinanceiro()"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="green" viewBox="0 0 24 24"><path d="M20.285 2.859L9 14.143l-5.285-5.286L2 10.572 9 17.572l12-12z"/></svg></button>Limpar filtro</button>

        <h3>A vencer</h3>
        <ul id="lista-vencer"></ul>

        <h3>Pago</h3>
        <ul id="lista-pago"></ul>

        <div><strong>Total a pagar:</strong> R$ <span id="total-pagar">0.00</span></div>
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
                ${!item.pago ? `<button onclick="marcarPago(${index})"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="green" viewBox="0 0 24 24"><path d="M20.285 2.859L9 14.143l-5.285-5.286L2 10.572 9 17.572l12-12z"/></svg></button>Pagar</button>` : ""}
                <button onclick="deletarFinanceiro(${index})" class="btn-delete"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="red" viewBox="0 0 24 24"><path d="M9 3v1H4v2h1v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6h1V4h-5V3H9zm2 4v12h2V7h-2z"/></svg></button>`;

            if (item.pago) {
                listaPago.appendChild(li);
            } else {
                listaVencer.appendChild(li);
                total += parseFloat(item.valor);
            }
        });

    document.getElementById("total-pagar").innerText = total.toFixed(2);
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

listarFinanceiro();

// EXPORTAÇÃO DE DADOS
function exportarCSV() {
    let csv = "TABELA;DATA;DESCRICAO/PRODUTO;VALOR/DOSAGEM;TIPO;STATUS\n";

    aplicacoes.forEach(item => {
        csv += `Aplicacao;${item.data};${item.produto};${item.dosagem};${item.tipo};\n`;
    });

    tarefas.forEach(item => {
        csv += `Tarefa;${item.data};${item.descricao};;;${item.executada ? "Executada" : "A Fazer"}\n`;
    });

    financeiro.forEach(item => {
        csv += `Financeiro;${item.data};${item.produto};${item.valor};${item.tipo};${item.pago ? "Pago" : "A Vencer"}\n`;
    });

    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "manejo_cafe_export.csv";
    a.click();
    URL.revokeObjectURL(url);
}

const exportButton = document.createElement("button");
exportButton.innerText = "Exportar Dados";
exportButton.style.position = "fixed";
exportButton.style.bottom = "10px";
exportButton.style.right = "10px";
exportButton.style.padding = "10px";
exportButton.style.backgroundColor = "#2e7d32";
exportButton.style.color = "white";
exportButton.style.border = "none";
exportButton.style.borderRadius = "5px";
exportButton.style.cursor = "pointer";
exportButton.onclick = exportarCSV;

document.body.appendChild(exportButton);

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

// adicionar div no HTML do financeiro
document.getElementById("financeiro").innerHTML += `<div class="container" id="resumo-mensal"></div>`;
resumoMensalGastos();

// Alternar Tema Escuro
const botaoTema = document.createElement("button");
botaoTema.innerText = "Tema Escuro";
botaoTema.style.position = "fixed";
botaoTema.style.bottom = "60px";
botaoTema.style.right = "10px";
botaoTema.style.padding = "10px";
botaoTema.style.backgroundColor = "#444";
botaoTema.style.color = "white";
botaoTema.style.border = "none";
botaoTema.style.borderRadius = "5px";
botaoTema.style.cursor = "pointer";

botaoTema.onclick = () => {
    document.body.classList.toggle("dark");
    const tema = document.body.classList.contains("dark") ? "dark" : "light";
    localStorage.setItem("tema", tema);
    botaoTema.innerText = tema === "dark" ? "Tema Claro" : "Tema Escuro";
};

document.body.appendChild(botaoTema);

window.addEventListener("load", () => {
    const temaSalvo = localStorage.getItem("tema");
    if (temaSalvo === "dark") {
        document.body.classList.add("dark");
        botaoTema.innerText = "Tema Claro";
    }
});

function listarTarefas() {
    const listaAfazer = document.getElementById("tarefas-afazer");
    const listaExecutadas = document.getElementById("tarefas-executadas");
    listaAfazer.innerHTML = "";
    listaExecutadas.innerHTML = "";

    const agruparPorData = (tarefas, executadas) => {
        const agrupadas = {};
        tarefas
            .filter(t => t.executada === executadas)
            .forEach(t => {
                if (!agrupadas[t.data]) agrupadas[t.data] = [];
                agrupadas[t.data].push(t);
            });
        return agrupadas;
    };

    const renderGrupo = (grupo, destino, executadas) => {
        for (const data in grupo) {
            const header = document.createElement("h4");
            header.innerText = new Date(data).toLocaleDateString('pt-BR');
            destino.appendChild(header);

            grupo[data].forEach((t, indexGlobal) => {
                const index = tarefas.indexOf(t);
                const li = document.createElement("li");
                li.innerHTML = `${t.descricao} 
                    ${!executadas ? `<button onclick="executarTarefa(${index})">${svg_check}</button>` : ""}
                    <button onclick="deletarTarefa(${index})">${svg_trash}</button>`;
                destino.appendChild(li);
            });
        }
    };

    const grupoAfazer = agruparPorData(tarefas, false);
    const grupoExecutadas = agruparPorData(tarefas, true);

    renderGrupo(grupoAfazer, listaAfazer, false);
    renderGrupo(grupoExecutadas, listaExecutadas, true);
}


// Botão de Backup
const botaoBackup = document.createElement("button");
botaoBackup.innerText = "Fazer Backup";
botaoBackup.style.position = "fixed";
botaoBackup.style.bottom = "110px";
botaoBackup.style.right = "10px";
botaoBackup.style.padding = "10px";
botaoBackup.style.backgroundColor = "#2e7d32";
botaoBackup.style.color = "white";
botaoBackup.style.border = "none";
botaoBackup.style.borderRadius = "5px";
botaoBackup.style.cursor = "pointer";
botaoBackup.onclick = async () => {
    const dados = {
        aplicacoes: JSON.parse(localStorage.getItem("aplicacoes") || "[]"),
        tarefas: JSON.parse(localStorage.getItem("tarefas") || "[]"),
        financeiro: JSON.parse(localStorage.getItem("financeiro") || "[]")
    };
    try {
        const resposta = await fetch("https://script.google.com/macros/s/AKfycbwU_nIK-l7aEDRA8yYRSDB70F1p1bAjCmJNmzRPOAKVrwx1_ceRT3oWbbD15niPxkCGtQ/exec", {
            method: "POST",
            body: JSON.stringify(dados),
            headers: {
                "Content-Type": "application/json"
            }
        });
        const texto = await resposta.text();
        alert("Backup concluído: " + texto);
    } catch (e) {
        alert("Erro ao enviar backup: " + e.message);
    }
};
document.body.appendChild(botaoBackup);
