// js/tarefas.js

function initTarefas() {
    console.log("Módulo Tarefas Iniciado");
    carregarTarefas();
}

function carregarTarefas() {
    db.ref("tarefas").on("value", (snapshot) => {
        const tarefasList = document.getElementById("tarefasList");
        tarefasList.innerHTML = "";
        snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val();
            const listItem = document.createElement("li");
            listItem.textContent = `${data.descricao} - ${data.status}`;
            tarefasList.appendChild(listItem);
        });
    });
}
