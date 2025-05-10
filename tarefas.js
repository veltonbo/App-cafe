// js/tarefas.js

function initTarefas() {
    console.log("Módulo Tarefas Iniciado");
    document.getElementById("tarefasForm").addEventListener("submit", (e) => {
        e.preventDefault();
        adicionarTarefa();
    });
    carregarTarefas();
}

function adicionarTarefa() {
    const descricao = document.getElementById("descricaoTarefa").value;

    db.ref("tarefas").push({
        descricao: descricao,
        status: "Pendente",
        data: new Date().toISOString()
    });

    document.getElementById("descricaoTarefa").value = "";
}

function carregarTarefas() {
    db.ref("tarefas").on("value", (snapshot) => {
        const tarefasList = document.getElementById("tarefasList");
        tarefasList.innerHTML = "";
        snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val();
            const key = childSnapshot.key;
            const listItem = document.createElement("li");
            listItem.innerHTML = `
                <span class="item-text">${data.descricao} - ${data.status}</span>
                <div class="item-actions">
                    <button onclick="marcarFeita('${key}')">✅</button>
                    <button onclick="excluirTarefa('${key}')">🗑️</button>
                </div>
            `;
            tarefasList.appendChild(listItem);
        });
    });
}

function marcarFeita(key) {
    db.ref("tarefas/" + key).update({ status: "Feita" });
}

function excluirTarefa(key) {
    if (confirm("Deseja realmente excluir esta tarefa?")) {
        db.ref("tarefas/" + key).remove();
    }
}
