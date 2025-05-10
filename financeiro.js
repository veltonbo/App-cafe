// js/financeiro.js

function initFinanceiro() {
    console.log("Módulo Financeiro Iniciado");
    document.getElementById("financeiroForm").addEventListener("submit", (e) => {
        e.preventDefault();
        adicionarFinanceiro();
    });
    carregarFinanceiro();
}

function adicionarFinanceiro() {
    const descricao = document.getElementById("descricaoFinanceiro").value;
    const valor = document.getElementById("valorFinanceiro").value;

    db.ref("financeiro").push({
        descricao: descricao,
        valor: parseFloat(valor).toFixed(2),
        data: new Date().toISOString()
    });

    document.getElementById("descricaoFinanceiro").value = "";
    document.getElementById("valorFinanceiro").value = "";
}

function carregarFinanceiro() {
    db.ref("financeiro").on("value", (snapshot) => {
        const financeiroList = document.getElementById("financeiroList");
        financeiroList.innerHTML = "";
        snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val();
            const key = childSnapshot.key;
            const listItem = document.createElement("li");
            listItem.innerHTML = `
                <span class="item-text">${data.descricao} - R$ ${data.valor}</span>
                <div class="item-actions">
                    <button onclick="editarFinanceiro('${key}')">✏️</button>
                    <button onclick="excluirFinanceiro('${key}')">🗑️</button>
                </div>
            `;
            financeiroList.appendChild(listItem);
        });
    });
}

function editarFinanceiro(key) {
    const novaDescricao = prompt("Digite a nova descrição:");
    const novoValor = prompt("Digite o novo valor:");

    if (novaDescricao && novoValor) {
        db.ref("financeiro/" + key).update({
            descricao: novaDescricao,
            valor: parseFloat(novoValor).toFixed(2)
        });
    }
}

function excluirFinanceiro(key) {
    if (confirm("Deseja realmente excluir este lançamento?")) {
        db.ref("financeiro/" + key).remove();
    }
}
