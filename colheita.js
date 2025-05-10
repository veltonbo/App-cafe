// js/colheita.js

function initColheita() {
    console.log("Módulo Colheita Iniciado");
    carregarColheitas();
}

function carregarColheitas() {
    db.ref("colheitas").on("value", (snapshot) => {
        const colheitaList = document.getElementById("colheitaList");
        colheitaList.innerHTML = "";
        snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val();
            const listItem = document.createElement("li");
            listItem.textContent = `${data.tipo} - ${data.peso}`;
            colheitaList.appendChild(listItem);
        });
    });
}
