// js/aplicacao.js

function initAplicacao() {
    console.log("Módulo Aplicações Iniciado");
    document.getElementById("aplicacaoForm").addEventListener("submit", (e) => {
        e.preventDefault();
        adicionarAplicacao();
    });
    carregarAplicacoes();
}

function adicionarAplicacao() {
    const produto = document.getElementById("produto").value;
    const quantidade = document.getElementById("quantidade").value;
    
    db.ref("aplicacoes").push({
        produto: produto,
        quantidade: quantidade,
        data: new Date().toISOString()
    });

    document.getElementById("produto").value = "";
    document.getElementById("quantidade").value = "";
}

function carregarAplicacoes() {
    db.ref("aplicacoes").on("value", (snapshot) => {
        const aplicacaoList = document.getElementById("aplicacaoList");
        aplicacaoList.innerHTML = "";
        snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val();
            const key = childSnapshot.key;
            const listItem = document.createElement("li");
            listItem.innerHTML = `
                <span class="item-text">${data.produto} - ${data.quantidade}</span>
                <div class="item-actions">
                    <button onclick="editarAplicacao('${key}')">
                        ✏️
                    </button>
                    <button onclick="excluirAplicacao('${key}')">
                        🗑️
                    </button>
                </div>
            `;
            aplicacaoList.appendChild(listItem);
        });
    });
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
