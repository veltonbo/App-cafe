// js/aplicacao.js

document.addEventListener("DOMContentLoaded", () => {
    carregarAplicacoes();
});

function carregarAplicacoes() {
    db.ref("aplicacoes").on("value", (snapshot) => {
        const aplicacaoList = document.getElementById("aplicacaoList");
        aplicacaoList.innerHTML = "";
        snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val();
            const key = childSnapshot.key;
            const listItem = document.createElement("li");
            listItem.innerHTML = `
                ${data.produto} - ${data.quantidade}
                <button onclick="editarAplicacao('${key}')">✏️</button>
                <button onclick="excluirAplicacao('${key}')">🗑️</button>
            `;
            aplicacaoList.appendChild(listItem);
        });
    });
}

function adicionarAplicacao() {
    const produto = prompt("Digite o produto:");
    const quantidade = prompt("Digite a quantidade:");

    if (produto && quantidade) {
        db.ref("aplicacoes").push({ produto, quantidade });
    }
}

function editarAplicacao(key) {
    const novoProduto = prompt("Digite o novo produto:");
    const novaQuantidade = prompt("Digite a nova quantidade:");

    if (novoProduto && novaQuantidade) {
        db.ref("aplicacoes/" + key).update({
            produto: novoProduto,
            quantidade: novaQuantidade
        });
    }
}

function excluirAplicacao(key) {
    if (confirm("Deseja realmente excluir esta aplicação?")) {
        db.ref("aplicacoes/" + key).remove();
    }
}
