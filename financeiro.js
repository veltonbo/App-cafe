// js/financeiro.js

function initFinanceiro() {
    console.log("Módulo Financeiro Iniciado");
    carregarFinanceiro();
}

function carregarFinanceiro() {
    db.ref("financeiro").on("value", (snapshot) => {
        const financeiroList = document.getElementById("financeiroList");
        financeiroList.innerHTML = "";
        snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val();
            const listItem = document.createElement("li");
            listItem.textContent = `${data.descricao} - R$ ${data.valor}`;
            financeiroList.appendChild(listItem);
        });
    });
}
