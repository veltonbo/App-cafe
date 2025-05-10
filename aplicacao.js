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
            const listItem = document.createElement("li");
            listItem.textContent = `${data.produto} - ${data.quantidade}`;
            aplicacaoList.appendChild(listItem);
        });
    });
}
